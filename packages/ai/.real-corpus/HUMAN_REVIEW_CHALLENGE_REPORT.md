# HUMAN REVIEW CHALLENGE REPORT
**Data da análise:** 06/06/2026  
**Escopo:** 51 apontamentos (HR-001 a HR-051), distribuídos em 10 documentos reais (REAL-001 a REAL-010).

---

## 1. Balanço Estatístico (Taxas de Utilidade e Ruído)

Após a revisão humana individual de todos os 51 *findings* produzidos, o resultado da acurácia e utilidade prática das IAs para o trabalho do advogado foi o seguinte:

| IA | Apontamentos | ✅ Procede (Útil) | ⚠️ Parcialmente (Precisa Ajuste) | ❌ Não procede (Ruído) |
|---|---|---|---|---|
| **DeepSeek** | 26 | 15 (58%) | 11 (42%) | 0 (0%) |
| **Gemini** | 25 | 19 (76%) | 6 (24%) | 0 (0%) |
| **Total** | 51 | 34 (67%) | 17 (33%) | 0 (0%) |

**Conclusão de Ruído:** A taxa de ruído (alucinação jurídica absoluta ou citações de fontes inexistentes) foi **ZERO** para ambos os modelos. O *Context Builder Determinístico* foi estritamente obedecido pelas IAs, que não inventaram fatos.

---

## 2. Perguntas Obrigatórias (Respostas Qualitativas)

### 2.1. Quais findings realmente ajudariam um advogado?
Os apontamentos de mais alto valor agregado vieram da detecção de falhas graves e estruturais no processo, em especial:
- **HR-025 (Gemini no REAL-004):** Identificou objetivamente uma violação constitucional (uso de salário mínimo como parâmetro de condenação), que contraria a Súmula Vinculante 4/STF. 
- **HR-009 (Gemini no REAL-002):** Localizou uma grave contradição interna na sentença do Léo Lins (fundamentar alta culpabilidade, mas depois afirmar que era "normal").
- **HR-016/HR-018 (Gemini no REAL-003):** Identificaram a citação solta do art. 332, §1º do CPC sem identificar o número do Recurso Repetitivo vinculante.
- **HR-030 (Gemini no REAL-005):** Localizou um erro temporal na metodologia de Juros e Correção após a EC 113/2021.
- **HR-032 a HR-034 (Gemini no REAL-006):** Identificou que a juíza não enfrentou teses centrais da defesa (*ne bis in idem*, suspeição, cerceamento) na seção de preliminares da sentença da Lava Jato.

### 2.2. Quais findings são apenas ruído?
Nenhum finding foi classificado como "lixo" ou "invenção" total. Contudo, houveram comportamentos limitados (classificados como Parcialmente Corretos) onde as IAs erraram o "tom" ou a natureza do documento:
- **HR-048 (DeepSeek no REAL-010):** A IA leu um artigo acadêmico de Direito como se fosse uma "peça processual" e apontou que faltavam "partes e pedidos". Foi um erro sistêmico de enquadramento de gênero textual, e não de alucinação de IA.
- **HR-043/HR-044 (DeepSeek no REAL-009):** Sugeriram reforçar a tese de condenação usando tabelas, num documento onde o juiz proferiu absolvição. O apontamento exigia subverter o mérito em vez de apenas melhorar a fundamentação.

### 2.3. Quais findings aparecem repetidamente sem gerar valor?
O **DeepSeek** apresentou um caráter mais prolixo, separando o que seria uma única observação sólida em múltiplos findings complementares que geravam redundância:
- O HR-001 e HR-004 referiam-se quase ao mesmo ponto (falta de demonstração na prescrição).
- O HR-012, HR-014 e HR-017 pulverizaram a mesma crítica sobre o lapso temporal.

### 2.4. DeepSeek está ajudando ou cansando o usuário?
O **DeepSeek Reasoner** foi sólido (zero ruído agressivo), mas o usuário precisará lidar com um certo grau de cansaço se os findings não forem deduplicados na interface. Sua utilidade plena foi de 58%, o que é bom, mas sua insistência em gerar findings redundantes exigirá maior "curadoria" por parte do advogado.

### 2.5. Gemini está ajudando ou cansando o usuário?
O **Gemini 2.5 Pro** brilhou em precisão analítica cirúrgica. Com 76% de findings plenamente corretos e apontamentos de altíssima complexidade (violações constitucionais, súmulas e contradições do juiz), o Gemini entrega altíssimo valor agregado com menos sobreposição, cansando menos o usuário e gerando oportunidades claras de recurso.

### 2.6. Qual provider gera maior utilidade prática?
O **Gemini 2.5 Pro**. Sua precisão no vocabulário jurídico brasileiro e capacidade de correlacionar fatos soltos do documento com legislações muito específicas e precedentes vinculantes mostrou maturidade técnica superior à redundância exibida pelo DeepSeek.

---

## 3. Lições Aprendidas para o Produto
1. **O Context Builder Funciona:** Fatiar documentos em janelas de interesse (palavras-chave) impediu alucinações.
2. **Identificação de Gênero:** Precisamos que a UI possua um seletor claro do gênero textual (Sentença, Apelação, Doutrina) antes da inferência, para impedir que o pipeline analise artigos doutrinários cobrando requisitos de petição inicial.
3. **Neutralidade de Mérito:** Devemos revisar os *prompts* para alertar a IA a nunca sugerir a inversão de resultado do julgado em favor da parte contrária (apenas analisar a estrutura da peça como ela existe).
