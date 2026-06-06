# Automatic Re-Audit

## Objetivo
A Fase 8.2.1 implementa o m\u00F3dulo **Automatic Re-Audit**, que \u00E9 acionado ap\u00F3s uma reescrita experimental. Seu \u00FAnico objetivo \u00E9 medir matematicamente o *impacto jur\u00EDdico* das a\u00E7\u00F5es executadas pela IA Generativa.
N\u00E3o se trata de uma aplica\u00E7\u00E3o ou salvamento: o documento s\u00F3 passa por uma r\u00E9plica do gasoduto de auditoria padr\u00E3o.

## Fluxo Operacional
1. O texto original (`originalDraft`) passa pela `AuditService` \u2192 *Audit A*.
2. O texto reescrito (`rewrittenDraft`) gerado pelo `RewriteService` passa pela `AuditService` \u2192 *Audit B*.
3. O `ReAuditService` emparelha A e B, extraindo Deltas absolutos.
4. O resultado \u00E9 condensado no `ReAuditResult` para armazenamento secund\u00E1rio (Log de Efetividade).

## M\u00E9tricas Extra\u00EDdas
O processo analisa agressivamente tr\u00EAs vari\u00E1veis do `AuditReport`:
- **`scoreDelta`**: `scoreAfter - scoreBefore` (Desejado \u00E9 positivo).
- **`fatalDelta`**: `fatalAfter - fatalBefore` (Desejado \u00E9 negativo).
- **`warningsDelta`**: `warningsAfter - warningsBefore` (Desejado \u00E9 negativo).

## Crit\u00E9rios de Classifica\u00E7\u00E3o (Deltas)
As flags booleanas de governan\u00E7a indicam o saldo final da auto-reescrita:

- **`improved`**: Acontece se a pe\u00E7a se curou (*score aumentou, erro fatal sumiu, ou warning sumiu*).
- **`regressed`**: Acontece se a IA introduziu novos problemas (*score caiu, IA criou contradi\u00E7\u00E3o que virou erro fatal novo, ou warning explodiu*).

**Empates**: Em caso de completa igualdade (*0 Deltas em tudo*), o status `improved` ser\u00E1 `false` e `regressed` ser\u00E1 `false`. A pe\u00E7a est\u00E1 inerte, indicando falha na efetividade do LLM que tentou reparar e ignorou, ou gastou tokens desnecessariamente sem efeito material na malha de c\u00E1lculo do JudiCore.

## Limita\u00E7\u00F5es
- O Re-Audit cria overhead computacional de CPU porque re-instancia toda a \u00E1rvore l\u00F3gica de valida\u00E7\u00E3o em cima de um rascunho de IA (que pode ser lixo). Por isso ele ocorre ap\u00F3s a automa\u00E7\u00E3o isolada e deve idealmente rodar ass\u00EDncrono na malha da aplica\u00E7\u00E3o hospedeira (Worker Threads).
