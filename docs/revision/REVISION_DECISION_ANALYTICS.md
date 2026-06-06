# Revision Decision Analytics

## Objetivo
O m\u00F3dulo **Revision Decision Analytics** (FASE 8.1.8) atua como o principal balan\u00E7o de qualidade do motor de *Assisted Revision*. Ele coleta passivamente o rastro das decis\u00F5es emitidas atrav\u00E9s do *Human Review Workflow* e sintetiza indicadores vitais para a calibragem do JudiAudit. 

Nenhuma pe\u00E7a jur\u00EDdica ou sugest\u00E3o \u00E9 reescrita por este m\u00F3dulo. Ele existe exclusivamente para governan\u00E7a t\u00E9cnica.

## M\u00E9tricas e C\u00E1lculo
O servi\u00E7o processa vetores de `HumanReviewDecision` (com inje\u00E7\u00E3o din\u00E2mica das categorias de `provider` e `affectedArea`) para extrair de forma c\u00EDclica e imut\u00E1vel as seguintes m\u00E9tricas (sempre blindadas contra *Zero Division Error*):

- **`approvalRate`**: `(approved / total) * 100`  
  A propor\u00E7\u00E3o de sugest\u00F5es gerativas que os usu\u00E1rios do sistema endossaram como \u00FAteis.
- **`rejectionRate`**: `(rejected / total) * 100`  
  O \u00EDndice de refuga\u00E7\u00E3o, alertando para prompt hacking inadvertido ou alucina\u00E7\u00E3o end\u00EAmica.
- **`skipRate`**: `(skipped / total) * 100`  
  Mostra a relev\u00EAncia t\u00E9cnica; um alto *skipRate* significa que o motor gerou ru\u00EDdo sem valor, mesmo n\u00E3o sendo factualmente incorreto.

## Elegibilidade Futura (Automa\u00E7\u00E3o Fase 8.2)
Para mapear de forma antecipada as Regras (`ruleCode`), \u00C1reas (`affectedArea`) e Provedores (`provider`) capazes de migrarem do fluxo "Human-in-the-loop" para "Full Automation", institui-se um helper t\u00E9cnico determin\u00EDstico: `isEligibleForFutureAutomation()`.

A regra estrita de elegibilidade \u00E9:
- `approvalRate >= 95%`
- `rejectionRate <= 5%`
- Amostragem Efetiva (`totalReviews`) `>= 20`

*Nota: Passar neste crite\u00E9rio \u00E9 apenas um gatilho referencial de BI (Business Intelligence). Sob nenhuma hip\u00F3tese a automa\u00E7\u00E3o (Auto Rewrite) \u00E9 executada nesta Fase 8.1.*

## Exemplo de Sa\u00EDda
Um relat\u00F3rio aglomerado `RevisionDecisionAnalytics` retorna um relat\u00F3rio ordenado em tr\u00EAs eixos vitais, sempre classificados por `approvalRate DESC`:
- **`topRules`**: Identifica quais regras do JudiCore produzem as instru\u00E7\u00F5es mais valiosas.
- **`topProviders`**: Decide em tempo de execu\u00E7\u00E3o quem \u00E9 o campe\u00E3o entre DeepSeek, OpenAI e Gemini.
- **`topAreas`**: Revela se a gera\u00E7\u00E3o em "DISPOSITIVO" \u00E9 melhor percebida do que a gera\u00E7\u00E3o em "FUNDAMENTA\u00C7\u00C3O", por exemplo.
