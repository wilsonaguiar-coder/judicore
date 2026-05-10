# Atualização dos Tribunais Superiores — STF, STJ e TST

Guia operacional para atualização incremental da base de jurisprudência.

---

## Arquitetura resumida

| Tribunal | Base de dados | Método de coleta |
|----------|--------------|-----------------|
| STF | LanceDB (busca vetorial) | API pública + Chrome (bypass WAF) |
| STJ | LanceDB (busca vetorial) | PDFs baixados localmente + upload via scp |
| TST | Elasticsearch (busca textual) | API pública via BullMQ (jobs semanais) |

---

## STF — Supremo Tribunal Federal

### Frequência recomendada
Mensal ou quando necessário indexar acórdãos recentes.

### Como funciona
O script `services/search/update_lancedb.py` acessa a API pública do STF (`jurisprudencia.stf.jus.br`). Quando disponível, usa o Chrome/Chromium para contornar o AWS WAF. Os documentos são embeddados com Gemini (`gemini-embedding-001`, 768 dims) e gravados no LanceDB via upsert (`merge_insert` por `doc_id`).

### Pré-requisitos
- `GEMINI_API_KEY` configurada em `services/search/.env` (conta paga obrigatória — tier gratuito tem cota muito baixa)
- Chrome instalado no servidor: `which google-chrome`
- Venv ativo: `source services/search/venv/bin/activate`

### Comando
```bash
cd /opt/judicore
source services/search/venv/bin/activate

# Só STF (mais rápido):
PYTHONUNBUFFERED=1 ONLY_STF=1 nohup python services/search/update_lancedb.py \
  > /tmp/lancedb_$(date +%Y%m%d_%H%M).log 2>&1 &
echo "PID: $!"

# STF + STJ juntos:
PYTHONUNBUFFERED=1 nohup python services/search/update_lancedb.py \
  > /tmp/lancedb_$(date +%Y%m%d_%H%M).log 2>&1 &
echo "PID: $!"
```

### Variáveis de ambiente opcionais
| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SINCE_DATE` | `2026-01-01` | Data de corte para buscar acórdãos STF |
| `YEAR` | `2026` | Ano de referência para informativos STJ |
| `ONLY_STF` | — | Se `1`, indexa apenas STF |
| `ONLY_STJ` | — | Se `1`, indexa apenas STJ |
| `CHROME_PATH` | `/usr/bin/google-chrome` | Caminho do executável Chrome |

### Acompanhar progresso
```bash
tail -f /tmp/lancedb_*.log
```

### Verificar resultado
```bash
python3 -c "
import lancedb
db = lancedb.connect('lancedb_store')
t = db.open_table('jurisprudencia')
stf = t.search().where(\"doc_id LIKE 'stf-%' AND data_julgamento >= '2026-01-01'\", prefilter=True).limit(1).to_arrow()
print('STF 2026 - embedding dims:', len(stf.column('vector').to_pylist()[0]))
"
```

### Erros conhecidos
- **127 docs faltantes / RuntimeError de integridade**: Normal — alguns docs retornam erro 404 na API do STF. O script tem `strict_completeness=False` e não trava mais por isso.
- **OOM (processo morto)**: O servidor precisa de pelo menos 16 GB RAM. Verifique swap: `swapon --show`.
- **Chrome não abre**: Verifique `CHROME_PATH`. O script funciona sem Chrome, mas pode falhar no WAF do STF para algumas buscas.

---

## STJ — Superior Tribunal de Justiça

### Frequência recomendada
A cada nova edição do Informativo STJ publicada (geralmente quinzenal).

### Por que baixar localmente?
**O servidor VPS tem o IP bloqueado pelo STJ a nível de rede** — não é bot protection, é bloqueio de ASN de datacenter. Qualquer tentativa de download direto do servidor retorna 403 ou timeout. Os PDFs precisam ser baixados em uma máquina doméstica (IP residencial) e enviados ao servidor via scp.

### Passo 1 — Verificar última edição indexada
No servidor:
```bash
python3 -c "
import lancedb
db = lancedb.connect('lancedb_store')
t = db.open_table('jurisprudencia')
stj = t.search().where(\"doc_id LIKE 'stj-%'\", prefilter=True).limit(10000).select(['doc_id']).to_arrow()
ids = stj.column('doc_id').to_pylist()
editions = sorted({int(i.split('-ed')[1]) for i in ids if '-ed' in i}, reverse=True)
print('Edições no banco:', editions[:10], '...')
print('Última edição:', editions[0] if editions else 'nenhuma')
"
```

### Passo 2 — Baixar PDFs localmente (máquina Windows/doméstica)

Na raiz do projeto, existe o script `download_stj.mjs`. Edite as constantes `START` e `END` para o intervalo de edições desejado:

```javascript
// download_stj.mjs
const START = 888;  // próxima edição após a última indexada
const END = 920;    // última edição publicada (verificar em processo.stj.jus.br)
```

Execute:
```powershell
# No terminal Windows (na raiz do projeto):
node download_stj.mjs
```

Os PDFs são salvos em `stj_pdfs/` com o formato `Informativo_NNNN.pdf`.

Alternativamente, use a versão Python:
```bash
python download_stj.py
```

### Passo 3 — Enviar PDFs ao servidor
```powershell
# No terminal Windows:
scp -i "$env:USERPROFILE\.ssh\judicore_vps" stj_pdfs\*.pdf root@2.24.75.193:/opt/judicore/_internal/data/stj_informativos/docs/
```

### Passo 4 — Rodar atualização no servidor
O script detecta automaticamente os PDFs em disco antes de tentar o browser:

```bash
cd /opt/judicore
source services/search/venv/bin/activate

PYTHONUNBUFFERED=1 ONLY_STJ=1 nohup python services/search/update_lancedb.py \
  > /tmp/lancedb_stj_$(date +%Y%m%d_%H%M).log 2>&1 &
echo "PID: $!"
```

### Verificar resultado
```bash
ulimit -n 65536
python3 -c "
import lancedb
db = lancedb.connect('lancedb_store')
t = db.open_table('jurisprudencia')
stj = t.search().where(\"doc_id LIKE 'stj-%'\", prefilter=True).limit(10000).select(['doc_id']).to_arrow()
print('STJ total:', stj.num_rows, 'docs')
"
```

### Erros conhecidos
- **403 ao baixar PDF**: Edição não existe ou ainda não foi publicada. O script pula automaticamente.
- **Edições faltantes no banco após indexação**: Verifique se o PDF foi enviado corretamente ao servidor. O script só processa edições cujo PDF está em disco.
- **`strict_completeness` RuntimeError**: Não deve mais ocorrer (`strict_completeness=False` configurado). Se ocorrer, verifique se o arquivo `update_lancedb.py` no servidor tem o parâmetro.

---

## TST — Tribunal Superior do Trabalho

### Frequência recomendada
- **Histórico**: executar uma vez (já feito para 2020–2026, ~332 jobs semanais)
- **Atualização contínua**: o scheduler do BullMQ roda automaticamente todo domingo às 4h (cron `0 4 * * 0`), indexando a semana corrente

### Como funciona
O adaptador TST (`packages/search/src/indexers/tst.ts`) acessa a API pública `jurisprudencia-backend2.tst.jus.br`. Os documentos são indexados no **Elasticsearch** (não no LanceDB) e ficam disponíveis para busca textual.

A API suporta filtro por data via `publicacaoInicial` / `publicacaoFinal`. A estratégia é dividir em **janelas semanais** para manter cada query abaixo de ~8.860 registros (limite prático antes da conexão cair).

### Indexação histórica (primeira vez ou reset)

**1. Limpar dados antigos do Elasticsearch:**
```bash
curl -s -X POST "http://localhost:9200/jurisprudencia/_delete_by_query?pretty" \
  -H "Content-Type: application/json" \
  -d '{"query": {"term": {"tribunal": "TST"}}}' | python3 -m json.tool | grep -E '"deleted"|"total"'
```

**2. Buildar e reiniciar a API:**
```bash
cd /opt/judicore
pnpm --filter @judicore/search build
pnpm --filter @judicore/api build
pm2 restart judicore-api
```

**3. Enfileirar jobs históricos:**
```bash
cd /opt/judicore/apps/api
npx tsx src/scripts/tst-historical.ts --from 2020-01-01

# Para indexar só a partir de um ano específico:
npx tsx src/scripts/tst-historical.ts --from 2023-01-01 --to 2026-12-31
```

O script enfileira um job por semana no BullMQ. Cada job processa ~7.950 acórdãos. Estimativa: ~8 min/semana → ~44h para 2020–hoje.

### Acompanhar progresso
```bash
# Jobs concluídos vs. aguardando:
redis-cli zcard bull:indexing:completed && redis-cli zcard bull:indexing:prioritized

# Jobs com falha (deve ser 0):
redis-cli zcard bull:indexing:failed

# Job sendo processado agora:
redis-cli llen bull:indexing:active

# Logs do worker:
pm2 logs judicore-api --lines 30
```

### Atualização semanal automática
O cron `0 4 * * 0` (todo domingo às 4h) já está configurado em `apps/api/src/queues/schedule-config.ts` e indexa a semana mais recente automaticamente. Nenhuma intervenção necessária.

### Para adicionar semanas manualmente (ex.: após falha):
```bash
cd /opt/judicore/apps/api
npx tsx src/scripts/tst-historical.ts --from 2026-05-01 --to 2026-05-10
```

### Verificar dados no Elasticsearch
```bash
curl -s "http://localhost:9200/jurisprudencia/_count?pretty" \
  -H "Content-Type: application/json" \
  -d '{"query": {"term": {"tribunal": "TST"}}}' | grep '"count"'
```

### Erros conhecidos
- **Conexão cai na página ~443**: Normal — limite do servidor TST (~524 MB por conexão). O adaptador tem retry automático (3 tentativas). O job termina com os docs coletados até aquele ponto.
- **`ERR_MODULE_NOT_FOUND` ao rodar tsx**: O arquivo `.ts` não existe no servidor. Crie-o usando `cat > arquivo.ts << 'EOF'` conforme documentado acima ou envie via scp.
- **Jobs na fila `prioritized` não processados**: O worker não está rodando. Verifique: `pm2 status judicore-api` e confirme que `START_WORKER=true` está no ambiente.

---

## Verificação geral do sistema

```bash
# Status dos processos:
pm2 list

# Dados no LanceDB (STF + STJ):
ulimit -n 65536
source /opt/judicore/services/search/venv/bin/activate
python3 -c "
import lancedb
db = lancedb.connect('/opt/judicore/lancedb_store')
t = db.open_table('jurisprudencia')
stf = t.search().where(\"doc_id LIKE 'stf-%'\", prefilter=True).limit(1).to_arrow()
stj = t.search().where(\"doc_id LIKE 'stj-%'\", prefilter=True).limit(1).to_arrow()
print('STF embedding:', len(stf.column('vector').to_pylist()[0]), 'dims')
print('STJ embedding:', len(stj.column('vector').to_pylist()[0]), 'dims')
"

# Dados no Elasticsearch (TST):
curl -s "http://localhost:9200/jurisprudencia/_count" \
  -H "Content-Type: application/json" \
  -d '{"query": {"term": {"tribunal": "TST"}}}' | python3 -m json.tool
```
