# Arquitetura de Busca — Judicore

## Fontes de dados e bases de indexação

### LanceDB (busca vetorial / semântica)
Cobre **exclusivamente STF e STJ**.

- Base com ~573k documentos (STF ~567k + STJ ~6k) com embeddings Gemini (`gemini-embedding-001`, 768 dims)
- STF: período 1995 → 2026, última data indexada: 2026-05-12
- STJ: informativos #780–#888 (2020–2026-05-06), 1.176 registros no SQLite, ~5.534 docs no LanceDB
- Localização no servidor: `/opt/judicore/lancedb_store` (tabela `jurisprudencia`)
- **Não indexar STF/STJ no Elasticsearch** — dados já estão aqui com cobertura total

> A tabela `tjsp_jurisprudencia` foi **removida** do LanceDB (dados obsoletos de 2013). TJSP será indexado no Elasticsearch quando o adaptador for implementado.

> **Filtro de data padrão:** a busca aplica `date_from = 2020-01-01` por padrão (configurável na UI). Acórdãos STF anteriores a 2020 existem no LanceDB mas não aparecem na busca sem alterar o filtro.

---

### Elasticsearch (busca BM25 / keyword)
Cobre **todos os demais tribunais**: TST, TRT1-24, TRF1-6, TJSP e demais tribunais estaduais.

| Tribunal | Adaptador | Status |
|----------|-----------|--------|
| TST | `tstAdapter` | ✅ Implementado |
| TRT1–TRT24 | — | ⏳ Pendente |
| TRF1–TRF6 | — | ⏳ Pendente |
| TJSP | — | ⏳ Pendente |
| Demais TJs | — | ⏳ Pendente |

---

## Fluxo de busca

```
Pesquisa do usuário
       │
       ├─► LanceDB (STF + STJ) ──► busca vetorial via Python service
       │                           (http://127.0.0.1:7860)
       │
       └─► Elasticsearch (TST, TRTs, TRFs, TJs) ──► busca BM25
               │
               └─► Merge via RRF (Reciprocal Rank Fusion)
                   quando ambas as bases são consultadas
```

## Regra fundamental

> **STF e STJ → sempre LanceDB.**
> **Todos os demais tribunais → sempre Elasticsearch.**
> Nunca indexar STF/STJ no ES para evitar duplicação e desperdício de recursos.

---

## Fontes vetadas

- **DataJud (CNJ)**: retorna apenas metadados de processo (número, assunto, partes). Não contém ementa nem texto integral. **Não usar como fonte de indexação.**

---

## Infraestrutura (produção)

| id PM2 | Serviço | Função |
|--------|---------|--------|
| 4 | `judicore-api` | API Node.js (Fastify, porta 3001) + worker BullMQ (requer `START_WORKER=true`) |
| 3 | `judicore-search` | Serviço Python de busca vetorial (uvicorn, porta 7860) |
| 1 | `judicore-web` | Frontend Next.js |

**ES index template**: criado em `/opt/judicore` — garante mapeamento correto (`area: keyword`) mesmo em recriações automáticas do índice.

---

## Deploy — comandos por serviço

> O diretório `apps/api/dist/` está no `.gitignore`. Mudanças no código TypeScript da API **não são aplicadas pelo `git pull`** — é necessário recompilar no servidor.

| Serviço alterado | Comandos no servidor |
|------------------|----------------------|
| `services/search/` (Python) | `git pull && pm2 restart judicore-search` |
| `apps/api/src/` (Node.js) | `git pull && cd /opt/judicore/apps/api && npm run build && pm2 restart judicore-api` |
| `apps/web/src/` (Next.js) | `git pull && cd /opt/judicore/apps/web && npm run build && pm2 restart judicore-web` |
