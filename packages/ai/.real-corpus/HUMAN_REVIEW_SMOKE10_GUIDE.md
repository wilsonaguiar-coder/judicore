# HUMAN REVIEW SMOKE 10 - GUIDE

## Objetivo
Avaliar a utilidade prática dos 51 findings reais gerados pelo JudiCore (DeepSeek e Gemini) sobre o corpus de documentos judiciais.

## Classificação Humana (`humanClassification`)

Classificar como **CORRETO** quando:
- O finding aponta um problema real e fundamentado.
- O advogado provavelmente aproveitaria a sugestão.
- Há base objetiva no documento para a crítica.

Classificar como **PARCIALMENTE_CORRETO** quando:
- Há algum fundamento jurídico ou factual.
- MAS o finding exagera no rigor.
- OU a relevância prática é limitada (detalhe irrelevante).
- OU a redação precisa ser ajustada para gerar valor prático.

Classificar como **INCORRETO** quando:
- O finding "inventa" um problema (alucinação).
- Ignora o contexto global da peça.
- Aponta exigência inaplicável ao caso.
- Atrapalharia o advogado (ruído total).

Classificar como **NAO_SEI** quando:
- Exige análise especializada muito profunda que foge ao conhecimento atual.
- O trecho disponível é insuficiente para validar a afirmação.
- O contexto do processo (anexos não visíveis) não permite conclusão firme.

## Utilidade Humana (`humanUsefulness`)
- **ALTA:** Dica de ouro. Salvou o processo ou o advogado de um grande erro.
- **MEDIA:** Boa dica. Melhorou a clareza ou a força da peça.
- **BAIXA:** Apenas uma sugestão estilística ou pedantismo irrelevante.
- **NENHUMA:** Lixo, ruído ou erro. Não serve para nada.

## Arquivos para Avaliação
1. Você pode avaliar utilizando a planilha: `human-review-smoke10-sheet.csv`
2. Ou editando diretamente o JSON: `human-review-smoke10-queue.json`

Não altere as colunas originais geradas pelas IAs, apenas preencha as lacunas humanas.
