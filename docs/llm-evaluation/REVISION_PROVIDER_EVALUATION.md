# LLM Revision Provider Evaluation

## Prop\u00F3sito
Este documento estabelece os crit\u00E9rios e casos de teste para a avalia\u00E7\u00E3o manual das sugest\u00F5es geradas pelos provedores reais de LLM (OpenAI, Claude, DeepSeek) quando acoplados \u00E0 infraestrutura do **AssistedRevisionService** do JudiAudit. 

Conforme estabelecido pela FASE 8.1.2, o objetivo **n\u00E3o** \u00E9 aplicar altera\u00E7\u00F5es ao draft do usu\u00E1rio, e sim validar a qualidade, precis\u00E3o e utilidade das sugest\u00F5es puramente t\u00E9cnicas instruindo-o a sanar os problemas identificados.

## Crit\u00E9rios de Avalia\u00E7\u00E3o

1. **Ader\u00EAncia \u00E0 Tarefa:** A sugest\u00E3o respeita estritamente o `code` e a `instruction` original gerada pelo validador.
2. **Aus\u00EAncia de Alucina\u00E7\u00E3o:** O modelo n\u00E3o cria fatos novos, n\u00E3o invoca testemunhas inexistentes, n\u00E3o cita n\u00FAmeros de processo fakes, nem prescreve jurisprud\u00EAncia ou legisla\u00E7\u00E3o inventada.
3. **Foco na Instru\u00E7\u00E3o:** O modelo n\u00E3o reescreve o documento inteiro, n\u00E3o gera matrizes longas e foca apenas na a\u00E7\u00E3o diretiva (ex: *"Retifique o dispositivo para incluir o indeferimento da tutela"*).
4. **Utilidade Pr\u00E1tica:** A sugest\u00E3o de at\u00E9 500 palavras \u00E9 \u00FAtil e prontamente acion\u00E1vel pelo autor.

---

## Casos de Teste Estrat\u00E9gicos

### 1. `UNADDRESSED_MAIN_REQUEST`
- **Contexto:** O validador (Request vs Dispositive) percebeu que um pedido principal n\u00E3o foi mencionado na conclus\u00E3o de m\u00E9rito.
- **O que avaliar:** O LLM deve orientar o operador do direito a revisar exclusivamente o dispositivo e garantir que a proced\u00EAncia ou improced\u00EAncia do pedido principal seja cravada, sem inventar m\u00E9ritos artificiais para justificar a decis\u00E3o.

### 2. `MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION`
- **Contexto:** H\u00E1 um laudo ou evid\u00EAncia indicando incapacidade cl\u00EDnica na fundamenta\u00E7\u00E3o, mas o benef\u00EDcio foi negado no dispositivo sem que o magistrado afastasse a per\u00EDcia (Evidence vs Conclusion).
- **O que avaliar:** O LLM n\u00E3o pode simplesmente "conceder o benef\u00EDcio". Ele deve instruir o autor a "justificar expressamente o afastamento do laudo com base em outros elementos" ou "retificar o julgamento em linha com a prova m\u00E9dica relatada".

### 3. `PRESCRIPTION_PROCEDENCE_CONTRADICTION`
- **Contexto:** A fundamenta\u00E7\u00E3o reconheceu a prescri\u00E7\u00E3o (extin\u00E7\u00E3o), mas a conclus\u00E3o concedeu a proced\u00EAncia do pedido prescrevido.
- **O que avaliar:** O modelo deve apontar diretamente a falha estrutural do silogismo. A sugest\u00E3o deve obrigar a uniformiza\u00E7\u00E3o do texto, instruindo sobre a extin\u00E7\u00E3o com resolu\u00E7\u00E3o de m\u00E9rito em conformidade com as regras processuais relativas \u00E0 prescri\u00E7\u00E3o.

### 4. `MISSING_ESSENTIAL_TOPIC`
- **Contexto:** Faltou um sub-elemento material imperativo (ex: aus\u00EAncia do enfrentamento de "dano ambiental" em senten\u00E7a de APP).
- **O que avaliar:** O modelo n\u00E3o pode redigir a tese sozinho. Ele deve recomendar explicitamente a cria\u00E7\u00E3o de uma se\u00E7\u00E3o ou a elabora\u00E7\u00E3o de um par\u00E1grafo analisando concretamente o t\u00F3pico reclamado.

---

## Status da Implementa\u00E7\u00E3o
O sistema foi projetado sob "Defense in Depth". A flag `requiresHumanReview: true` sempre acompanha as respostas dos provedores (`OpenAI`, `Claude`, `DeepSeek`), garantindo que qualquer alucina\u00E7\u00E3o resultante desta avalia\u00E7\u00E3o n\u00E3o destrua de maneira invis\u00EDvel o conte\u00FAdo juridicamente assinado do JudiCore.
