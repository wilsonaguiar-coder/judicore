# Arquitetura de Busca — Judicore

## Fontes de dados e bases de indexação

### LanceDB (busca vetorial / semântica)
Cobre **exclusivamente STF e STJ**.

- Base pré-carregada com ~540k documentos (inteiro teor + embeddings)
- Período: 1995 → dezembro/2025
- Localização no servidor: `/opt/judicore/lancedb_store` (tabela `jurisprudencia`)
- **Não indexar STF/STJ no Elasticsearch** — dados já estão aqui com cobertura total

> A tabela `tjsp_jurisprudencia` existe no LanceDB mas contém apenas ~15k docs de 2013 (dataset parcial/obsoleto). Deve ser desconsiderada. TJSP será indexado no Elasticsearch quando o adaptador for implementado.

---

### Elasticsearch (busca BM25 / keyword)
Cobre **todos os demais tribunais**: TST, TRF1-6, TJSP e demais tribunais estaduais.

| Tribunal | Adaptador | Status |
|----------|-----------|--------|
| TST | `tstAdapter` | ✅ Implementado |
| TRF1 | — | ⏳ Pendente |
| TRF2 | — | ⏳ Pendente |
| TRF3 | — | ⏳ Pendente |
| TRF4 | — | ⏳ Pendente |
| TRF5 | — | ⏳ Pendente |
| TRF6 | — | ⏳ Pendente |
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
       └─► Elasticsearch (TST, TRFs, TJs) ──► busca BM25
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

| Serviço | pm2 | Função |
|---------|-----|--------|
| `judicore-api` | id 0 | API Fastify — **não** inicia worker (requer `START_WORKER=true`) |
| `judicore-search` | id 2 | Worker BullMQ + scheduler de indexação ES |
| `judicore-web` | id 1 | Frontend Next.js |
| `judicore-search-py` | — | Serviço Python de busca vetorial no LanceDB |

**ES index template**: criado em `/opt/judicore` — garante mapeamento correto (`area: keyword`) mesmo em recriações automáticas do índice.
