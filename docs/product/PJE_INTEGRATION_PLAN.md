# PJE INTEGRATION PLAN

A integração do JudiCore com os sistemas processuais dos tribunais (PJe, eproc, e-SAJ) é essencial para maximizar a precisão estrutural da auditoria (impedir o "Decision Intent Lock" e garantir que a peça enfrente tudo que consta nos autos).

Este documento delineia as 4 fases da integração arquitetural. Apenas planejamento, sem implementação nesta etapa.

## Fase 1: Importação Simples de PDF
**Objetivo:** Permitir uso imediato sem raspagem complexa.
- **Funcionamento:** O usuário consolida os autos em um único PDF (função já presente em vários tribunais) e envia no upload, junto com a minuta em análise.
- **Limitação:** Custo de tokens massivo. Precisaremos usar extratores de LLM (ex: Gemini Flash) para resumir os autos antes de auditar, devido aos limites de 16k ou 32k tokens.
- **Status:** Pré-requisito para o Beta Fechado real.

## Fase 2: Importação Estruturada de Autos (Scraping/API)
**Objetivo:** Omitir o PDF e consumir a linha do tempo do processo.
- **Funcionamento:** O usuário insere o Número do Processo. O JudiCore faz scraping (ou consome APIs públicas / Jusbrasil / Datajud) para capturar o "feed" de movimentações.
- **Vantagem:** Podemos extrair metadados oficiais (Vara, Magistrado, Valor da Causa) para alimentar automaticamente as camadas de validação (evita erros em Placeholders ou Fatos Fictícios).

## Fase 3: Montagem Automática de Contexto (RAG Jurídico)
**Objetivo:** Baratear o uso da API com contexto de alta precisão.
- **Funcionamento:** Se os autos possuírem 2.000 páginas, o JudiCore usa RAG (Retrieval-Augmented Generation). Somente as folhas de Provas (Laudos, CNIS) e a última Decisão são passados para o `FinalValidator` como contexto.
- **Impacto:** Resolve o problema de "Fundamental Integrity", provendo os documentos que realmente comprovam a alegação sem poluir a janela de tokens.

## Fase 4: Integrações Avançadas (Write-Back)
**Objetivo:** Fechar o ciclo.
- **Funcionamento:** O usuário acerta as correções sugeridas pela auditoria dentro do JudiCore. Ao clicar em "Protocolar", o JudiCore aciona a API do ERP Jurídico do escritório (ex: Projuris, Astrea) ou um bot RPA para anexar a peça direto no tribunal.
- **Visão Comercial:** Automação *end-to-end* com garantia de 0 defeitos estruturais.
