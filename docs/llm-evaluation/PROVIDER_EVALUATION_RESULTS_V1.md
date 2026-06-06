# Provider Evaluation Results V1

**Data da execu\u00E7\u00E3o:** Junho de 2026
**Quantidade de casos:** 4 casos oficiais (Provider Evaluation Harness)
**Quantidade de provedores:** 3 (OpenAI, Gemini, DeepSeek)
**Modelos avaliados:** `unknown-via-adapter` (OpenAI, Gemini, DeepSeek V4/Pro)

---

## Resultados e An\u00E1lise

### 1\u00BA Colocado (Vencedor Provis\u00F3rio): DeepSeek
**Status:** APROVADO

**Pontos fortes:**
- Respostas extremamente objetivas e diretas.
- Excelente ader\u00EAncia ao escopo da tarefa (n\u00E3o alucina altera\u00E7\u00F5es ao documento inteiro).
- Baix\u00EDssima lat\u00EAncia (entre 2 e 4 segundos).
- Menor custo de tokeniza\u00E7\u00E3o (excelente ROI para aplica\u00E7\u00F5es em larga escala).

**Pontos fracos:**
- Ocasional tend\u00EAncia a citar legisla\u00E7\u00E3o (ex: art. 535 do CPC) ou artigos normativos n\u00E3o presentes explicitamente no contexto da auditoria. (Risco mitigado a partir do Prompt Guardrail v1.1).

---

### 2\u00BA Colocado: OpenAI
**Status:** APROVADO

**Pontos fortes:**
- Excelente ader\u00EAncia e robustez l\u00F3gica nas solu\u00E7\u00F5es.
- N\u00E3o reescreveu pe\u00E7as e n\u00E3o assumiu postura generativa destrutiva.
- N\u00E3o inventou fatos externos, limitando-se aos par\u00E2metros fornecidos.
- Alt\u00EDssima utilidade pr\u00E1tica, construindo verdadeiros manuais passo-a-passo.

**Pontos fracos:**
- Respostas demasiadamente longas, prolixas e pedantes.
- Consumo significativamente maior de tokens e custo correspondente elevado.
- Lat\u00EAncia superior aos competidores (tempo de resposta entre 4 e 9 segundos).

---

### 3\u00BA Colocado: Gemini
**Status:** PENDENTE

**Motivo:**
- Retornou "Resposta vazia da API" em todas as execu\u00E7\u00F5es do benchmark, resultando em erro no adapter.

**Observa\u00E7\u00E3o:**
- Chave perfeitamente v\u00E1lida e request de rede conclu\u00EDdo com c\u00F3digo de sucesso HTTP 200.
- Extremamente prov\u00E1vel que seja um falso positivo nos filtros de seguran\u00E7a (*Safety Settings*) do Google, bloqueando silenciosamente o texto de retorno por detectar jarg\u00E3o jur\u00EDdico penal, ambiental ou indenizat\u00F3rio.
- Necess\u00E1ria uma investiga\u00E7\u00E3o futura do adapter para injetar categorias de seguran\u00E7a (`HarmCategory`) no n\u00EDvel `BLOCK_NONE`.

---

## Classifica\u00E7\u00E3o Provis\u00F3ria

1. **DeepSeek V4 Pro** - Recomendado como prim\u00E1rio.
2. **OpenAI** - Fallback imediato.
3. **Gemini** - *Pendente* (manuten\u00E7\u00E3o requerida).
