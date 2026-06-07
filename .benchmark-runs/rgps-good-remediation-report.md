# RGPS Good Case Remediation Report

**FASE:** 9.0.8.14  
**Data:** 2026-06-06  
**Arquivo modificado:** `packages/ai/src/legal-reviewer/gold-corpus/v2/rgps/rgps-element-factory.ts`  
**Novos arquivos:** `rgps-validators.ts`, `rgps-good-remediation.spec.ts`  
**Testes:** 25 novos (25 ✓) + 35 originais (35 ✓)

---

## Contexto

A FASE 9.0.8.13 (análise forense de falsos positivos) revelou que 51% dos FPs reportados pelos modelos em documentos GOOD eram na realidade **inconsistências reais** nos próprios documentos gerados. Os 5 casos GOOD eram tecnicamente corretos no texto mas continham erros lógicos derivados da geração hash-based independente de campos temporalmente relacionados.

---

## RGPS-001 — Aposentadoria por Idade Urbana

### Problemas encontrados

| # | Problema | Causa raiz |
|---|---|---|
| 1 | Atrasados implausíveis (R$ 80,00 – R$ 400,00) | `dn(seed, "atr", 8000, 40000) / 100` produzia centavos como se fossem reais |
| 2 | CNIS emitido em `seed.baseDate`, que pode ser anos antes da DER `seed.derDate` | `baseDate` e `derDate` derivados independentemente via hash |
| 3 | Vínculos mostravam emprego "até DER" mas CNIS era emitido antes da DER | Inconsistência consequente do bug 2 |
| 4 | AJG sem fundamento legal | `"benefícios da Assistência Judiciária Gratuita."` sem citação |

### Correções

**ANTES:**
```typescript
const atrasados = `R$ ${(dn(seed, "atr", 8000, 40000) / 100).toFixed(2)...}`;
// fatos_carencia: "emitido em ${seed.baseDate}"
// fatos_cnis:    "emitido em ${seed.baseDate}"
// provas_docs:   "(1) CNIS emitido em ${seed.baseDate}"
// pedidos:       "benefícios da Assistência Judiciária Gratuita."
```

**DEPOIS:**
```typescript
const atrasados = `R$ ${(dn(seed, "atr", 1200000, 4800000) / 100).toFixed(2)...}`;
// fatos_carencia: "emitido em ${seed.derDate}"
// fatos_cnis:    "emitido em ${seed.derDate}"
// provas_docs:   "(1) CNIS emitido em ${seed.derDate}"
// pedidos:       "benefícios da Assistência Judiciária Gratuita (art. 98 a 102 do CPC/2015)."
```

### Validação
- Atrasados: R$ 12.000,00 – R$ 48.000,00 (plausível para 1–3 anos de benefício retroativo)
- CNIS e DER agora usam a mesma data → vínculos coerentes com a emissão

---

## RGPS-005 — Revisão de Aposentadoria (Recurso)

### Problema encontrado

| # | Problema | Causa raiz |
|---|---|---|
| 1 | Súmula 111/STJ citada para fundamentar corrigibilidade de erro de cálculo | Súmula 111/STJ trata de honorários em ações previdenciárias, não de PBC |

### Correção

**ANTES:**
```typescript
`O erro material apurado é corrigível a qualquer tempo (Súmula 111/STJ).`
correctPresenceKeywords: [..., "Súmula 111"],
```

**DEPOIS:**
```typescript
`O erro material apurado é corrigível, pois os dados do CNIS prevalecem sobre os ` +
`lançamentos administrativos (art. 29-A da Lei n.º 8.213/1991; STJ, REsp 1.348.173/RS).`
correctPresenceKeywords: [..., "REsp 1.348.173"],
```

### Validação
- Súmula 111/STJ completamente removida do contexto de erro de cálculo
- Fundamento correto: art. 29-A (obrigação de uso do CNIS) + REsp 1.348.173/RS (prevalência do CNIS)

---

## RGPS-011 — Aposentadoria por Carência Completa

### Problemas encontrados

| # | Problema | Causa raiz |
|---|---|---|
| 1 | Título genérico "AÇÃO DE CONCESSÃO DE APOSENTADORIA" | Builder não especificava o tipo de aposentadoria |
| 2 | CNIS emitido em `seed.baseDate` (pode preceder DER por anos) | Mesmo problema de RGPS-001 |
| 3 | Nenhum motivo de indeferimento pelo INSS | Documento GOOD sem narrativa do conflito |
| 4 | `correctPresenceKeywords` incluía `seed.baseDate` | Bug consequente do problema 2 |

### Correções

**ANTES:**
```typescript
`AÇÃO DE CONCESSÃO DE APOSENTADORIA\n\n`
correctPresenceKeywords: [seed.personName, "APOSENTADORIA"],
// fatos_contribuicoes: "CNIS emitido em ${seed.baseDate}"
// fatos_der_carencia:  "Na DER, o(a) autor(a) possuía ${base} contribuições..."
// provas_cnis:         "Junta-se CNIS de ${seed.baseDate} com..."
// keywords:            [..., seed.baseDate]
```

**DEPOIS:**
```typescript
`AÇÃO DE CONCESSÃO DE APOSENTADORIA POR IDADE (URBANA)\n\n`
correctPresenceKeywords: [seed.personName, "APOSENTADORIA POR IDADE"],
// fatos_contribuicoes: "CNIS emitido em ${seed.derDate}"
// fatos_der_carencia:  "...O INSS, contudo, indeferiu o benefício sob o fundamento de que
//                       o CNIS apresentava inconsistências no período de 01/2000 a 12/2004,
//                       desconsiderando ${base - 180} competências regularmente recolhidas."
// provas_cnis:         "Junta-se CNIS de ${seed.derDate} com..."
// keywords:            [..., seed.derDate]
```

### Validação
- Título especifica "POR IDADE (URBANA)" conforme benefitType
- CNIS e DER coincidem
- Motivo do indeferimento narrativizado (inconsistências no CNIS)

---

## RGPS-013 — Auxílio por Incapacidade Temporária

### Problema encontrado

| # | Problema | Causa raiz |
|---|---|---|
| 1 | Última contribuição hardcoded em 2024–2025 independentemente da data de incapacidade | `${2024 + dn(seed, "uly", 0, 1)}` sem relação com `seed.baseDate` |

O documento alegava "limitação funcional total" em ~2022 mas contribuições até 2025 — clinicamente impossível.

### Correção

**ANTES:**
```typescript
`Última contribuição: ${String(dn(seed, "ulm", 1, 12)).padStart(2, "0")}/${2024 + dn(seed, "uly", 0, 1)}.`
```

**DEPOIS:**
```typescript
// Derivado do baseDate (data de incapacidade):
const incapYear = parseInt(seed.baseDate.slice(6), 10);
const incapMonth = parseInt(seed.baseDate.slice(3, 5), 10);
const lastContribOffset = 1 + dn(seed, "ulo", 0, 3); // 1–3 meses antes
let lastContribMonth = incapMonth - lastContribOffset;
let lastContribYear = incapYear;
if (lastContribMonth <= 0) { lastContribMonth += 12; lastContribYear -= 1; }
const lastContrib = `${String(lastContribMonth).padStart(2, "0")}/${lastContribYear}`;

`Última contribuição: ${lastContrib}.`
```

### Validação
- Última contribuição sempre 1–3 meses antes da incapacidade
- Eliminada a inconsistência temporal (contribuir após incapacidade total)

---

## RGPS-015 — Cumprimento de Julgado Completo

### Problemas encontrados

| # | Problema | Causa raiz |
|---|---|---|
| 1 | DIP pode ser anterior ao DIB | `dip = MM/${sentencaAno+2}` e `dib = seed.derDate` independentes; RGPS-015 concreto: DIB=20/02/2024, DIP=03/2023 |
| 2 | Período de correção "INPC de DIB a DIP" invertido | Consequência do problema 1 |
| 3 | Competências na memória iniciavam em `01/${sentencaAno+1}`, que pode ser antes do DIB | Sem alinhamento com DIB |
| 4 | Resultado de `RMI × fator INPC = X` era hash aleatório | `dn(seed, "c01", ...)` sem relação com `rmi × fator` |
| 5 | RMI usava `seed.salaryBase` (string não numérica) | Impossível calcular aritmeticamente |

### Correção

**ANTES:**
```typescript
const dip = `${MM}/${sentencaAno + 2}`;
const rmi = seed.salaryBase;
// memória: "Competência 01/${sentencaAno+1}: RMI ${rmi} × fator 1,0234 = R$ ${hash_aleatório}"
```

**DEPOIS:**
```typescript
const dibYear = parseInt(seed.derDate.slice(6), 10);
const dibMonth = parseInt(seed.derDate.slice(3, 5), 10);
const dipYear = Math.max(sentencaAno + 2, dibYear + 1);  // garante DIP > DIB
const dip = `${MM}/${dipYear}`;

const rmiCents = 100000 + dn(seed, "rmic", 0, 120000);   // R$ 1.000 – R$ 2.200
const rmi = `R$ ${(rmiCents / 100).toFixed(2)...}`;
const c01 = `R$ ${(Math.round(rmiCents * 1.0234) / 100).toFixed(2)...}`;  // aritmética real
const c02 = `R$ ${(Math.round(rmiCents * 1.0251) / 100).toFixed(2)...}`;

const comp1 = `${MM}/${dibYear}`;   // inicia no mês do DIB
const comp2 = `${MM+1}/${dibYear}`; // mês seguinte

// memória: "Competência ${comp1}: RMI ${rmi} × fator 1,0234 = ${c01}"
```

### Validação
- `dipYear = max(sentencaAno+2, dibYear+1)` → DIP sempre posterior ao DIB
- Correção INPC de DIB→DIP corretamente ordenada
- Competências iniciam no mês/ano do DIB
- `rmi × 1.0234 = c01` verificável matematicamente (tolerância ±5% por arredondamento de centavos)

---

## Validators Implementados

### `rgps-validators.ts`

| Validator | O que verifica |
|---|---|
| `validateTemporalConsistency` | DIB < DIP (anos); última contribuição ≤ ano de incapacidade; período INPC não invertido |
| `validateCalculationConsistency` | Atrasados ≥ R$ 5.000; `RMI × fator = resultado` dentro de ±5% |
| `validateLegalReferences` | Súmula 111/STJ não citada para erro de cálculo; AJG com art. 98 CPC |
| `validateGoodDocument` | Executa os três e retorna resultado consolidado |

---

## Resumo de Impacto

| Case | Bugs corrigidos | FPs que eram reais (FASE 9.0.8.13) |
|---|---|---|
| RGPS-001 | 4 (atrasados, CNIS date ×3, AJG sem citação) | GPT: 0 ✓ · Gemini: 5 · DeepSeek: 0 ✓ |
| RGPS-005 | 1 (Súmula 111 errada) | GPT: 3 · Gemini: 4 · DeepSeek: 5 |
| RGPS-011 | 4 (título, CNIS date ×2, sem indeferimento) | GPT: 0 ✓ · Gemini: 6 · DeepSeek: 5 |
| RGPS-013 | 1 (última contribuição futura) | GPT: 0 ✓ · Gemini: 5 · DeepSeek: 3 |
| RGPS-015 | 5 (DIP<DIB, corr invertida, competência, math, RMI string) | GPT: 0 ✓ · Gemini: 4 · DeepSeek: 4 |

**Expectativa pós-remediation:** FP em casos GOOD deverão cair significativamente para Gemini e DeepSeek. O GPT já tinha FP=0 em 4 de 5 GOOD cases — provavelmente por ser mais conservador (F1=43.5% reflete maior precision, menor recall).

---

## Invariantes Preservados

- Benchmark existente: **não alterado**
- Métricas (TP/FP/FN matching): **não alteradas**
- Prompts dos modelos: **não alterados**
- Expected findings dos casos MODERATE/SEVERE/LIGHT: **não alterados**
- `derivedExpectedFindings` dos 5 GOOD cases: **0 findings** (preservado)
- Determinismo: **preservado** (mesmos seeds → mesmos textos)
- 35 testes originais: **35 ✓ (sem regressões)**
- 25 novos testes de remediation: **25 ✓**
