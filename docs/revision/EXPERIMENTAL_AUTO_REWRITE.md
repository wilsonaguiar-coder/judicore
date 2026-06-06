# Experimental Auto Rewrite

## Objetivo
A Fase 8.2.0 introduz o **Experimental Auto Rewrite Draft**, um laborat\u00F3rio inicial de altera\u00E7\u00F3es ativas conduzidas pelo JudiCore. O objetivo \u00E9 gerar uma *vers\u00E3o alternativa* do documento (Rewritten Draft) aplicando exclusivamente as instru\u00E7\u00F5es emitidas por uma sugest\u00E3o j\u00E1 aprovada.

## Princ\u00EDpios de Seguran\u00E7a
Nesta fase, sob nenhuma circunst\u00E2ncia a automa\u00E7\u00E3o substitui a pe\u00E7a jur\u00EDdica de forma t\u00E1cita.

1. **Gera\u00E7\u00E3o Paralela**: O motor de reescrita cria e retorna um `RewrittenDraft` imut\u00E1vel em vari\u00E1vel de mem\u00F3ria. O `originalDraft` recebido \u00E9 preservado.
2. **Aprova\u00E7\u00E3o Obrigat\u00F3ria**: A restri\u00E7\u00E3o de governan\u00E7a (*Human-in-the-Loop*) dita que a sa\u00EDda tem a diretiva gen\u00E9rica `requiresHumanReview = true`, que n\u00E3o pode ser revogada pelo sistema.
3. **Escopo Focado (Uma Task por vez)**: A arquitetura pro\u00EDbe instru\u00E7\u00F5es passadas em lote. Cada invoca\u00E7\u00E3o repara um \u00FAnico defeito identificado (`RevisionTask`), preservando assim o estilo redacional do advogado ou juiz ao m\u00E1ximo.

## Proibi\u00E7\u00F5es de Prompt (Guardrails)
O prompt orienta estritamente os modelos (padr\u00E3o DeepSeek, fallback OpenAI) de que eles s\u00E3o **Reescritores Restritos**. Est\u00E1 explicitamente vetado:
- Mudar fatos, provas ou pedidos.
- Mudar a conclus\u00E3o do m\u00E9rito ou resultado de julgamento.
- Alterar valores e datas preexistentes.
- Inventar novas cita\u00E7\u00F5es legais, jurisprud\u00EAncia ou doutrina externa que n\u00E3o esteja no material.

## Permiss\u00F5es Exclusivas
S\u00E3o a\u00E7\u00F5es t\u00E9cnicas permitidas caso a `Suggestion` assim determine:
- Inserir trechos faltantes exigidos por lei.
- Completar o Dispositivo.
- Alinhar a fundamenta\u00E7\u00E3o \u00E0 conclus\u00E3o (elimina\u00E7\u00E3o de contradi\u00E7\u00E3o interna).

## Limita\u00E7\u00F5es Atuais
- O *Auto Rewrite* n\u00E3o est\u00E1 acoplado a salvamentos de banco de dados.
- O n\u00EDvel de ader\u00EAncia (\u00EDndice de refugo da reescrita) ter\u00E1 que ser validado posteriormente caso avance para produ\u00E7\u00E3o massiva.
