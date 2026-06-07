# REAL CASE VALIDATION PLAN

Este documento estabelece o roadmap de testes de campo para o JudiCore, marcando a transição do Gold Corpus V2 (sintético/controlado) para o ecossistema jurídico não-estruturado do mundo real.

## Objetivo
Validar a assertividade do DeepSeek Reasoner (Padrão) e Gemini 2.5 Pro (Rigor Máximo) lidando com imperfeições, OCRs de baixa qualidade, ambiguidades e formatações atípicas de autos processuais reais.

## Estratégia de Escalada

### 1. Piloto Inicial (10 Casos Reais)
**Foco:** Teste de Fumaça (Smoke Test) no mundo real.
- **Distribuição:** 2 RGPS, 2 Trabalhista, 2 Tributário, 2 Família, 2 Consumidor.
- **Origem:** PDF nativo ou digitalizado com OCR de qualidade razoável.
- **Métrica-Alvo:** A engine consegue ler e extrair `LegalExtraction` de maneira consistente? (Nenhuma quebra de JSON ou erro de formatação fatal).
- **Critério de Sucesso:** 100% de parse sem crash. Tempo de resposta < 45s por caso.

### 2. Validação Intermediária (20 Casos Reais)
**Foco:** Ruído e Edge Cases.
- **Distribuição:** 4 casos por domínio.
- **Origem:** Processos densos, OCRs ruins, peças mal redigidas e documentos manuscritos.
- **Métrica-Alvo:** Avaliar o índice de *False Positives* (alucinação por ruído) do DeepSeek e Gemini frente a texto de baixa qualidade.
- **Critério de Sucesso:** DeepSeek deve manter F1 > 40% contra a análise de um advogado real, ignorando falhas de OCR e focando no mérito jurídico.

### 3. Stress Test Final (50 Casos Reais)
**Foco:** Aderência Produtiva e Decisão de UX.
- **Distribuição:** 10 casos por domínio.
- **Origem:** Casos aleatórios de produção, fornecidos por escritórios parceiros (Beta Testers).
- **Métrica-Alvo:** Medir a utilidade prática do relatório final para o advogado (NPS da auditoria).
- **Critério de Sucesso:** 80% das auditorias devem apontar problemas que o advogado consideraria válidos ou passariam peças que o advogado aprovaria sem ressalvas.

## Metodologia de Coleta e Avaliação

1. **Blind Review:** O escritório parceiro envia as peças anonimizadas.
2. **Double-Check:** A equipe do escritório parceiro aponta os erros existentes na peça.
3. **Execution:** O JudiCore executa a auditoria.
4. **Matching:** Cruzamos os `findings` do JudiCore com os apontamentos humanos.

> [!WARNING]
> Proteção de Dados: Todos os casos reais submetidos aos LLMs devem ter uma camada prévia de anonimização (substituição de CPF, nomes próprios restritos) caso não sejam processos de consulta pública.
