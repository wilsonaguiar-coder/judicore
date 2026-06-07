# WRITER FORENSIC AUDIT — MATRIZ DE RISCOS
## FASE 9.0.10A

**Data:** 2026-06-06  
**Escopo:** Gerador de peças jurídicas (Writer) — pós-implementação do Decision Intent Lock

---

## LEGENDA DE CLASSIFICAÇÃO

| Nível    | Critério                                                                               |
|----------|----------------------------------------------------------------------------------------|
| CRÍTICO  | Pode produzir documento juridicamente incorreto, processualmente inválido ou com fato inventado sem qualquer barreira determinística |
| ALTO     | Passa pelos validadores atuais e chega ao usuário com ressalva não-fatal               |
| MÉDIO    | Detectado por pelo menos um validador não-fatal; reduz confiança mas não bloqueia      |
| BAIXO    | Coberto por validador fatal ou bloqueado na geração; risco residual mínimo             |

---

## ESTADO ATUAL DOS VALIDADORES

### Validadores que BLOQUEIAM (fatal: true)

| Validador | O que bloqueia |
|-----------|----------------|
| `OutcomeConformanceValidator` | Dispositivo inverte a direção decisória solicitada pelo usuário |
| `SentencaValidator` BLOCO 1 | Fundamentação pro-autor + dispositivo improcedente (trabalhista) |
| `SentencaValidator` BLOCO 2 | In dubio pro reo na fundamentação + CONDENO no dispositivo |
| `SentencaValidator` BLOCO 3 | Laudo favorável a um genitor + dispositivo para o outro (família) |
| `SentencaValidator` BLOCO 4 | Autoria e materialidade comprovadas + ABSOLVO no dispositivo |
| `EvidenceStanceValidator` | Jurisprudência COUNTER_ARGUMENT sem distinguishing |
| `StructuralValidator` | Seções obrigatórias ausentes (depende do tipo de peça) |
| `CriminalSentencaValidator` | Linguagem cível em sentença criminal; ausência de dosimetria |
| `FictitiousDataValidator` | 9 nomes/números fictícios específicos em blacklist |
| `PlaceholderUnfilledValidator` | [INSERIR], [PREENCHER], [A DETERMINAR] no FINAL_DRAFT |
| `StanceAnalyzer` (pré-geração) | RPPS paridade EC 41 / RGPS carência / JEF competência |

### Validadores que ALERTAM mas não bloqueiam (fatal: false)

| Validador | Número de regras | Promoção a fatal? |
|-----------|-----------------|-------------------|
| `LegalContradictionValidator` | 12 contradições fundamentação × dispositivo | Não |
| `RequestDispositivoValidator` | 5 regras pedidos × dispositivo | Não |
| `EvidenceConclusionValidator` | 6 regras provas × conclusão | Não |
| `GenericityValidator` | Expressões genéricas (≥ 3 para alerta) | Não |
| `CoverageValidator` | Tópicos essenciais por domínio | Não |
| `RichnessValidator` | Profundidade argumentativa por domínio | Não |
| `MatrixQualityValidator` | Contagem de teses vs pedidos | Não |
| `SentencaValidator` (comprimento, vaguidade) | Mínimos por seção | Não |
| `LLM Auditor` (Fase 6) | Auditoria geral por IA (até 8.000 chars) | Não |

**Nota crítica:** O LLM Auditor pontua mas não bloqueia. Documentos com `score < 90` recebem status `APROVADA COM RESSALVAS` e chegam ao usuário.

---

## MATRIZ DE RISCOS — POR CATEGORIA

### A. Contradições internas (fundamentação × dispositivo)

**Classificação global:** ALTO

| Aspecto | Estado |
|---------|--------|
| 4 contradições estruturais bloqueiam (trabalhista, criminal, família) | Coberto — FATAL |
| 12 contradições semânticas (prescrição, ilegitimidade, insuficiência probatória, etc.) | Detectado — NÃO FATAL |
| Contradições em DECISÃO interlocutória (DEFIRO/INDEFIRO) | **Ausente** |
| Contradições em RECURSO (argumentação inversa à da decisão recorrida) | **Ausente** |
| Detecção via fallback 80%/20% quando seções sem título padrão | Frágil — falso positivo/negativo |
| Contradições em dispositivo multi-pedido (pedidos conflitantes entre si) | **Ausente** |

**Risco residual:** Um documento pode sair com fundamentação que reconhece prescrição mas condena o réu ao pagamento — validado como APROVADA COM RESSALVAS, não bloqueado.

---

### B. Afirmações sem demonstração ("restou comprovado" sem fatos)

**Classificação global:** ALTO

| Aspecto | Estado |
|---------|--------|
| 6 contradições prova × conclusão detectadas (incapacidade, PPP, pagamento, contrato, testemunho, dependência) | Detectado — NÃO FATAL |
| "Restou comprovado" / "ficou demonstrado" sem qualquer evidência concreta | **Ausente** |
| "Evidentemente" / "é notório que" como substituto de argumentação | **Ausente** |
| "Conforme amplamente demonstrado nos autos" sem nada demonstrado | **Ausente** |
| Cross-reference entre afirmações da fundamentação e fatos extraídos | **Ausente** |
| Genericity validator captura expressões genéricas, mas não "comprovado sem fato" | Parcial — NÃO FATAL |

**Risco residual:** LLM frequentemente escreve "Os documentos juntados comprovam o direito do autor" mesmo quando nenhum documento foi mencionado nos fatos extraídos.

---

### C. Jurisprudência usada apenas como ornamento

**Classificação global:** ALTO

| Aspecto | Estado |
|---------|--------|
| COUNTER_ARGUMENT sem distinguishing bloqueado | FATAL |
| Jurisprudência DISCARD não pode ser citada | FATAL (por instrução de prompt) |
| Jurisprudência FOUNDATION citada mas desconectada de qualquer tese | **Ausente** |
| Paráfrase de jurisprudência sem origem na lista fornecida | **Ausente** |
| Jurisprudência correta mas aplicada a fato errado | **Ausente** |
| Bloco de jurisprudência "decorativo" no início da fundamentação | **Ausente** |
| Número do processo/relator copiado mas ementa distorcida | Parcial — sistema instrui mas não valida |

**Risco residual:** Um bloco "Conforme entendimento consolidado do STJ (REsp nº 1.234.567, Rel. Min. [NOME])" pode aparecer sem nenhuma conexão com a tese que precede ou segue.

---

### D. Fundamentos incompatíveis com a tese

**Classificação global:** MÉDIO

| Aspecto | Estado |
|---------|--------|
| Mistura RPPS (art. 40 CF) × RGPS (art. 201 CF) | FATAL via StanceAnalyzer e ArticleContextValidator |
| Regime trabalhista + honorários art. 85 CPC | FATAL via LegalValidator |
| Recurso Ordinário vs Apelação por área | FATAL via AppealValidator |
| Legislação de época errada (lei citada para fato antes de sua vigência) | **Ausente** |
| Regime incompatível dentro de tese individual (CLT + RPPS misturados) | Parcial — verificado por classificação, não por tese |
| Norma que apoia tese oposta à pleiteada | Parcial — stance, mas não por tese individual |
| Art. 7º CF aplicado a servidor estatutário | Parcial — coberto em alguns casos |

**Risco residual:** Menor que os demais por ter múltiplas camadas, mas persiste para casos de borda (ex: contratos mistos, dual regime).

---

### E. Precedentes citados para finalidade errada

**Classificação global:** ALTO

| Aspecto | Estado |
|---------|--------|
| COUNTER_ARGUMENT apresentado como FOUNDATION | FATAL via EvidenceStanceValidator |
| Jurisprudência classificada como FOUNDATION mas usada para tese contrária | **Ausente** |
| Classificação de stance pelo LLM (EvidenceAnalyzer) pode estar errada | Risco sistêmico — não validado |
| Precedente com fato base diferente, sem distinguishing | **Ausente** |
| Tese extraída da ementa invertida no texto da peça | **Ausente** |
| Súmula citada que foi cancelada/revogada | **Ausente** (LLM pode não saber) |

**Risco residual:** Se o EvidenceAnalyzer classifica erroneamente um precedente CONTRÁRIO como FOUNDATION (erro LLM), o subsequent validator não detecta o mau uso. A stance analysis não é revisada por validador determinístico.

---

### F. Dispositivos genéricos

**Classificação global:** ALTO

| Aspecto | Estado |
|---------|--------|
| SENTENÇA: "julgo procedente o pedido" sem identificar qual | Detectado — NÃO FATAL (`SENTENCA_DISPOSITIVO_VAGUE`) |
| Criminal: CONDENO sem dosimetria / ABSOLVO sem inciso art. 386 | FATAL |
| Previdenciário: concessão sem DIB/DER | Detectado — NÃO FATAL (`INCOMPLETE_RELIEF`) |
| DECISÃO: "defiro" sem especificar o objeto da decisão | **Ausente** |
| DESPACHO: "determino o que acima" ou similar | **Ausente** |
| RECURSO: pedido recursal genérico ("que seja reformada a decisão") | **Ausente** |
| PETIÇÃO INICIAL: pedidos en masse sem individualizar cada um | Parcial — prompt instrui, não valida |
| Indenização concedida sem valor | Detectado — NÃO FATAL (`INCOMPLETE_RELIEF`) |
| Obrigação de fazer sem prazo | Detectado — NÃO FATAL (`INCOMPLETE_RELIEF`) |

**Risco residual:** DECISÃO e DESPACHO têm cobertura quase zero de validação de dispositivo.

---

### G. Falta de enfrentamento de argumentos contrários

**Classificação global:** ALTO para SENTENÇA / CRÍTICO para RECURSO

| Aspecto | Estado |
|---------|--------|
| Matrix tem campo `contraponto` + `resposta_contraponto` | Coberto na geração |
| Verificação que o contraponto foi efetivamente incorporado no draft | **Ausente** |
| SENTENÇA: argumentos da parte vencida analisados e refutados | **Ausente** |
| RECURSO: cada fundamento da decisão recorrida impugnado especificamente | LLM Auditor (não-fatal) |
| Auditor detecta "RECURSO sem identificação da decisão recorrida" | IMPORTANTE (não-fatal) |
| Art. 489, §1º CPC: omissão ao argumento de tese suficiente para reverter | **Ausente** |
| PETIÇÃO: antecipação de defesas previsíveis | **Ausente** — considerado estilístico |

**Risco residual para RECURSO:** O LLM pode gerar um recurso que ignora o fundamento central da decisão recorrida, focando em argumentos tangenciais. Nenhum validador determinístico pega isso.

---

### H. Placeholders escapando para o documento final

**Classificação global:** BAIXO

| Aspecto | Estado |
|---------|--------|
| [INSERIR], [PREENCHER], [A DETERMINAR], [VERIFICAR], [DADO NÃO FORNECIDO] | FATAL |
| Empty skeleton check (< 1500 chars + ≥ 2 placeholders) | FATAL |
| Criminal prompt proíbe dosimetria com placeholders | FATAL via prompt + criminal validator |
| Variantes como `[completar]`, `[colocar valor]`, `[inserir prazo]` | **Ausente** — regex não os cobre |
| Placeholders em português livre: "DATA A DETERMINAR", "VALOR A SER FIXADO" | **Ausente** |
| Placeholder substituído por valor genérico sem base factual ("5 anos", "R$ 5.000,00") | **Ausente** — pior que placeholder porque parece completo |

**Risco residual:** Baixo para padrões conhecidos. O risco real está no "placeholder substituído por valor inventado" — que escapa de TODOS os validadores.

---

### I. Fatos inexistentes sendo inventados (hallucination)

**Classificação global:** CRÍTICO

| Aspecto | Estado |
|---------|--------|
| Anti-fabrication protocol no system prompt | Instrução LLM — não determinística |
| Blacklist de 9 nomes/números fictícios específicos | FATAL — cobertura extremamente estreita |
| Jurisprudência deve vir da lista fornecida | Instrução LLM — não determinística |
| Nomes de testemunhas inventados | **Ausente** |
| Datas inventadas (data da dispensa, do acidente, do requerimento) | **Ausente** |
| Valores monetários inventados | **Ausente** |
| Fatos narrativos inventados (ex: "o empregado trabalhava 12 horas por dia") | **Ausente** |
| Decisões administrativas inventadas | **Ausente** |
| Cross-reference draft vs fatos extraídos | **Ausente** |
| Ementa de jurisprudência distorcida ou inventada | Instrução LLM — não determinística |

**Este é o maior risco não coberto por validação determinística.**  
O sistema depende inteiramente da fidelidade do LLM ao prompt anti-fabricação. Quando o LLM "interpola" fatos plausíveis para preencher lacunas narrativas, nenhum validador detecta.

---

### J. Conclusões sem premissas

**Classificação global:** CRÍTICO

| Aspecto | Estado |
|---------|--------|
| Coverage validator verifica presença de TÓPICOS | NÃO FATAL — tópico ≠ premissa |
| Matrix quality verifica contagem de teses | NÃO FATAL — quantidade ≠ qualidade lógica |
| "Restou demonstrado... portanto o pedido deve ser acolhido" sem qualquer fato antecedente | **Ausente** |
| Dispositivo que invoca fatos não mencionados no relatório | **Ausente** |
| Dosimetria com pena calculada sem fundamento nas circunstâncias do art. 59 CP | Parcial — prompt instrui, não valida |
| "Conforme o exposto acima" quando nada foi exposto sobre aquele ponto | **Ausente** |
| Fundamentação que conclui X quando os fatos apenas permitem Y | **Ausente** |
| Verificação estrutura: premissa → norma → aplicação → conclusão | **Ausente** |

---

## MATRIZ CONSOLIDADA POR TIPO DE PEÇA

### SENTENÇA

| Risco | Nível | Bloqueado? | Principal Gap |
|-------|-------|-----------|---------------|
| A — Contradições internas | ALTO | Parcialmente (4 padrões FATAL, 12 não-fatal) | Contradições não-fatal passam com ressalva |
| B — Afirmações sem demonstração | ALTO | Não | "Restou comprovado" sem evidência não detectado |
| C — Jurisprudência ornamental | ALTO | Parcialmente (contra uso; não conectividade) | Disconnection from tese não verificada |
| D — Fundamentos incompatíveis | MÉDIO | Parcialmente | Regime dentro de tese individual |
| E — Precedentes errados | ALTO | Parcialmente (stance errada não detectada) | Stance classification pode falhar |
| F — Dispositivo genérico | ALTO | Apenas criminal (FATAL) | Cível: não-fatal; Decisão/Despacho: ausente |
| G — Falta de enfrentamento | ALTO | Não | Argumento da parte perdedora não verificado |
| H — Placeholders | BAIXO | Sim (FATAL para padrões conhecidos) | Variantes em português livre |
| I — Fatos inventados | CRÍTICO | Não | Apenas blacklist de 9 nomes |
| J — Conclusões sem premissas | CRÍTICO | Não | Estrutura lógica não auditada |

---

### DECISÃO INTERLOCUTÓRIA

| Risco | Nível | Bloqueado? | Principal Gap |
|-------|-------|-----------|---------------|
| A — Contradições internas | ALTO | Não | Zero checks específicos para DEFIRO/INDEFIRO |
| B — Afirmações sem demonstração | ALTO | Não | Mesmo gap da sentença |
| C — Jurisprudência ornamental | MÉDIO | Parcialmente | Stance checks aplicam |
| D — Fundamentos incompatíveis | MÉDIO | Parcialmente | Checks de regime aplicam |
| E — Precedentes errados | ALTO | Parcialmente | Mesmo gap da sentença |
| F — Dispositivo genérico | CRÍTICO | Não | "Defiro" sem objeto não detectado |
| G — Falta de enfrentamento | ALTO | Não | Argumento contrário não verificado |
| H — Placeholders | BAIXO | Sim | Mesmo que sentença |
| I — Fatos inventados | CRÍTICO | Não | Mesmo gap da sentença |
| J — Conclusões sem premissas | ALTO | Não | Mesmo gap da sentença |

**Nota:** O Auditor LLM verifica "DECISÃO sem 'É o relatório. Decido.'" como IMPORTANTE — única validação específica para este tipo.

---

### DESPACHO

| Risco | Nível | Bloqueado? | Principal Gap |
|-------|-------|-----------|---------------|
| A — Contradições internas | BAIXO | N/A | Despacho não tem fundamentação de mérito |
| B — Afirmações sem demonstração | MÉDIO | Não | Despacho pode inventar situação do processo |
| C — Jurisprudência ornamental | ALTO | Não | Despacho com fundamentação indevida não bloqueado |
| D — Fundamentos incompatíveis | MÉDIO | Parcialmente | |
| E — Precedentes errados | MÉDIO | Parcialmente | |
| F — Dispositivo genérico | CRÍTICO | Não | "Determino o arquivamento nos termos acima" sem especificar |
| G — Falta de enfrentamento | N/A | N/A | Despacho não fundamenta |
| H — Placeholders | BAIXO | Sim | |
| I — Fatos inventados | CRÍTICO | Não | Despacho pode descrever situação processual inexistente |
| J — Conclusões sem premissas | CRÍTICO | Não | Despacho com "ordem" sem base no processo |

**Risco específico:** "DESPACHO com fundamentação de mérito" — o Auditor LLM classifica como CRÍTICO, mas é detecção não determinística. Se o LLM Auditor alucinonar na auditoria, o despacho passa.

---

### PETIÇÃO INICIAL

| Risco | Nível | Bloqueado? | Principal Gap |
|-------|-------|-----------|---------------|
| A — Contradições internas | ALTO | Não | Fatos × pedidos × fundamento direito |
| B — Afirmações sem demonstração | ALTO | Não | "Conforme documentos que instruem a inicial" sem documentos |
| C — Jurisprudência ornamental | ALTO | Não | Citação decorativa sem conexão à tese |
| D — Fundamentos incompatíveis | MÉDIO | Parcialmente | |
| E — Precedentes errados | ALTO | Parcialmente | Stance checks aplicam |
| F — Dispositivo genérico | ALTO | Não | Pedidos en masse sem individualizar |
| G — Falta de enfrentamento | BAIXO | N/A | Petição não precisa antecipar todas as defesas |
| H — Placeholders | BAIXO | Sim | |
| I — Fatos inventados | CRÍTICO | Não | Maior risco: inventar fatos do caso |
| J — Conclusões sem premissas | ALTO | Não | Pedido não decorre dos fatos narrados |

**Proteção existente:** Prompt específico exige 6 subtópicos romanos no DO DIREITO e identifica tutela de urgência. Mas não valida conteúdo semântico.

---

### RECURSO

| Risco | Nível | Bloqueado? | Principal Gap |
|-------|-------|-----------|---------------|
| A — Contradições internas | ALTO | Não | Recurso pode contradizer os próprios fatos do processo |
| B — Afirmações sem demonstração | ALTO | Não | |
| C — Jurisprudência ornamental | ALTO | Não | Em recurso, precedente é central — risco maior |
| D — Fundamentos incompatíveis | MÉDIO | Parcialmente | |
| E — Precedentes errados | CRÍTICO | Não | Precedente para tese errada em recurso é determinante |
| F — Dispositivo genérico | ALTO | Não | Pedido recursal vago ("que seja reformada") |
| G — Falta de enfrentamento | CRÍTICO | Não | Deve atacar cada fundamento da decisão recorrida (art. 932 CPC) |
| H — Placeholders | BAIXO | Sim | |
| I — Fatos inventados | CRÍTICO | Não | |
| J — Conclusões sem premissas | ALTO | Não | |

**Proteção existente:** Auditor LLM verifica "identificação da decisão recorrida" — IMPORTANTE (não-fatal). RECURSO sem impugnação específica pode passar.

---

## ANÁLISE DE CONFIABILIDADE DOS VALIDADORES

### Validadores determinísticos (confiáveis)

São os únicos que garantem bloqueio real. Total de regras: ~35 fatais.

**Cobertura estimada dos riscos A–J:** 40-60% dos casos mais óbvios.

### Validadores não-determinísticos (não confiáveis para bloqueio)

| Camada | Confiabilidade | Uso atual |
|--------|----------------|-----------|
| LLM Auditor (score) | 70-80% | Informa `document_confidence`, não bloqueia |
| 23 validadores não-fatais | 100% (determinístico) mas não bloqueia | Geram `APROVADA COM RESSALVAS` |
| System prompt anti-fabrication | 60-80% (estimado) | Não bloqueável deterministicamente |

### Ponto cego estrutural

A pipeline permite que documentos com os seguintes alertas não-fatais cheguem ao usuário:
- `PRESCRIPTION_PROCEDENCE_CONTRADICTION` — ação prescrita com condenação ao pagamento
- `LACK_OF_EVIDENCE_CONTRADICTION` — sem prova mas pedido acolhido
- `STANDING_CONTRADICTION` — parte ilegítima com decisão de mérito
- `UNADDRESSED_MAIN_REQUEST` — pedido principal sem resposta no dispositivo
- `INCOMPLETE_RELIEF` — concessão de benefício sem DIB/valor

Todos esses geram `APROVADA COM RESSALVAS`, não `REPROVADA`.

---

## RESPOSTAS AOS 5 PONTOS FINAIS

### 1. Quais são hoje os maiores riscos do Writer?

**Por ordem de impacto real:**

1. **Fatos inexistentes inventados** (Risk I) — o LLM interpola fatos plausíveis sem qualquer base no caso. Nenhum validador determinístico cruzaref draft vs fatos extraídos. Cobertura: 9 nomes em blacklist.

2. **Conclusões sem premissas** (Risk J) — "Restou demonstrado... portanto o pedido é procedente" sem nenhum argumento precedente. Toda a estrutura lógica fundamentação → dispositivo é auditada apenas por LLM, não por lógica determinística.

3. **Contradições internas não-fatais** (Risk A) — 12 contradições são detectadas mas não bloqueiam. Documentos com prescrição reconhecida na fundamentação e condenação no dispositivo saem como `APROVADA COM RESSALVAS`.

4. **Falta de enfrentamento de argumentos contrários** (Risk G) — especialmente em RECURSO, onde o dever de impugnar cada fundamento da decisão recorrida (art. 932 CPC) não é verificado deterministicamente.

5. **Jurisprudência ornamental** (Risk C) — citada sem conexão com qualquer tese. O sistema verifica uso CONTRÁRIO, mas não verifica relevância e conectividade de jurisprudência FOUNDATION.

---

### 2. Qual risco pode produzir documento juridicamente incorreto?

**Risk I (fatos inventados) + Risk E (precedentes errados) + Risk A quando não-fatal.**

- Um documento com fatos inventados não corresponde ao caso real. É uma falsificação — juridicamente nula.
- Um recurso que cita precedente para tese oposta ao que o precedente diz induz o tribunal em erro — erro jurídico grave.
- Uma sentença com prescrição reconhecida na fundamentação e condenação no dispositivo é jurídica e processualmente contraditória — passível de nulidade por art. 489 CPC.

---

### 3. Qual risco pode produzir documento processualmente inválido?

**Risk F (dispositivos genéricos) + Risk G (falta de enfrentamento) + Risk A (contradições fatais não capturadas).**

- Sentença sem resolver todos os pedidos individualizados — nulidade por omissão (art. 489, II, CPC).
- Sentença com fundamentação que não enfrenta argumento suficiente para mudar a decisão — nulidade por art. 489, §1º, IV, CPC.
- Decisão interlocutória com "defiro" sem objeto — processualmente indeterminada.
- Recurso sem atacar especificamente cada fundamento da decisão recorrida — não conhecimento por falta de impugnação específica (art. 932, III, CPC).
- Sentença criminal com "julgo procedente a denúncia" em vez de CONDENO/ABSOLVO — nulidade de forma.

---

### 4. Qual risco pode produzir documento aparentemente bom, mas tecnicamente vazio?

**Risk B (afirmações sem demonstração) + Risk C (jurisprudência ornamental) + Risk J (conclusões sem premissas).**

Este é o perfil de documento mais perigoso porque:
- **Parece fundamentado** — tem parágrafos longos, cita artigos, menciona jurisprudência.
- **É tecnicamente vazio** — "Restou amplamente comprovado nos autos" sem nada provado. "Conforme entendimento do STJ (REsp X)" sem conexão com a tese. "Diante do exposto, o pedido merece acolhimento" sem premissa que o sustente.
- **Passa pelos validadores** — Não há validador determinístico que cruze cada afirmação com sua evidência subjacente.
- **Pontuação LLM alta** — O LLM Auditor pode pontuar bem um texto bem redigido mesmo sem substância jurídica, pois avalia forma mais do que verdade das premissas.

---

### 5. Qual deve ser a próxima camada de validação do Writer?

#### PRIORIDADE 1 — Fundamental Integrity Validator (novo)

**Objetivo:** Verificar que cada afirmação conclusiva na fundamentação tem suporte textual no próprio documento.

Regras determinísticas:
- `UNSUBSTANTIATED_CLAIM`: "restou comprovado" / "ficou demonstrado" / "é incontroverso" ocorre sem qualquer tipo de evidência mencionada nos 500 chars precedentes (documento, laudo, testemunha, confissão, presunção legal).
- `CONCLUSION_LOOP`: o texto conclui com as mesmas palavras da premissa sem adicionar raciocínio intermediário (ex: "O direito ao benefício existe porque o segurado tem direito ao benefício").
- `FACTUAL_ASSERTION_WITHOUT_SOURCE`: fato concreto (data, valor, nome de pessoa física/jurídica não fornecida no input) aparece na peça sem bracketing `[...]`.

**Impacto:** Atinge diretamente os Risks I, J e B.

---

#### PRIORIDADE 2 — Promover contradições não-fatais a fatais

Os seguintes erros do `LegalContradictionValidator` deveriam ser fatais:
- `PRESCRIPTION_PROCEDENCE_CONTRADICTION` — prescrição reconhecida + condenação
- `STANDING_CONTRADICTION` — ilegitimidade + decisão de mérito
- `RES_JUDICATA_MERITS_CONTRADICTION` — coisa julgada + procedência
- `LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION` — falta de interesse + procedência

Esses quatro representam vícios processuais fatais em si mesmos — não deveriam gerar ressalva, deveriam bloquear.

**Impacto:** Atinge o Risk A e o Risk J.

---

#### PRIORIDADE 3 — Jurisprudence Connectivity Validator (novo)

**Objetivo:** Verificar que cada jurisprudência citada no texto aparece dentro de um bloco que contém ao menos uma das palavras-chave da tese associada (conforme a matrix).

Regra determinística:
- `JURISPRUDENCE_DISCONNECTED`: O tribunal/número/relator da jurisprudência aparece no texto, mas nos 300 chars ao redor não há nenhum dos `correctPresenceKeywords` da tese da matrix associada.

**Impacto:** Atinge o Risk C e E.

---

#### PRIORIDADE 4 — Recurso Impugnation Validator (novo para RECURSO)

**Objetivo:** Verificar que o recurso ataca os fundamentos da decisão recorrida.

Regra determinística:
- `RECURSO_WITHOUT_IMPUGNATION`: A peça é tipo RECURSO e não contém nenhuma referência a "decisão recorrida" / "sentença recorrida" + nenhuma das seguintes expressões de impugnação: "equivocado", "incorreto", "não merece prosperar", "data venia", "com a devida vênia", "em desacordo", "contraria a jurisprudência".

**Impacto:** Atinge o Risk G especificamente para RECURSO.

---

#### PRIORIDADE 5 — Promoter: non-fatal → fatal para DECISÃO/DESPACHO

O `INCOMPLETE_RELIEF` e `UNADDRESSED_MAIN_REQUEST` deveriam ser fatais quando o tipo de peça for DECISAO ou DESPACHO, pois esses documentos têm dispositivos obrigatoriamente específicos.

---

## SUMÁRIO EXECUTIVO

| # | Risco | Nível | Coberto? | Próxima Ação |
|---|-------|-------|---------|--------------|
| I | Fatos inventados (hallucination) | **CRÍTICO** | **NÃO** | Fundamental Integrity Validator |
| J | Conclusões sem premissas | **CRÍTICO** | **NÃO** | Fundamental Integrity Validator |
| A | Contradições internas (não-fatais) | **ALTO** | Parcial | Promover 4 regras a FATAL |
| G | Falta de enfrentamento (RECURSO) | **CRÍTICO** | **NÃO** | Recurso Impugnation Validator |
| F | Dispositivos genéricos (DECISÃO/DESPACHO) | **CRÍTICO** | **NÃO** | Promover INCOMPLETE_RELIEF a FATAL |
| C | Jurisprudência ornamental | **ALTO** | Parcial | Jurisprudence Connectivity Validator |
| E | Precedentes citados errados | **ALTO** | Parcial | Jurisprudence Connectivity Validator |
| B | Afirmações sem demonstração | **ALTO** | **NÃO** | Fundamental Integrity Validator |
| D | Fundamentos incompatíveis | **MÉDIO** | Parcial | Manutenção atual suficiente |
| H | Placeholders escapando | **BAIXO** | Sim | Ampliar lista de variantes em PT |

**A próxima camada prioritária é o Fundamental Integrity Validator** — único que ataca simultaneamente os três riscos CRÍTICOS não cobertos (I, J, B).
