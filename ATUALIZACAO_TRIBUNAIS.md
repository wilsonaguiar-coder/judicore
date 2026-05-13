# Atualização dos Tribunais Superiores — STF, STJ e TST

Guia operacional para atualização incremental da base de jurisprudência.

---

## Arquitetura resumida

| Tribunal | Base de dados | Método de coleta |
|----------|--------------|-----------------|
| STF | LanceDB (busca vetorial) | API pública + Chrome (bypass WAF) |
| STJ | LanceDB (busca vetorial) | PDFs baixados localmente + upload via admin dashboard ou `stj_indexar.mjs` |
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

### Estado atual (2026-05-13)
- SQLite: 1.176 registros (informativos #780–#888)
- LanceDB: ~5.534 docs STJ, última data indexada: 2026-05-06 (informativo #888)
- Edições #780–#819: PDFs obtidos localmente e indexados; edições #820–#888: indexadas progressivamente

### Por que baixar localmente?
**O servidor VPS tem o IP bloqueado pelo STJ a nível de rede** — não é bot protection, é bloqueio de ASN de datacenter. Qualquer tentativa de download direto do servidor retorna 403 ou timeout. Os PDFs precisam ser baixados em uma máquina doméstica (IP residencial).

---

### Opção A — Automatizado (`stj_indexar.mjs`) — Recomendado

O script `stj_indexar.mjs` na raiz do projeto faz tudo automaticamente: descobre a última edição indexada, baixa os PDFs novos, envia ao servidor via API e aguarda o embedding concluir.

**Pré-requisito:** definir o token de admin.

```powershell
# No terminal Windows (na raiz do projeto):
STJ_API_TOKEN=seu_token_admin node stj_indexar.mjs
```

O script:
1. Consulta `GET /api/admin/lancedb/info` para saber a última edição
2. Baixa PDFs novos de `processo.stj.jus.br` (para após 3 misses consecutivos)
3. Envia via `POST /api/admin/lancedb/stj/upload`
4. Dispara `POST /api/admin/lancedb/update` com `{ sources: ["stj"], skip_browser: true }`
5. Faz polling do job até completar

---

### Opção B — Manual via admin dashboard

#### Passo 1 — Verificar última edição indexada
Acesse `/dashboard/admin` → painel STJ → mostra última edição e data indexada.

Ou via servidor:
```bash
ulimit -n 65536
source /opt/judicore/services/search/venv/bin/activate
python3 -c "
import sqlite3, pathlib
db = pathlib.Path('/opt/judicore/_internal/data/stj_informativos/stj_informativos.db')
conn = sqlite3.connect(db)
rows = conn.execute('SELECT MAX(CAST(informativo_numero AS INTEGER)) FROM stj_informativos').fetchone()
print('Última edição no SQLite:', rows[0])
"
```

#### Passo 2 — Baixar PDFs localmente (máquina Windows/doméstica)

Na raiz do projeto existe o script `download_stj.mjs`. Edite as constantes `START` e `END`:

```javascript
// download_stj.mjs
const START = 889;  // próxima edição após a última indexada
const END = 920;    // última edição publicada (verificar em processo.stj.jus.br)
```

Execute:
```powershell
node download_stj.mjs
```

Os PDFs são salvos em `stj_pdfs/` com o formato `Informativo_NNNN.pdf`.

#### Passo 3 — Enviar PDFs ao servidor via dashboard

Acesse `/dashboard/admin` → painel STJ → **"Enviar PDFs"** → selecione os arquivos em `stj_pdfs/`.

Alternativamente, via scp:
```powershell
scp stj_pdfs\*.pdf root@2.24.75.193:/opt/judicore/_internal/data/stj_informativos/docs/
```

#### Passo 4 — Indexar via dashboard

No painel STJ do dashboard, clique em **"Indexar STJ"**. O job roda em background — a página mostra o progresso e a última data ao finalizar.

Ou via linha de comando no servidor:
```bash
cd /opt/judicore
source services/search/venv/bin/activate
PYTHONUNBUFFERED=1 ONLY_STJ=1 nohup python services/search/update_lancedb.py \
  > /tmp/lancedb_stj_$(date +%Y%m%d_%H%M).log 2>&1 &
echo "PID: $!"
```

### Como o pipeline STJ funciona internamente
O script `services/search/juris_update.py` é o motor central:
1. Detecta PDFs em `/opt/judicore/_internal/data/stj_informativos/docs/`
2. Parseia PDFs ainda não presentes no SQLite (`stj_informativos.db`)
3. Compara registros do SQLite com o LanceDB via campo `processo` — detecta registros obsoletos (`_stj_find_stale_ids`)
4. Marca registros obsoletos com `force_reindex=True` para sobrescrever dados antigos no LanceDB
5. Gera embeddings com Gemini e grava via `merge_insert` por `doc_id`

### Verificar resultado
```bash
ulimit -n 65536
source /opt/judicore/services/search/venv/bin/activate
python3 -c "
import lancedb
db = lancedb.connect('/opt/judicore/lancedb_store')
t = db.open_table('jurisprudencia')
rows = t.search().where(\"doc_id LIKE 'stj-%'\", prefilter=True).select(['doc_id', 'data_julgamento']).limit(10000).to_list()
print('STJ total:', len(rows), 'docs')
datas = sorted([r['data_julgamento'] for r in rows if r.get('data_julgamento')], reverse=True)
print('Mais recente:', datas[0] if datas else 'n/a')
"
```

### Erros conhecidos
- **Data STJ parada mesmo após indexação**: verificar se houve colisão de `doc_id` no LanceDB com dados antigos. O mecanismo `_stj_find_stale_ids` compara o campo `processo` — se os dados antigos tiverem mesmo processo, não são reindexados. Ver `juris_update.py`.
- **403 ao baixar PDF**: Edição não existe ou ainda não foi publicada. O script pula automaticamente.
- **Edições faltantes no banco após indexação**: Verifique se o PDF foi enviado ao servidor. O script só processa edições cujo PDF está em disco.

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
cd /opt/judicore/apps/api
npm run build
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
stf = t.search().where(\"doc_id LIKE 'stf-%'\", prefilter=True).select(['data_julgamento']).limit(1000000).to_list()
stj = t.search().where(\"doc_id LIKE 'stj-%'\", prefilter=True).select(['data_julgamento']).limit(100000).to_list()
print('STF:', len(stf), 'docs')
print('STJ:', len(stj), 'docs')
stj_datas = sorted([r['data_julgamento'] for r in stj if r.get('data_julgamento')], reverse=True)
print('STJ mais recente:', stj_datas[0] if stj_datas else 'n/a')
"

# Dados no Elasticsearch (TST):
curl -s "http://localhost:9200/jurisprudencia/_count" \
  -H "Content-Type: application/json" \
  -d '{"query": {"term": {"tribunal": "TST"}}}' | python3 -m json.tool
```
