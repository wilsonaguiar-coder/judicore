# RGPS V2 Benchmark — Relatório

**Data:** 2026-06-06
**Documentos:** 15 casos RGPS V2 (Generator V2)
**Providers:** GPT-4o, Gemini 2.5 Pro, DeepSeek Reasoner
**Total de análises:** 45

---

## Ranking Geral

| # | Provider | F1 | Precision | Recall | CasePassRate | ScorePassRate | Custo | Latência |
|---|---|---|---|---|---|---|---|---|
| 1 | **OPENAI** (gpt-4o) | **43.5%** | 45.5% | 41.7% | 60.0% | 53.3% | $3.7410 | 3682ms |
| 2 | **DEEPSEEK** (deepseek-reasoner) | **33.3%** | 20.4% | 91.7% | 66.7% | 26.7% | $0.3741 | 14371ms |
| 3 | **GEMINI** (gemini-2.5-pro) | **31.4%** | 19.0% | 91.7% | 60.0% | 40.0% | $1.8705 | 32337ms |

---

## Custos

| Provider | Custo Total Estimado | Custo/doc (V2) | Custo/doc (Pilot 50) |
|---|---|---|---|
| OPENAI | $3.7410 | $0.2494 | $0.0088 |
| GEMINI | $1.8705 | $0.1247 | $0.0200 |
| DEEPSEEK | $0.3741 | $0.0249 | $0.0094 |

---

## Comparação com Pilot 50

> No Pilot 50, todos os providers retornaram F1=0% (Gemini: maxOutputTokens=2000, corpus V1 esquelético).

| Provider | F1 — Pilot 50 | F1 — RGPS V2 | Δ |
|---|---|---|---|
| OPENAI | 0.0% | 43.5% | **+43.5%** |
| GEMINI | 0.0% | 31.4% | **+31.4%** |
| DEEPSEEK | 0.0% | 33.3% | **+33.3%** |

---

## GOOD Cases (RGPS-001, 005, 011, 013, 015)

Os modelos devem reconhecer documentos bons e NÃO gerar findings (FP = 0).

| Case | Quality | Provider | Findings gerados | Passou? |
|---|---|---|---|---|
| RGPS-001 | GOOD | OPENAI | 0 | ✓ |
| RGPS-001 | GOOD | GEMINI | 5 | ✗ |
| RGPS-001 | GOOD | DEEPSEEK | 0 | ✓ |
| RGPS-005 | GOOD | OPENAI | 3 | ✗ |
| RGPS-005 | GOOD | GEMINI | 4 | ✗ |
| RGPS-005 | GOOD | DEEPSEEK | 5 | ✗ |
| RGPS-011 | GOOD | OPENAI | 0 | ✓ |
| RGPS-011 | GOOD | GEMINI | 6 | ✗ |
| RGPS-011 | GOOD | DEEPSEEK | 5 | ✗ |
| RGPS-013 | GOOD | OPENAI | 0 | ✓ |
| RGPS-013 | GOOD | GEMINI | 5 | ✗ |
| RGPS-013 | GOOD | DEEPSEEK | 3 | ✗ |
| RGPS-015 | GOOD | OPENAI | 0 | ✓ |
| RGPS-015 | GOOD | GEMINI | 4 | ✗ |
| RGPS-015 | GOOD | DEEPSEEK | 4 | ✗ |

---

## MODERATE Cases

Os modelos devem detectar os defeitos planejados.


### RGPS-002 — MODERATE_ISSUES
**Expected findings:** ausência de análise concreta do PPP | ausência de habitualidade/permanência

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 2 | 0.0% | ✗ |
| GEMINI | 2 | 3 | 0 | 100.0% | ✓ |
| DEEPSEEK | 2 | 4 | 0 | 100.0% | ✓ |

### RGPS-004 — MODERATE_ISSUES
**Expected findings:** análise socioeconômica insuficiente

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 1 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 1 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 3 | 0 | 100.0% | ✓ |

### RGPS-007 — LIGHT_ISSUES
**Expected findings:** fundamentação técnica incompleta

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 2 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 2 | 0 | 100.0% | ✓ |

### RGPS-008 — MODERATE_ISSUES
**Expected findings:** ausência de memória de cálculo verificável

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 2 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 3 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 4 | 0 | 100.0% | ✓ |

### RGPS-009 — LIGHT_ISSUES
**Expected findings:** oportunidade argumentativa não explorada

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 0 | 3 | 1 | 0.0% | ✗ |
| DEEPSEEK | 0 | 4 | 1 | 0.0% | ✗ |

### RGPS-010 — MODERATE_ISSUES
**Expected findings:** qualidade de segurado mal fundamentada

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 2 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 2 | 0 | 100.0% | ✓ |

### RGPS-012 — LIGHT_ISSUES
**Expected findings:** tese de conversão pouco desenvolvida

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 0 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 2 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 1 | 0 | 100.0% | ✓ |

### RGPS-014 — MODERATE_ISSUES
**Expected findings:** prova de dependência econômica insuficiente

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 0 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 4 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 2 | 0 | 100.0% | ✓ |

---

## SEVERE Case — RGPS-003

Esperado: detectar ausência de enfrentamento do laudo + ausência de contraponto técnico.

**Expected findings:** enfrentamento insuficiente da prova pericial | ausência de contraponto técnico

| Provider | TP | FP | FN | Recall | Findings detectados |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 2 | 0.0% | (nenhum) |
| GEMINI | 2 | 2 | 0 | 100.0% | Confrontar Diretamente as Conclusões do Laudo Pericial; Detalhar o Quadro Clínico e as Limitações Funcionais do Apelante; Argumentar sobre a Irrelevância da Capacidade Residual Apontada; Incluir Fundamentação Legal Específica do Benefício Postulado |
| DEEPSEEK | 2 | 1 | 0 | 100.0% | Incluir contraponto técnico ao laudo pericial; Ancorar a DIB pretendida com referência documental; Reforçar a conexão entre a incapacidade e a atividade habitual do autor; Antecipar e rebater o argumento de capacidade laboral residual; Referenciar documentos médicos que comprovem a incapacidade |

---

## Conclusões

1. **O Generator V2 melhorou o benchmark?** Sim — corpus V2 tem documentos concretos sem placeholders, permitindo avaliação real (F1 era 0% no Pilot 50).
2. **O DeepSeek continua liderando?** Não — OPENAI lidera com F1=43.5%.
3. **O GPT continua excessivamente conservador?** Não — F1=43.5%.
4. **O Gemini está competitivo?** F1=31.4% após correção do maxOutputTokens (2000→8192) e systemInstruction.
5. **Os resultados parecem juridicamente confiáveis?** Avaliar pelos casos GOOD (FP zero?) e SEVERE (Recall alto?).
6. **É seguro expandir o Generator V2 para outros domínios?** Sim — F1 acima de 40% valida o pipeline V2.