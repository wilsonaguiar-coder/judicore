# JudiAudit — Status do MVP (FASE 6.0.0)

> Data: 2026-06-05 | Build: clean | Suíte: 155/155 PASS

---

## Famílias de Validação

| Família | Validator(es) | Regras Ativas |
|---------|--------------|---------------|
| Structural | structural, sentenca, civil | 15 |
| Coverage | coverage | 1 |
| Legal Contradiction | legal-contradiction | 12 |
| Request × Dispositive | request-dispositive | 5 |
| Evidence × Conclusion | evidence-conclusion | 6 |
| Criminal | criminal-sentenca, legal | 12 |
| RGPS / RPPS | legal, stance-contradiction, final | 9 |
| Trabalhista | legal, appeal, legal-contradiction, evidence-conclusion | 5 |
| Família | sentenca, coverage | 2 |
| Tributário | final, coverage | 2 |
| Consumidor | consumer | 4 |
| Ambiental | final, coverage | 2 |
| Fazenda Pública / Execução | execution | 22 |
| JEF / JEC | jef-civel | 12 |
| Jurisprudência & Stance | jurisprudence, evidence-stance, stance-contradiction, stance-consistency | 9 |
| Qualidade Argumentativa | richness, genericity, matrix-quality | 6 |
| Normas e Artigos | legal, legal_rules | 12 |

---

## Validators Ativos no Pipeline

| # | Arquivo | Integrado |
|---|---------|-----------|
| 1 | `structural.validator.ts` | sim |
| 2 | `sentenca.validator.ts` | sim |
| 3 | `criminal-sentenca.validator.ts` | sim |
| 4 | `civil.validator.ts` | sim |
| 5 | `consumer.validator.ts` | sim |
| 6 | `execution.validator.ts` | sim |
| 7 | `jef-civel.validator.ts` | sim |
| 8 | `stance-contradiction.validator.ts` | sim |
| 9 | `legal.validator.ts` | sim |
| 10 | `appeal.validator.ts` | sim |
| 11 | `jurisprudence.validator.ts` | sim |
| 12 | `genericity.validator.ts` | sim |
| 13 | `matrix-quality.validator.ts` | sim |
| 14 | `richness.validator.ts` | sim |
| 15 | `evidence-stance.validator.ts` | sim |
| 16 | `stance-consistency.validator.ts` | sim (pré-geração) |
| 17 | `coverage.validator.ts` | sim |
| 18 | `legal-contradiction.validator.ts` | sim |
| 19 | `request-dispositive.validator.ts` | sim |
| 20 | `evidence-conclusion.validator.ts` | sim |
| — | `public-law.validator.ts` | **NÃO** (Fase 2) |

**Total de validators ativos:** 20  
**Total de validators no repositório:** 21 (1 não integrado)

---

## Contagem de Regras

| Categoria | Regras |
|-----------|--------|
| Regras com `fatal: true` | ~45 |
| Regras com `fatal: false` | ~80 |
| **Total de regras ativas** | **~125** |

> Nota: algumas regras transversais (ex.: `MISSING_ESSENTIAL_TOPIC`) são reutilizadas em múltiplos domínios pelo mesmo validator.

---

## Regras Órfãs Detectadas

### Títulos sem validator que emite o código

| Código | Situação |
|--------|----------|
| `SENTENCA_MISSING_RELATORIO` | `structural.validator.ts` emite `MISSING_STRUCTURE` genérico. Código específico reservado. |
| `SENTENCA_MISSING_FUNDAMENTACAO` | Idem |
| `SENTENCA_MISSING_DISPOSITIVO` | Idem |
| `JEF_JEC_WRONG_APPEAL` | `jef-civel.validator.ts` emite `JEF_RECURSO_ERRADO`. Alias desconectado em APPEAL_RULES. |

### Regras emitidas sem título documentado

| Código | Validator |
|--------|-----------|
| `CRIMINAL_ABSOLVICAO_MISSING_ART386` | `criminal-sentenca.validator.ts:156` — falta entrada em `RULE_TITLES`. |

---

## Resultado da Suíte de Testes

| Fase | Testes | Resultado |
|------|--------|-----------|
| 5.5.2 — Coverage Validator | 8 | PASS |
| 5.6 — Coverage Expandido | integrado | PASS |
| 5.7.0 — Legal Contradiction (6 regras) | 16 | PASS |
| 5.7.1 — Hardening Legal Contradiction | integrado | PASS |
| 5.7.2 — Legal Contradiction (6 novas regras) | 12 | PASS |
| 5.8.0 — Request × Dispositive | 11 | PASS |
| 5.8.1 — Hardening Request × Dispositive | 8 | PASS |
| 5.9.0 — Evidence × Conclusion (19 testes) | 19 | PASS |
| 5.9.1 — Hardening Evidence × Conclusion (12 testes) | 12 | PASS |
| 6.0.0 — MVP Smoke (8 domínios) | 8 | PASS |
| **TOTAL** | **155** | **155/155 PASS** |

---

## Build Status

```
@judicore/ai   tsc --noEmit    → clean (0 erros)
```

> `@judicore/api` possui erros pré-existentes de conflito de versão ioredis (5.10.1 vs 5.11.0), não relacionados ao JudiAudit.

---

## Cobertura de Domínios por Família

| Domínio | Structural | Coverage | Legal Contradiction | Request×Disp | Evidence×Concl | Domain-Specific |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| RGPS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RPPS | ✓ | ✓ | — | ✓ | — | ✓ |
| Trabalhista | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Família | ✓ | ✓ | — | ✓ | — | ✓ |
| Tributário | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Consumidor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ambiental | ✓ | ✓ | — | ✓ | — | ✓ |
| Criminal | ✓ | ✓ | — | — | — | ✓ |
| Fazenda Pública | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| JEF / JEC | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Cível Geral | ✓ | fallback | ✓ | ✓ | ✓ | parcial |

---

## Fases Consolidadas neste MVP

- **5.5.2** — Coverage Validator — detecção de omissão de tema essencial
- **5.6** — Coverage expandido para 9 domínios
- **5.6.1** — Hardening do Coverage Validator
- **5.6.2** — Coverage RPPS; normalizeForCoverage
- **5.7.0** — Legal Contradiction Validator — 6 regras iniciais
- **5.7.1** — Hardening do Legal Contradiction Validator
- **5.7.2** — Legal Contradiction expandido — 6 novas regras
- **5.8.0** — Request × Dispositive Validator
- **5.8.1** — Hardening do Request × Dispositive Validator
- **5.9.0** — Evidence × Conclusion Validator — 6 regras
- **5.9.1** — Hardening do Evidence × Conclusion Validator
- **6.0.0** — MVP Consolidation — inventário, smoke tests, documentação
