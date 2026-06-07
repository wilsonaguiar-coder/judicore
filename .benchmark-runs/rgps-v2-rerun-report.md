# RGPS V2 Re-Run — Relatório (pós-remediation FASE 9.0.8.14)

**Data:** 2026-06-06
**Baseline:** FASE 9.0.8.12 (run original — documentos GOOD com erros lógicos)
**Esta rodada:** pós-remediation (FASE 9.0.8.14 — 5 GOOD cases corrigidos)
**Total de análises:** 45 (15 docs × 3 providers)

---

## 1. Ranking Novo

| # | Provider | F1 | Precision | Recall | CasePassRate | ScorePassRate | Custo | Latência |
|---|---|---|---|---|---|---|---|---|
| 1 | **OPENAI** (gpt-4o) | **47.1%** | 80.0% | 33.3% | 53.3% | 53.3% | $3.7419 | 2092ms |
| 2 | **GEMINI** (gemini-2.5-pro) | **31.4%** | 19.0% | 91.7% | 60.0% | 26.7% | $1.8710 | 30885ms |
| 3 | **DEEPSEEK** (deepseek-reasoner) | **28.6%** | 17.2% | 83.3% | 60.0% | 26.7% | $0.3742 | 12766ms |

---

## 2. Antes × Depois (FASE 9.0.8.12 → FASE 9.0.8.15)

| Provider | F1 antes | F1 depois | Δ F1 | Precision antes | Precision depois | Δ Precision | Recall antes | Recall depois | Δ Recall | GOOD FP antes | GOOD FP depois |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **OPENAI** | 43.5% | 47.1% | +3.6pp | 45.5% | 80.0% | +34.5pp | 41.7% | 33.3% | -8.3pp | 3 | 0 |
| **GEMINI** | 31.4% | 31.4% | -0.0pp | 19.0% | 19.0% | -0.0pp | 91.7% | 91.7% | -0.0pp | 24 | 22 |
| **DEEPSEEK** | 33.3% | 28.6% | -4.8pp | 20.4% | 17.2% | -3.1pp | 91.7% | 83.3% | -8.3pp | 17 | 18 |

---

## 3. Análise dos GOOD Cases (antes × depois)

### RGPS-001
| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | ✓ | ✓ | — |
| GEMINI | 5 | 4 | ✗ | ✗ | Reforçar a Evidente Ilegalidade do Indeferimento Administrativo; Incluir Memória de Cálculo das Parcelas Vencidas; Apresentar Quadro Resumo do Tempo de Contribuição; Fundamentar Faticamente o Pedido de Justiça Gratuita |
| DEEPSEEK | 0 | 5 | ✓ | ✗ | Incluir quadro demonstrativo da carência e do tempo de contribuição; Apresentar memória de cálculo da RMI e das parcelas vencidas; Ancorar a idade do autor na DER com referência documental; Referenciar a carta de indeferimento do INSS como prova do reconhecimento da carência; Antecipar possível contestação sobre a qualidade de segurado na DER |

### RGPS-005
| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |
|---|---|---|---|---|---|
| OPENAI | 3 | 0 | ✗ | ✓ | — |
| GEMINI | 4 | 4 | ✗ | ✗ | Incluir Tabela Comparativa dos Salários de Contribuição; Apresentar Memória de Cálculo da RMI Revisada e dos Atrasados; Detalhar o Fundamento da Sentença Recorrida para Refutá-lo Diretamente; Referenciar Expressamente o Processo Administrativo |
| DEEPSEEK | 5 | 5 | ✗ | ✗ | Demonstrar a divergência salarial com quadro comparativo detalhado; Apresentar memória de cálculo do impacto na RMI e dos atrasados; Fixar a DIB (Data de Início do Benefício) para cálculo dos atrasados; Reforçar a prevalência do CNIS sobre os lançamentos administrativos com base no art. 29-A da Lei 8.213/1991; Antecipar possível contestação do INSS sobre a validade dos dados do CNIS |

### RGPS-011
| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | ✓ | ✓ | — |
| GEMINI | 6 | 5 | ✗ | ✗ | Demonstrar o Cumprimento do Requisito Etário; Refutar Proativamente o Motivo do Indeferimento Administrativo; Referenciar e Juntar a Carta de Indeferimento do Benefício; Incluir Memória de Cálculo da Renda Mensal Inicial (RMI); Fundamentar o Pedido de Assistência Judiciária Gratuita |
| DEEPSEEK | 5 | 0 | ✗ | ✓ | — |

### RGPS-013
| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | ✓ | ✓ | — |
| GEMINI | 5 | 5 | ✗ | ✗ | Expor e Refutar o Motivo do Indeferimento Administrativo; Detalhar a Conexão Causal entre a Patologia e a Incapacidade Laboral Específica; Justificar a Data de Início do Benefício (DIB) Pleiteada; Fundamentar Expressamente a Manutenção da Qualidade de Segurado; Fundamentar o Pedido de Assistência Judiciária Gratuita |
| DEEPSEEK | 3 | 5 | ✗ | ✗ | Demonstrar a qualidade de segurado na data da incapacidade; Apresentar memória de cálculo dos atrasados; Ancorar a data do laudo médico e exames com referência documental; Reforçar a conexão entre a incapacidade e a atividade profissional; Antecipar contestação sobre capacidade laboral residual |

### RGPS-015
| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | ✓ | ✓ | — |
| GEMINI | 4 | 4 | ✗ | ✗ | Esclarecer a Relação entre a Concessão Administrativa e a DIB Judicial; Especificar a Natureza e o Fundamento do Pedido de Honorários; Incluir Fundamento Legal para o Cumprimento de Sentença; Referenciar Expressamente os Documentos Essenciais Anexados |
| DEEPSEEK | 4 | 3 | ✗ | ✗ | Demonstrar a qualidade de segurado na DIB; Detalhar a memória de cálculo com todas as competências; Antecipar a prescrição quinquenal das parcelas anteriores ao ajuizamento |

---

### Análise qualitativa dos FP remanescentes nos GOOD cases

Os FP listados abaixo devem ser classificados como:
- **A** — FP inválido (modelo alucinou)  
- **B** — Melhoria legítima (o modelo identificou uma melhoria real não prevista)  
- **C** — Problema metodológico / documento ainda apresenta falha  
- **D** — Problema de prompt (modelo mal calibrado)  

**RGPS-001 × GEMINI** — 4 FP:
  - "Reforçar a Evidente Ilegalidade do Indeferimento Administrativo" → *[classificar manualmente: A/B/C/D]*
  - "Incluir Memória de Cálculo das Parcelas Vencidas" → *[classificar manualmente: A/B/C/D]*
  - "Apresentar Quadro Resumo do Tempo de Contribuição" → *[classificar manualmente: A/B/C/D]*
  - "Fundamentar Faticamente o Pedido de Justiça Gratuita" → *[classificar manualmente: A/B/C/D]*

**RGPS-001 × DEEPSEEK** — 5 FP:
  - "Incluir quadro demonstrativo da carência e do tempo de contribuição" → *[classificar manualmente: A/B/C/D]*
  - "Apresentar memória de cálculo da RMI e das parcelas vencidas" → *[classificar manualmente: A/B/C/D]*
  - "Ancorar a idade do autor na DER com referência documental" → *[classificar manualmente: A/B/C/D]*
  - "Referenciar a carta de indeferimento do INSS como prova do reconhecimento da carência" → *[classificar manualmente: A/B/C/D]*
  - "Antecipar possível contestação sobre a qualidade de segurado na DER" → *[classificar manualmente: A/B/C/D]*

**RGPS-005 × GEMINI** — 4 FP:
  - "Incluir Tabela Comparativa dos Salários de Contribuição" → *[classificar manualmente: A/B/C/D]*
  - "Apresentar Memória de Cálculo da RMI Revisada e dos Atrasados" → *[classificar manualmente: A/B/C/D]*
  - "Detalhar o Fundamento da Sentença Recorrida para Refutá-lo Diretamente" → *[classificar manualmente: A/B/C/D]*
  - "Referenciar Expressamente o Processo Administrativo" → *[classificar manualmente: A/B/C/D]*

**RGPS-005 × DEEPSEEK** — 5 FP:
  - "Demonstrar a divergência salarial com quadro comparativo detalhado" → *[classificar manualmente: A/B/C/D]*
  - "Apresentar memória de cálculo do impacto na RMI e dos atrasados" → *[classificar manualmente: A/B/C/D]*
  - "Fixar a DIB (Data de Início do Benefício) para cálculo dos atrasados" → *[classificar manualmente: A/B/C/D]*
  - "Reforçar a prevalência do CNIS sobre os lançamentos administrativos com base no art. 29-A da Lei 8.213/1991" → *[classificar manualmente: A/B/C/D]*
  - "Antecipar possível contestação do INSS sobre a validade dos dados do CNIS" → *[classificar manualmente: A/B/C/D]*

**RGPS-011 × GEMINI** — 5 FP:
  - "Demonstrar o Cumprimento do Requisito Etário" → *[classificar manualmente: A/B/C/D]*
  - "Refutar Proativamente o Motivo do Indeferimento Administrativo" → *[classificar manualmente: A/B/C/D]*
  - "Referenciar e Juntar a Carta de Indeferimento do Benefício" → *[classificar manualmente: A/B/C/D]*
  - "Incluir Memória de Cálculo da Renda Mensal Inicial (RMI)" → *[classificar manualmente: A/B/C/D]*
  - "Fundamentar o Pedido de Assistência Judiciária Gratuita" → *[classificar manualmente: A/B/C/D]*

**RGPS-013 × GEMINI** — 5 FP:
  - "Expor e Refutar o Motivo do Indeferimento Administrativo" → *[classificar manualmente: A/B/C/D]*
  - "Detalhar a Conexão Causal entre a Patologia e a Incapacidade Laboral Específica" → *[classificar manualmente: A/B/C/D]*
  - "Justificar a Data de Início do Benefício (DIB) Pleiteada" → *[classificar manualmente: A/B/C/D]*
  - "Fundamentar Expressamente a Manutenção da Qualidade de Segurado" → *[classificar manualmente: A/B/C/D]*
  - "Fundamentar o Pedido de Assistência Judiciária Gratuita" → *[classificar manualmente: A/B/C/D]*

**RGPS-013 × DEEPSEEK** — 5 FP:
  - "Demonstrar a qualidade de segurado na data da incapacidade" → *[classificar manualmente: A/B/C/D]*
  - "Apresentar memória de cálculo dos atrasados" → *[classificar manualmente: A/B/C/D]*
  - "Ancorar a data do laudo médico e exames com referência documental" → *[classificar manualmente: A/B/C/D]*
  - "Reforçar a conexão entre a incapacidade e a atividade profissional" → *[classificar manualmente: A/B/C/D]*
  - "Antecipar contestação sobre capacidade laboral residual" → *[classificar manualmente: A/B/C/D]*

**RGPS-015 × GEMINI** — 4 FP:
  - "Esclarecer a Relação entre a Concessão Administrativa e a DIB Judicial" → *[classificar manualmente: A/B/C/D]*
  - "Especificar a Natureza e o Fundamento do Pedido de Honorários" → *[classificar manualmente: A/B/C/D]*
  - "Incluir Fundamento Legal para o Cumprimento de Sentença" → *[classificar manualmente: A/B/C/D]*
  - "Referenciar Expressamente os Documentos Essenciais Anexados" → *[classificar manualmente: A/B/C/D]*

**RGPS-015 × DEEPSEEK** — 3 FP:
  - "Demonstrar a qualidade de segurado na DIB" → *[classificar manualmente: A/B/C/D]*
  - "Detalhar a memória de cálculo com todas as competências" → *[classificar manualmente: A/B/C/D]*
  - "Antecipar a prescrição quinquenal das parcelas anteriores ao ajuizamento" → *[classificar manualmente: A/B/C/D]*

---

## 4. SEVERE Case — RGPS-003

Esperado: detectar **enfrentamento insuficiente da prova pericial** + **ausência de contraponto técnico**.
**Expected:** enfrentamento insuficiente da prova pericial | ausência de contraponto técnico

| Provider | TP | FP | FN | Recall | Passou? | Findings detectados |
|---|---|---|---|---|---|---|
| OPENAI | 2 | 1 | 0 | 100.0% | ✓ | Demonstração da incapacidade laboral; Fundamentação legal para concessão do benefício por incapacidade; Antecipação de argumentos contrários sobre capacidade laboral residual |
| GEMINI | 2 | 0 | 0 | 100.0% | ✓ | Desenvolver a impugnação técnica ao laudo pericial; Contrastar o laudo judicial com o conjunto probatório dos autos; Incluir fundamento jurídico sobre a livre valoração da prova; Contextualizar a incapacidade com as atividades habituais do segurado |
| DEEPSEEK | 2 | 3 | 0 | 100.0% | ✓ | Incluir contraponto técnico ao laudo pericial; Ancorar a DIB com referência documental; Demonstrar a qualidade de segurado na DER; Antecipar contestação sobre capacidade laboral residual; Incluir demonstração da carência |

---

## 5. Demais Casos (MODERATE / LIGHT)


### RGPS-002 — MODERATE_ISSUES
**Expected:** ausência de análise concreta do PPP | ausência de habitualidade/permanência

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 2 | 0.0% | ✗ |
| GEMINI | 2 | 2 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 3 | 1 | 50.0% | ✗ |

### RGPS-004 — MODERATE_ISSUES
**Expected:** análise socioeconômica insuficiente

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 3 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 3 | 0 | 100.0% | ✓ |

### RGPS-006 — MODERATE_ISSUES
**Expected:** prova rural insuficientemente demonstrada

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 0 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 1 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 3 | 0 | 100.0% | ✓ |

### RGPS-007 — LIGHT_ISSUES
**Expected:** fundamentação técnica incompleta

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 4 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 2 | 0 | 100.0% | ✓ |

### RGPS-008 — MODERATE_ISSUES
**Expected:** ausência de memória de cálculo verificável

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 4 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 4 | 0 | 100.0% | ✓ |

### RGPS-009 — LIGHT_ISSUES
**Expected:** oportunidade argumentativa não explorada

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 0 | 3 | 1 | 0.0% | ✗ |
| DEEPSEEK | 0 | 4 | 1 | 0.0% | ✗ |

### RGPS-010 — MODERATE_ISSUES
**Expected:** qualidade de segurado mal fundamentada

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 3 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 1 | 0 | 100.0% | ✓ |

### RGPS-012 — LIGHT_ISSUES
**Expected:** tese de conversão pouco desenvolvida

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 0 | 0 | 1 | 0.0% | ✗ |
| GEMINI | 1 | 1 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 3 | 0 | 100.0% | ✓ |

### RGPS-014 — MODERATE_ISSUES
**Expected:** prova de dependência econômica insuficiente

| Provider | TP | FP | FN | Recall | Passou? |
|---|---|---|---|---|---|
| OPENAI | 1 | 0 | 0 | 100.0% | ✓ |
| GEMINI | 1 | 4 | 0 | 100.0% | ✓ |
| DEEPSEEK | 1 | 4 | 0 | 100.0% | ✓ |

---

## 6. Conclusões

1. **A remediation reduziu FP nos GOOD cases?**
   - GPT: 0 FP total em GOOD (antes: 3) — manteve ou melhorou
   - Gemini: 22 FP total em GOOD (antes: 24) — reduziu (−2)
   - DeepSeek: 18 FP total em GOOD (antes: 17) — aumentou (+1)

2. **Gemini melhorou?** Precision: 19.0% → 19.0% (-0.0pp). F1: 31.4% → 31.4% (-0.0pp).
3. **DeepSeek melhorou?** Precision: 20.4% → 17.2% (-3.1pp). F1: 33.3% → 28.6% (-4.8pp).
4. **GPT manteve precisão?** Precision: 45.5% → 80.0% (+34.5pp). F1: 43.5% → 47.1% (+3.6pp).
5. **GPT detectou RGPS-003 (SEVERE)?** Sim — TP=2, Recall=100.0%
6. **Gemini detectou RGPS-003 (SEVERE)?** Sim — TP=2, Recall=100.0%
7. **DeepSeek detectou RGPS-003 (SEVERE)?** Sim — TP=2, Recall=100.0%
8. **É seguro expandir o Generator V2 para outros domínios?** Sim — provider líder com F1=47.1% (acima de 40%). Documentos GOOD agora logicamente consistentes.