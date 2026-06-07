# UI BACKLOG & MVP SCOPE

Esta é a lista priorizada das interfaces de usuário necessárias para transformar a *engine* validada do JudiCore em um produto operável. A priorização segue a regra: do essencial para a execução do MVP ao agradável para a comercialização.

## 1. Alta Prioridade (Obrigatório para o MVP Interno)

### 1.1. Tela: Análise (Upload & Review)
*O motor do sistema.*
- Área de Drag & Drop para upload de PDF / DOCX.
- Seletor de domínio (RGPS, Trabalhista, etc) ou Detecção Automática.
- Seletor de rigor: "Padrão" (DeepSeek) vs "Rigor Máximo" (Gemini).
- Barra de progresso conectada aos steps da pipeline (`Draft parsing` -> `Classification` -> `Audit` -> `Final Validator`).
- Exibição de relatório de resultado (Aprovada, Aprovada com Ressalvas, Reprovada).

### 1.2. Tela: Relatório Detalhado (Findings)
*Aonde o advogado toma a decisão.*
- Layout de dupla coluna: Peça original ao lado (ou acima) dos "Findings".
- Exibição visual de cores de severidade (Fatal: Vermelho, Warning: Amarelo).
- Lista de `strengths`, erros fatais e não fatais detalhados.
- Funcionalidade para o usuário clicar em "Ignorar" (False Positive) ou "Corrigir".

## 2. Média Prioridade (Obrigatório para o Beta Fechado)

### 2.1. Tela: Histórico de Análises
- Tabela paginada listando todos os documentos já auditados.
- Colunas: Data, Peça, Status Final (✅ ❌ ⚠️), Tempo de Execução.
- Botão para re-acessar o relatório.

### 2.2. Tela: Peças / Minutas Salvas
- Gerenciador básico das minutas já auditadas e possivelmente ajustadas.
- Editor Markdown ou Textarea para visualizar a peça pura e permitir edições finas sem sair do sistema.

### 2.3. Tela: Home (Dashboard)
- Resumo executivo do uso.
- Quantidade de análises realizadas no mês.
- Principais erros cometidos pelo escritório (ex: Falta de pedidos, citação errada de jurisprudência).

## 3. Baixa Prioridade (Diferencial para Versão Comercial)

### 3.1. Tela: Configurações de Rigor e Perfil
- Customização de thresholds do escritório (ex: Bloquear envios se F1 < X ou se score < 85).
- Configuração de integração de API Key própria para provedores.

### 3.2. Tela: Processos (Integração Futura PJe)
- Visualização em árvore dos autos do processo.
- Metadados processuais (Número, Classe, Vara).
- Lincagem da auditoria diretamente com os movimentos processuais.
