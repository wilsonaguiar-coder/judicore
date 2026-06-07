# MVP RELEASE CHECKLIST & PRODUCT ROADMAP

Este documento formaliza a prontidão do produto para sair da fase laboratorial (benchmark/testes de corpus) e entrar nas mãos dos primeiros advogados.

## 1. Funcionalidades Prontas (Concluídas)
- [x] Engine Analítica Central (Pipeline V2).
- [x] Validadores Determinísticos (Fundamental Integrity, Decision Intent, Fictitious Data, etc).
- [x] Regressão Automatizada (`writer-regression`).
- [x] Escolha de LLM consolidada (DeepSeek Padrão, Gemini Opcional/Rigor).

## 2. Pendências (Bloqueantes para o Beta)
- [ ] Interface de Usuário (Tela de Análise e Upload).
- [ ] Mecanismo de Upload/Integração de PDFs (Autos do processo originais).
- [ ] Parsing e anonimização básica para conformidade com a LGPD.

## 3. Riscos
- **Custo e Rate Limits:** 10 escritórios rodando 50 minutas no mesmo dia estourarão os limites da camada gratuita/tier básico das APIs. É imperativo setar pools de chaves ou tier pago.
- **Limites de Token (Context Window):** Autos muito densos (2.000+ páginas) resultarão em cortes de payload, o que reduzirá a precisão (False Negatives vão subir).
- **Aversão a Falsos Positivos:** Advogados sêniores abandonarão a ferramenta caso ela aponte erros imaginários na primeira semana. O DeepSeek mitiga isso, mas o risco continua.

## 4. Critérios de Aceite para Versão Comercial
1. O sistema deve reter a estabilidade de benchmark (falha < 0,5% por crash) ao ser testado em produção.
2. O NPS (Net Promoter Score) do feedback dos "Findings" (Erros Apontados) pela ferramenta deve ser superior a 80%.
3. O fluxo completo (Upload -> Análise -> Exibição) deve demorar menos de 60 segundos por peça.

---

# RESPOSTAS DE DECISÃO DE PRODUTO

### 1. O que ainda impede o primeiro beta fechado?
Estritamente a construção do front-end (UI/UX). O *backend/AI core* está robusto, mas não há tela para o usuário enviar um arquivo PDF, selecionar a peça, visualizar os cards vermelhos/amarelos de erros e iterar o documento.

### 2. Quais telas são obrigatórias?
Apenas duas para o estágio inicial:
1. **Upload & Review:** Onde o documento é solto e processado.
2. **Analysis Report:** A tela de duas colunas mostrando o texto lado-a-lado com as flags de erro, permitindo marcar os alertas como lidos.

### 3. Qual o menor MVP utilizável?
Uma aplicação web de "Página Única" (Single Page Application). Sem histórico, sem dashboard, sem autenticação pesada. O escritório parceiro faz o upload manual da minuta em DOCX e dos autos em PDF e recebe em tela os apontamentos do JudiCore. Se ele quiser ajustar a peça, ele o faz em seu próprio Word.

### 4. Qual o plano de validação com advogados reais?
O **REAL_CASE_VALIDATION_PLAN** traça três frentes:
1. Começar com **10 testes manuais assistidos** (nós ao lado do usuário rodando casos normais).
2. Expandir para **20 documentos complexos** (testar o OCR e formatações esdrúxulas).
3. Teste livre contendo **50 envios não controlados**, onde a métrica real validada será a utilidade (o advogado achou a dica útil ou irritante?).

### 5. Qual o esforço estimado?
- **MVP Interno (CLI/Scripts estruturados):** Já estamos nele. Esforço ZERO para a engine, mas 1 semana de engenharia full-stack para montar uma UI amarrada nos adapters.
- **Beta Fechado (Telas obrigatórias, 10 usuários):** ~3 a 4 semanas. Requer banco de dados para logs de uso (LGPD), front-end polido e sistema de filas para não derrubar a API no timeout.
- **Primeira Versão Comercial (Integração RAG/PJe, Pagamentos):** ~2 a 3 meses. Requer processamento escalável, extração via RAG de PDFs imensos e painel de administração comercial (SaaS).
