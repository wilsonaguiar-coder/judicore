# JudiAudit — Matriz de Regras (FASE 6.0.0)

> Inventário técnico completo de todas as regras do sistema JudiAudit.  
> Gerado em: 2026-06-05 | Versão: MVP 6.0.0

---

## Índice

1. [Structural](#1-structural)
2. [Coverage](#2-coverage)
3. [Legal Contradiction](#3-legal-contradiction)
4. [Request × Dispositive](#4-request--dispositive)
5. [Evidence × Conclusion](#5-evidence--conclusion)
6. [Criminal](#6-criminal)
7. [RGPS](#7-rgps)
8. [RPPS](#8-rpps)
9. [Trabalhista](#9-trabalhista)
10. [Família](#10-família)
11. [Tributário](#11-tributário)
12. [Consumidor](#12-consumidor)
13. [Ambiental](#13-ambiental)
14. [Fazenda Pública / Execução](#14-fazenda-pública--execução)
15. [JEF / JEC](#15-jef--jec)
16. [Jurisprudência & Stance](#16-jurisprudência--stance)
17. [Qualidade Argumentativa](#17-qualidade-argumentativa)
18. [Normas e Artigos](#18-normas-e-artigos)

---

## 1. Structural

**Arquivo:** `structural.validator.ts`, `sentenca.validator.ts`

| Código | Título | Fatal | Descrição |
|--------|--------|-------|-----------|
| `MISSING_STRUCTURE` | Estrutura incompleta | Depende | Seção obrigatória ausente (relatório, fundamentação ou dispositivo) |
| `FORBIDDEN_STRUCTURE` | Elemento proibido para o tipo de peça | Depende | Seção incompatível com o tipo de peça detectado |
| `DESPACHO_WITH_DECISION_LANGUAGE` | Linguagem decisória em despacho | true | Despacho contém "julgo", "defiro", "indefiro" ou termos decisórios |
| `SENTENCA_MISSING_DECISION_VERB` | Verbo dispositivo ausente na sentença | true | Sentença sem "julgo", "condeno", "absolvo" etc. |
| `SENTENCA_MISSING_APPEAL_REF` | Recurso cabível não indicado na sentença | false | Sentença sem indicação do recurso cabível e prazo |
| `SENTENCA_DISPOSITIVO_VAGUE` | Dispositivo vago | false | Dispositivo sem resultado identificável |
| `SENTENCA_RELATORIO_TOO_SHORT` | Relatório muito curto | false | Relatório com menos de 200 chars |
| `SENTENCA_FUNDAMENTACAO_TOO_SHORT` | Fundamentação muito curta | false | Fundamentação com menos de 400 chars |
| `SENTENCA_DISPOSITIVO_TOO_SHORT` | Dispositivo muito curto | false | Dispositivo com menos de 50 chars |
| `SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION` | Contradição fundamentação × dispositivo | true | Fundamentação diz procedente mas dispositivo julga improcedente (ou vice-versa) |
| `FAMILY_REASONING_DISPOSITIVE_CONTRADICTION` | Contradição fundamentação × dispositivo — Guarda | true | Idem, específico para sentenças de guarda |
| `SENTENCA_MISSING_HONORARIOS` | Honorários não fixados | false | Sentença cível sem fixação de honorários (art. 85 CPC) |
| `SENTENCA_MISSING_CUSTAS` | Custas não fixadas | false | Sentença cível sem fixação de custas (art. 82 CPC) |
| `UNFILLED_TEMPLATE_PLACEHOLDERS` | Campos de template não preenchidos | false | Draft com marcadores `[CAMPO]` não substituídos |
| `EMPTY_OR_SKELETON_DRAFT` | Minuta vazia ou insuficiente | false | Draft abaixo do mínimo de conteúdo útil |

---

## 2. Coverage

**Arquivo:** `coverage.validator.ts`

| Código | Título | Fatal | Descrição |
|--------|--------|-------|-----------|
| `MISSING_ESSENTIAL_TOPIC` | Tema essencial não enfrentado | false | Domínio detectado mas tema central omitido na fundamentação |

**Domínios cobertos:** RGPS · Tributário · Família · Consumidor · RPPS · Trabalhista · Ambiental · Criminal · Fazenda Pública  
**Fallback residual:** CIVEL_GERAL (domínios não mapeados)

---

## 3. Legal Contradiction

**Arquivo:** `legal-contradiction.validator.ts`

Todas as regras: `fatal: false`

| Código | Título | Exemplo |
|--------|--------|---------|
| `PRESCRIPTION_PROCEDENCE_CONTRADICTION` | Contradição: prescrição × procedência | Fundamentação reconhece prescrição; dispositivo julga procedente |
| `STANDING_CONTRADICTION` | Contradição: ilegitimidade × decisão de mérito | Afirma ilegitimidade passiva; condena o réu |
| `LACK_OF_EVIDENCE_CONTRADICTION` | Contradição: insuficiência probatória × procedência | Diz ausência de prova; julga procedente |
| `MORAL_DAMAGE_CONTRADICTION` | Contradição: mero aborrecimento × condenação moral | Reconhece só aborrecimento; condena por dano moral |
| `EMPLOYMENT_RELATION_CONTRADICTION` | Contradição: ausência de vínculo × reconhecimento | Afasta subordinação; reconhece vínculo empregatício |
| `SPECIAL_ACTIVITY_CONTRADICTION` | Contradição: ausência de atividade especial × tempo especial | PPP insuficiente na fundamentação; tempo especial reconhecido |
| `RES_JUDICATA_MERITS_CONTRADICTION` | Contradição: coisa julgada × procedência | Reconhece coisa julgada; julga mérito |
| `LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION` | Contradição: falta de interesse × procedência | Afasta interesse de agir; julga procedente |
| `NO_DAMAGE_COMPENSATION_CONTRADICTION` | Contradição: ausência de dano × indenização | Nega dano material; condena a indenizar |
| `NO_INCAPACITY_BENEFIT_CONTRADICTION` | Contradição: ausência de incapacidade × benefício | Nega incapacidade; concede auxílio-doença |
| `NO_QUALITY_INSURED_BENEFIT_CONTRADICTION` | Contradição: ausência de qualidade de segurado × benefício | Nega qualidade de segurado; concede benefício |
| `ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION` | Contradição: nulidade do ato × manutenção | Reconhece vício de nulidade; mantém o ato |

---

## 4. Request × Dispositive

**Arquivo:** `request-dispositive.validator.ts`

Todas as regras: `fatal: false`

| Código | Título | Exemplo |
|--------|--------|---------|
| `UNADDRESSED_MAIN_REQUEST` | Pedido principal não enfrentado | Autor requer indenização; dispositivo não a menciona |
| `UNADDRESSED_SUBSIDIARY_REQUEST` | Pedido subsidiário não enfrentado | "Subsidiariamente, requer X"; dispositivo omite |
| `UNADDRESSED_INJUNCTION_REQUEST` | Pedido de tutela não enfrentado | Tutela requerida; dispositivo não decide |
| `RELIEF_NOT_REQUESTED` | Concessão não identificada nos pedidos | Dispositivo concede alimentos não pedidos |
| `INCOMPLETE_RELIEF` | Dispositivo sem parâmetros mínimos | Condena a pagar danos morais sem fixar valor |

**Proteções ativas:**
- Rejeição global (`julgo improcedentes todos os pedidos`) cancela `UNADDRESSED_MAIN_REQUEST` e `UNADDRESSED_SUBSIDIARY_REQUEST`
- Tutela absorvida pelo mérito cancela `UNADDRESSED_INJUNCTION_REQUEST`

---

## 5. Evidence × Conclusion

**Arquivo:** `evidence-conclusion.validator.ts`

Todas as regras: `fatal: false`

| Código | Título | Evidência detectada | Conclusão contraditória |
|--------|--------|---------------------|------------------------|
| `MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION` | Laudo reconhece incapacidade × benefício negado | laudo pericial / perícia médica / incapacidade laboral | improcedente / indefiro benefício |
| `SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION` | PPP comprova atividade especial × tempo especial negado | PPP / LTCAT / agente nocivo / ruído | não reconheço tempo especial / atividade comum |
| `PAYMENT_PROOF_CONTRADICTION` | Comprovante de pagamento × pagamento negado | comprovante / recibo / TED / PIX | não houve pagamento / ausência de pagamento |
| `CONTRACT_EVIDENCE_CONTRADICTION` | Contrato juntado × relação jurídica negada | contrato juntado / instrumento contratual / contrato assinado | inexistência de relação jurídica / ausência de vínculo |
| `WITNESS_OVERTIME_CONTRADICTION` | Prova testemunhal confirma jornada × horas extras negadas | testemunha confirmou / prova testemunhal / jornada extraordinária | horas extras indevidas / ausência de prova |
| `DEPENDENCY_EVIDENCE_CONTRADICTION` | Dependência econômica reconhecida × pensão negada | dependência econômica comprovada / dependente | ausência de dependência / pensão indeferida |

**Proteções ativas (5.9.1):** `evidenceNegRe` por regra — cancela se a própria prova for negativa (ex.: "perito não constatou incapacidade", "PPP não comprova", "testemunha não confirmou").

---

## 6. Criminal

**Arquivo:** `criminal-sentenca.validator.ts`, `legal.validator.ts`

| Código | Título | Fatal | Descrição |
|--------|--------|-------|-----------|
| `HC_MISSING_ORDER_VERB` | HC sem verbo dispositivo correto | true | Habeas corpus sem "concedo/denego a ordem" |
| `HC_WRONG_DISPOSITIVO` | Dispositivo de HC com linguagem incorreta | true | HC usando "julgo procedente/improcedente" |
| `CRIMINAL_MISSING_DISPOSITIVO` | Dispositivo ausente na sentença criminal | true | Sentença criminal sem ABSOLVO/CONDENO |
| `CRIMINAL_WRONG_CIVIL_VERB` | Linguagem civil em decisão criminal | true | "julgo procedente" em sentença criminal |
| `CRIMINAL_ABSOLVICAO_MISSING_ART386` | Absolvição sem art. 386 CPP | false | Absolvição sem indicação do inciso do art. 386 CPP |
| `CRIMINAL_PRESCRICAO_MISSING_ART` | Prescrição sem indicação dos artigos | false | Extinção por prescrição sem citar art. 107/109 CP |
| `CRIMINAL_DESCLASSIFICACAO_MISSING_TIPO` | Desclassificação sem novo tipo penal | false | Desclassificação sem indicar o novo tipo |
| `CRIMINAL_MISSING_DOSIMETRIA` | Dosimetria ausente ou incompleta | false | Sentença condenatória criminal sem as 3 fases |
| `CRIMINAL_MISSING_REGIME` | Regime inicial não fixado | false | Condenação sem indicação do regime inicial |
| `CRIMINAL_WRONG_APPEAL` | Via recursal incompatível com criminal | true | Apelação cível em sentença criminal |
| `CRIMINAL_MISSING_APPEAL_REF` | Recurso não indicado na sentença criminal | false | Sem indicação do prazo/recurso cabível |
| `CRIMINAL_WRONG_TERM` | Termo civil incompatível com criminal | true | "julgo improcedente" em HC ou similar |

---

## 7. RGPS

**Arquivos:** `legal.validator.ts`, `stance-contradiction.validator.ts`, `final.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `RGPS_WRONG_ARTICLE` | Artigo incorreto para o regime RGPS | true |
| `STANCE_CONTRADICTION_RGPS` | Contradição com entendimento consolidado — RGPS | true |
| `RGPS_REQUIREMENTS_INCONSISTENCY` | Inconsistência de requisitos RGPS | false |
| `NO_QUALITY_INSURED_BENEFIT_CONTRADICTION` | Ausência de qualidade de segurado × benefício | false |
| `NO_INCAPACITY_BENEFIT_CONTRADICTION` | Ausência de incapacidade × benefício por incapacidade | false |
| `MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION` | Laudo reconhece incapacidade × benefício negado | false |
| `SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION` | PPP comprova atividade especial × tempo especial negado | false |

---

## 8. RPPS

**Arquivos:** `legal.validator.ts`, `stance-contradiction.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `RPPS_WRONG_ARTICLE` | Artigo incorreto para o regime RPPS | true |
| `STANCE_CONTRADICTION_RPPS` | Contradição com entendimento consolidado — RPPS | true |

---

## 9. Trabalhista

**Arquivos:** `legal.validator.ts`, `appeal.validator.ts`, `legal-contradiction.validator.ts`, `evidence-conclusion.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `WRONG_HONORARIOS` | Base de cálculo dos honorários incorreta | true |
| `INCOMPATIBLE_APPEAL` | Recurso incompatível com rito trabalhista | true |
| `WRONG_SUPERIOR_COURT` | Tribunal superior incorreto | true |
| `EMPLOYMENT_RELATION_CONTRADICTION` | Afasta vínculo × reconhece relação | false |
| `WITNESS_OVERTIME_CONTRADICTION` | Prova testemunhal confirma jornada × horas extras negadas | false |

---

## 10. Família

**Arquivo:** `sentenca.validator.ts`, `coverage.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `FAMILY_REASONING_DISPOSITIVE_CONTRADICTION` | Contradição fundamentação × dispositivo — Guarda | true |
| `MISSING_ESSENTIAL_TOPIC` (domínio FAMÍLIA) | Tema essencial não enfrentado — Família | false |

---

## 11. Tributário

**Arquivos:** `final.validator.ts`, `coverage.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION` | Possível confusão entre decadência e prescrição tributária | false |
| `MISSING_ESSENTIAL_TOPIC` (domínio TRIBUTÁRIO) | Tema essencial não enfrentado — Tributário | false |

---

## 12. Consumidor

**Arquivo:** `consumer.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `CDC_APPLICATION_MISSING` | Aplicação do CDC não fundamentada | false |
| `INVERSAO_ONUS_SEM_FUNDAMENTO` | Inversão do ônus da prova sem fundamento | false |
| `DANO_MORAL_SEM_ANALISE_CONCRETA` | Dano moral sem análise concreta do caso | false |
| `REPETICAO_DOBRO_SEM_MAE_FE` | Repetição em dobro sem demonstração de má-fé | false |

---

## 13. Ambiental

**Arquivo:** `final.validator.ts`, `coverage.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `ENVIRONMENTAL_LIABILITY_WARNING` | Inconsistência com responsabilidade civil ambiental objetiva | false |
| `MISSING_ESSENTIAL_TOPIC` (domínio AMBIENTAL) | Tema essencial não enfrentado — Ambiental | false |

---

## 14. Fazenda Pública / Execução

**Arquivo:** `execution.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `EC_RITO_FAZENDA_IGNORADO` | Rito especial da Fazenda Pública não observado | true |
| `EC_PENHORA_SALARIO_TOTAL` | Penhora total de salário — impenhorabilidade não analisada | true |
| `EC_PRESCRICAO_INTERCORRENTE_IGNORADA` | Possível prescrição intercorrente não apreciada | true |
| `EC_EXCESSO_EXECUCAO_IGNORADO` | Excesso de execução não apreciado | true |
| `EC_JUROS_ILEGAIS` | Taxa de juros aplicada pode ser indevida | true |
| `EC_TITULO_INEXIGIVEL_IGNORADO` | Título possivelmente inexigível não analisado | true |
| `EXECUTION_MISSING_SECTION` | Seção obrigatória ausente na petição de execução | false |
| `EXECUTION_MISSING_CPC_BASIS` | Fundamento legal CPC da execução ausente | false |
| `EXECUTION_MISSING_MODALITY` | Modalidade executiva não especificada | false |
| `EXECUTION_SISBAJUD_MISSING` | Pedido de penhora via SISBAJUD ausente | false |
| `EXECUTION_MISSING_OBJECTION` | Matéria de defesa do executado não apreciada | false |
| `EC_BEM_FAMILIA_PENHORADO` | Possível penhora de bem de família | false |
| `EC_SISBAJUD_SEM_GRADACAO` | Penhora eletrônica sem ordem de preferência | false |
| `EC_RENAJUD_SEM_AVALIACAO` | Restrição de veículo sem avaliação prévia | false |
| `EC_CORRECAO_INDICE_INADEQUADO` | Índice de correção monetária inadequado | false |
| `EC_ASTREINTES_SEM_PARAMETRO` | Multa coercitiva sem parâmetros definidos | false |
| `EC_HONORARIOS_FASE_EXECUCAO` | Honorários da fase de execução não fixados | false |
| `EC_REMESSA_NECESSARIA_FAZENDA` | Remessa necessária não mencionada | false |
| `EC_EXTINCAO_SEM_CANCELAMENTO` | Extinção sem baixa das restrições | false |
| `EC_PENHORA_FATURAMENTO_SEM_LIMITE` | Penhora de faturamento sem limite percentual | false |
| `EC_PRAZO_FAZENDA_INCORRETO` | Prazo para pagamento pela Fazenda incorreto | false |
| `EC_IMPUGNACAO_SEM_EFEITO_SUSPENSIVO` | Impugnação sem análise do efeito suspensivo | false |

---

## 15. JEF / JEC

**Arquivo:** `jef-civel.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `JEF_COMPETENCIA` | Possível incompetência do Juizado Especial Federal | true |
| `JEF_VALOR_EXCEDENTE` | Valor da causa supera limite de competência do JEF | true |
| `JEF_RECURSO_ERRADO` | Via recursal incorreta — JEF exige Recurso Inominado | true |
| `JEF_PERICIA_COMPLEXA` | Perícia complexa incompatível com os Juizados | true |
| `JEF_TUTELA_SEM_FUMUS` | Tutela sem fumus boni iuris | false |
| `JEF_TUTELA_SEM_PERICULUM` | Tutela sem periculum in mora | false |
| `JEF_TUTELA_DESPROPORCIONAL` | Tutela desproporcional | false |
| `JEF_TUTELA_ARTIFICIAL` | Pedido de tutela possivelmente inadequado | false |
| `JEF_ENDERECAMENTO_ERRADO` | Endereçamento do recurso incorreto | false |
| `JEF_PRAZO_ERRADO` | Prazo recursal incorreto para o JEF | false |
| `JEF_PREPARO_ERRADO` | Preparo recursal desnecessário no JEF | false |
| `JEF_PEDIDO_INCOMPATIVEL` | Pedido incompatível com o rito dos Juizados | false |

---

## 16. Jurisprudência & Stance

**Arquivos:** `jurisprudence.validator.ts`, `evidence-stance.validator.ts`, `stance-contradiction.validator.ts`, `stance-consistency.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `JUR_MARKER_IN_DRAFT` | Marcadores de jurisprudência não substituídos | true |
| `GENERIC_JURISPRUDENCE` | Citação jurisprudencial genérica | false |
| `TRIBUNAL_MISMATCH` | Tribunal citado incompatível com a competência | false |
| `EVIDENCE_STANCE_VIOLATION` | Jurisprudência contrária sem distinguishing | true |
| `EVIDENCE_STANCE_MATRIX` | Uso indevido de jurisprudência contrária como fundamento | true |
| `STANCE_CONTRADICTION_RPPS` | Contradição com entendimento consolidado — RPPS | true |
| `STANCE_CONTRADICTION_RGPS` | Contradição com entendimento consolidado — RGPS | true |
| `STANCE_CONTRADICTION_JEF` | Contradição com entendimento consolidado — JEF | true |
| `STANCE_MISMATCH_PRE_GENERATION` | Contradição posicional detectada antes da geração | true |

---

## 17. Qualidade Argumentativa

**Arquivos:** `richness.validator.ts`, `genericity.validator.ts`, `matrix-quality.validator.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `FINAL_DRAFT_WEAK_ARGUMENTATION` | Riqueza argumentativa abaixo do mínimo | false |
| `PECA_GENERICA` | Peça com linguagem genérica | false |
| `MATRIX_INSUFFICIENT_TESES` | Número de teses insuficiente | false |
| `MATRIX_GENERIC_FATO` | Fato genérico na argumentação | false |
| `MATRIX_GENERIC_NORMA` | Norma genérica na argumentação | false |
| `MATRIX_MISSING_FIELD` | Campo obrigatório ausente na estrutura argumentativa | false |

---

## 18. Normas e Artigos

**Arquivo:** `legal.validator.ts`, `src/rules/legal_rules.ts`

| Código | Título | Fatal |
|--------|--------|-------|
| `REQUIRED_FIELD` | Informação obrigatória não identificada | true |
| `LOW_CONFIDENCE` | Classificação com baixa confiança | false |
| `RPPS_WRONG_ARTICLE` | Artigo incorreto para o regime RPPS | true |
| `RGPS_WRONG_ARTICLE` | Artigo incorreto para o regime RGPS | true |
| `WRONG_HONORARIOS` | Base de cálculo dos honorários incorreta | true |
| `WRONG_HONORARIOS_CRIMINAL` | Honorários não cabem em matéria criminal | true |
| `BLOCKED_ARTICLE` | Dispositivo revogado ou inaplicável | true |
| `PROHIBITED_TERM` | Termo proibido identificado | true |
| `TUTELA_MISSING_ART300` | Tutela sem fundamento no art. 300 CPC | false |
| `TUTELA_MISSING_PERICULUM_MORA` | Periculum in mora não demonstrado | false |
| `INCOMPATIBLE_APPEAL` | Recurso incompatível com o rito | true |
| `WRONG_SUPERIOR_COURT` | Tribunal superior incorreto | true |

---

## Sumário por Família

| Família | Validator(es) | Regras |
|---------|--------------|--------|
| Structural | structural, sentenca, civil, final | 15 |
| Coverage | coverage | 1 |
| Legal Contradiction | legal-contradiction | 12 |
| Request × Dispositive | request-dispositive | 5 |
| Evidence × Conclusion | evidence-conclusion | 6 |
| Criminal | criminal-sentenca, legal | 12 |
| RGPS | legal, stance-contradiction, final | 7 (inclui sobreposições) |
| RPPS | legal, stance-contradiction | 2 |
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

> Nota: algumas regras transversais aparecem em múltiplas famílias (ex.: `INCOMPATIBLE_APPEAL` relevante para Trabalhista e Criminal).

---

## Auditoria de Regras Órfãs

### RULE_TITLES sem validator que emite o código

| Código | Presente em | Situação |
|--------|-------------|----------|
| `SENTENCA_MISSING_RELATORIO` | STRUCTURAL_RULES + RULE_TITLES | `structural.validator.ts` emite `MISSING_STRUCTURE` genérico. Código específico reservado para versão futura. |
| `SENTENCA_MISSING_FUNDAMENTACAO` | STRUCTURAL_RULES + RULE_TITLES | Idem |
| `SENTENCA_MISSING_DISPOSITIVO` | STRUCTURAL_RULES + RULE_TITLES | Idem |
| `JEF_JEC_WRONG_APPEAL` | APPEAL_RULES + RULE_TITLES | `jef-civel.validator.ts` emite `JEF_RECURSO_ERRADO`. Alias desconectado. |

### Validators emitindo código sem RULE_TITLE

| Código | Validator | Situação |
|--------|-----------|----------|
| `CRIMINAL_ABSOLVICAO_MISSING_ART386` | `criminal-sentenca.validator.ts:156` | Código emitido mas sem entrada em `RULE_TITLES`. |

### Validators não integrados ao pipeline

| Arquivo | Status | Observação |
|---------|--------|------------|
| `public-law.validator.ts` | NÃO INTEGRADO | Planejamento estratégico Fase 2. Não cria erros em produção. |

---

*Este documento não substitui o código-fonte. Verificar `audit-report.engine.ts` e os arquivos de validator para detalhes de implementação.*
