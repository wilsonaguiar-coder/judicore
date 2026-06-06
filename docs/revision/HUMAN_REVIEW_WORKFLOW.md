# Human Review Workflow

## Objetivo
O **Human Review Workflow** (FASE 8.1.7) introduz a camada oficial de governan\u00E7a e decis\u00E3o humana sobre o motor de IA generativa (Assisted Revision) do JudiCore. Seu prop\u00F3sito prim\u00E1rio \u00E9 **auditar e registrar a utilidade t\u00E9cnica das sugest\u00F5es emitidas por LLMs** antes que qualquer a\u00E7\u00E3o paralela seja tomada pelo advogado ou magistrado revisor.

Este m\u00F3dulo garante ader\u00EAncia estrita ao princ\u00EDpio *Human-in-the-loop (HITL)*, proibindo altera\u00E7\u00F5es aut\u00F4nomas (*Auto Rewrite*) e assegurando o status "read-only" imposto aos LLMs sobre as pe\u00E7as jur\u00EDdicas.

## Status Poss\u00EDveis
Cada decis\u00E3o tomada no workflow transita entre 4 estados definidos pela tipagem `HumanReviewStatus`:

- **PENDING**: Status padr\u00E3o criado logo ap\u00F3s a `AssistedRevisionSuggestion` ser instanciada e apresentada na UI do humano.
- **APPROVED**: O humano acatou a instru\u00E7\u00E3o da IA como t\u00E9cnica, coesa e \u00FAtil para guiar a sua corre\u00E7\u00E3o.
- **REJECTED**: A sugest\u00E3o foi tida como incorreta, alucinat\u00F3ria ou n\u00E3o aderente \u00E0 pe\u00E7a. Um coment\u00E1rio (`notes`) geralmente acompanha para retroalimenta\u00E7\u00E3o dos prompts futuros.
- **SKIPPED**: O avaliador decidiu ignorar ou pular a sugest\u00E3o para seguir em frente com outra tarefa, sem m\u00E9rito avaliativo pr\u00E9-determinado.

## Fluxo Operacional
1. O **CorrectionPlan** emite um alerta determin\u00EDstico.
2. A **GuidedRevision** transforma o alerta em uma `RevisionTask`.
3. O **AssistedRevisionService** invoca o LLM Adapter que devolve a `AssistedRevisionSuggestion`.
4. O **HumanReviewService** enovela essa `taskId` criando uma `HumanReviewDecision` (PENDING).
5. O UI consome essa Decision. O usu\u00E1rio clica em Aprovar, Rejeitar ou Pular.
6. O m\u00E9todo correspondente `.approve()`, `.reject()` ou `.skip()` \u00E9 invocado, carimbando timestamp e o identificador do auditor humano.
7. O estado \u00E9 ent\u00E3o repassado ao **Hist\u00F3rico** para futura sincroniza\u00E7\u00E3o.

## Integra\u00E7\u00E3o Futura com Analytics
O servi\u00E7o inclui a agrega\u00E7\u00E3o instant\u00E2nea via m\u00E9todo `.buildSummary()`, que prov\u00EA o objeto `HumanReviewSummary`.  
Este resumo calcula a m\u00E9trica crucial **`approvalRate`** (Taxa de Aprova\u00E7\u00E3o) que orientar\u00E1 o banco de dados Analytics para:
- Mensurar a efic\u00E1cia isolada de modelos espec\u00EDficos (Ex: DeepSeek vs OpenAI).
- Desativar adaptadores cujas rejei\u00E7\u00F5es disparem sistematicamente.
- Monitorar quais "Regras/Alertas" est\u00E3o recebendo sugest\u00F5es in\u00FAteis, indicando falhas no *prompt engineer* da FASE 8.1.6.
