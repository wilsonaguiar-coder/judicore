# Provider Evaluation Harness

## Prop\u00F3sito e Objetivo do Benchmark
O **Provider Evaluation Harness** (FASE 8.1.3) \u00E9 um mini-benchmark automatizado interno ao JudiCore. Seu \u00FAnico prop\u00F3sito \u00E9 medir, comparar e documentar a qualidade das sugest\u00F5es de corre\u00E7\u00E3o jur\u00EDdica geradas por modelos reais (OpenAI, Gemini, DeepSeek) quando submetidos a situa\u00E7\u00F5es de contradi\u00E7\u00E3o cl\u00E1ssicas.

**Ressalta-se que:**
- O benchmark **N\u00C3O** aplica altera\u00E7\u00F5es ao c\u00F3digo ou \u00E0 pe\u00E7a jur\u00EDdica original.
- O benchmark **N\u00C3O** decide magicamente qual provedor ser\u00E1 ativo em produ\u00E7\u00E3o. Ele apenas fornece uma esteira e o ferramental para testes AB.

## Casos Oficiais

A esteira inclui 4 cen\u00E1rios determin\u00EDsticos de auditoria (via `OFFICIAL_EVALUATION_CASES`):

1. **`case-001` (UNADDRESSED_MAIN_REQUEST):** Testa a obedi\u00EAncia ao Escopo. O modelo deve focar exclusivamente no dispositivo sem propor uma resolu\u00E7\u00E3o fantasiosa do m\u00E9rito.
2. **`case-002` (MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION):** Testa o discernimento L\u00F3gico. O modelo deve orientar o usu\u00E1rio a afastar o laudo ou alinhar o julgamento ao laudo.
3. **`case-003` (PRESCRIPTION_PROCEDENCE_CONTRADICTION):** Testa o Rigor Jur\u00EDdico. Condenar em pedido extinto por prescri\u00E7\u00E3o exige retifica\u00E7\u00E3o para extin\u00E7\u00E3o com resolu\u00E7\u00E3o de m\u00E9rito.
4. **`case-004` (MISSING_ESSENTIAL_TOPIC):** Testa o Risco de Alucina\u00E7\u00E3o. Em um t\u00F3pico omisso (Nexo Causal), o modelo deve orientar a cria\u00E7\u00E3o do t\u00F3pico e nunca redigi-lo com fatos inexistentes.

## M\u00E9tricas

As sugest\u00F5es retornadas pelos providers podem ser validadas numericamente (manualmente ou via auto-avalia\u00E7\u00E3o futura) seguindo as m\u00E9tricas:

- **Adherence (0-5):** O qu\u00E3o estritamente o LLM seguiu a instru\u00E7\u00E3o (Task Code).
- **Hallucination Risk (0-5):** 0 = nenhum risco (fatos 100% restritos ao contexto). 5 = inven\u00E7\u00E3o grosseira (dados, leis, s\u00FAmulas fake).
- **Usefulness (0-5):** A instru\u00E7\u00E3o final ajuda concretamente o humano a editar o trecho exato? 
- **Respects Scope (boolean):** O modelo evitou reescrever a pe\u00E7a inteira?

## Crit\u00E9rio de Aprova\u00E7\u00E3o (Gate)
A flag gen\u00E9rica `approved` \u00E9 atribu\u00EDda como **`TRUE`** se (e somente se):
- `adherence` \u2265 4
- `hallucinationRisk` \u2264 1
- `usefulness` \u2265 4
- `respectsScope` == true

## Como rodar o Harness
Para utilizar este m\u00F3dulo, instancie o `ProviderEvaluationService` injetando uma estrutura em mem\u00F3ria (`Record<string, LLMRevisionAdapter>`) contendo seus providers aut\u00EAnticos (chaves de API v\u00E1lidas). Em seguida, passe o `OFFICIAL_EVALUATION_CASES` para a fun\u00E7\u00E3o `.evaluate()`.

1. Voc\u00EA obter\u00E1 a array `ProviderEvaluationResult[]`.
2. Para registrar, preencha o bloco de m\u00E9tricas para cada index resultante e armazene este hist\u00F3rico na pr\u00F3pria pasta `docs/llm-evaluation`.
