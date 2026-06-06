# DRAFT VERSIONING & TIMELINE (FASE 8.4.0)

## Objetivo
Estabelecer um controle formal de vers\u00F5es para os documentos em processo de revis\u00E3o (Drafts) e criar uma trilha do tempo (Timeline) que consolida os eventos ocorridos na `ReviewSession`.

## Arquitetura de Vers\u00F5es

O sistema adota um modelo onde o \textbf{Draft Original} continua intoc\u00E1vel no n\u00EDvel da \`ReviewSession\`. A tabela de vers\u00F5es (\`ReviewDraftVersion\`) espelha a evolu\u00E7\u00E3o da pe\u00E7a:

1. **ORIGINAL**: Criado no exato momento da instancia\u00E7\u00E3o da \`ReviewSession\`. Serve como a linha de base inalter\u00E1vel (vers\u00E3o 1).
2. **REWRITE**: Qualquer a\u00E7\u00E3o que engatilhe o \`RewriteService\` ir\u00E1 gerar um novo registro na tabela de vers\u00F5es vinculada \u00E0 \`ReviewSession\`. N\u00E3o destr\u00F3i vers\u00F5es passadas.

## Vers\u00E3o Recomendada (Recommended Version)
O usu\u00E1rio (Humano) ou o pr\u00F3prio sistema (via decis\u00E3o de m\u00E9tricas da IA) pode rotular uma vers\u00E3o como a **Recomendada** (\`isRecommended = true\`).
* Apenas **uma** vers\u00E3o pode ter essa flag simultaneamente.
* **Isso n\u00E3o publica a vers\u00E3o no banco central** (\`Document\`). Serve estritamente para o escopo de rascunhos.

## Restri\u00E7\u00F5es (Limita\u00E7\u00F5es)
* Esta fase ainda \textbf{N\u00C3O} sincroniza o \`ReviewDraftVersion\` recomendado de volta para a entidade original do neg\u00F3cio (\`Document\`/\`LegalDraftRecord\`).
* Diferencia\u00E7\u00E3o sem\u00E2ntica por dif (\`diff\` textual) n\u00E3o \u00E9 aplicada automaticamente no banco; a compara\u00E7\u00E3o de vers\u00F5es utiliza \u00E1rvores met\u00E1licas de pontua\u00E7\u00E3o (scores) ou datas por enquanto.

## Timeline Service
A \`HistoryTimeline\` consolida eventos ass\u00EDncronos e estruturados. Para uma `sessionId`, ele varre:
* \`audits\`
* \`suggestions\`
* \`decisions\`
* \`rewrites\`
* \`re-audits\`
* \`versions recomendadas\`

Montando a narrativa exata do que aconteceu com a pe\u00E7a desde que a auditoria original foi solicitada.
