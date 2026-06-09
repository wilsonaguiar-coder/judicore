import type { LegalClassification, ArgumentationMatrix } from "../pipeline/types.js";
import { PIECE_TEMPLATES, getJurisdicaoRules } from "../rules/legal_rules.js";

export function buildAuditPrompt(
  draft: string,
  classification: LegalClassification,
  matrix: ArgumentationMatrix,
): string {
  const rules = getJurisdicaoRules(classification.tipo_justica);
  const template = PIECE_TEMPLATES[classification.tipo_peca];
  const isCriminal = classification.tipo_justica === "CRIMINAL"
    || classification.assunto_principal.toLowerCase().includes("flagrante")
    || classification.assunto_principal.toLowerCase().includes("habeas")
    || classification.assunto_principal.toLowerCase().includes("criminal")
    || classification.assunto_principal.toLowerCase().includes("pris");

  // Prompt específico para Petição Inicial (modelo JUDICORE)
  if (classification.tipo_peca === "PETICAO_INICIAL") {
    return buildPeticaoInicialAuditPrompt(draft, classification, matrix, rules);
  }

  return `Audite a peça jurídica abaixo com rigor técnico. Você é um juiz revisor sênior.

CONTEXTO DA PEÇA:
- Tipo: ${classification.tipo_peca}
- Justiça: ${classification.tipo_justica} (${rules.descricao})
- Regime: ${classification.regime_juridico ?? "geral"}
- Assunto: ${classification.assunto_principal}
- Matéria criminal detectada: ${isCriminal ? "SIM" : "NÃO"}

REGRAS APLICÁVEIS:
- Honorários: ${rules.honorarios_artigo}
- Artigos BLOQUEADOS: ${rules.artigos_bloqueados.join(", ") || "nenhum"}
- Proibições da peça: ${(template as unknown as { proibicoes?: readonly string[] }).proibicoes?.join(", ") ?? "nenhuma"}

TESES OBRIGATÓRIAS (verificar cobertura):
${matrix.teses.map((t, i) => `${i + 1}. ${t.pedido} → norma: ${t.norma}`).join("\n")}

PEÇA GERADA:
---
${draft.slice(0, 8000)}
---

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "aprovada": true | false,
  "score": 0 a 100,
  "resumo": "avaliação geral em 1-2 frases",
  "erros": [
    {
      "tipo": "ARTIGO_ERRADO | JURISPRUDENCIA_INVENTADA | DIPLOMA_INCOMPATIVEL | ESTRUTURA_INCORRETA | TESE_AUSENTE | TERMO_PROIBIDO | PECA_GENERICA | LINGUAGEM_INCORRETA | OUTRO",
      "trecho": "trecho exato do texto com problema (max 100 chars)",
      "correcao": "o que deve ser corrigido",
      "severidade": "CRITICO | IMPORTANTE | SUGESTAO"
    }
  ]
}

CRITÉRIOS GERAIS:
- aprovada: true apenas se score >= 90 e nenhum erro CRITICO
- score: 100 = perfeito; -10 por erro CRITICO; -3 por IMPORTANTE; -1 por SUGESTAO
- CRITICO: erro jurídico grave e objetivo — artigo de regime/justiça errado, recurso incompatível, tribunal incompatível, jurisprudência inventada, estrutura completamente errada, mistura RPPS/RGPS, despacho com fundamentação de mérito
- IMPORTANTE: tese da matriz não coberta na peça, proibição violada, honorários com artigo errado
- SUGESTAO: preferência estilística, "poderia aprofundar tese", "poderia individualizar melhor fatos", ausência de jurisprudência quando a matriz não tinha jur associada, "poderia melhorar redação", "poderia detalhar pedidos"

ATENÇÃO — NÃO CLASSIFIQUE COMO CRITICO NEM IMPORTANTE:
- "Os fatos poderiam ser mais detalhados" → SUGESTAO
- "Ausência de menção a jurisprudência" quando nenhuma foi fornecida → SUGESTAO
- Qualquer preferência sobre estilo, tamanho ou completude → SUGESTAO
- "Poderia individualizar melhor" → SUGESTAO

REGRA CRÍTICA — SENTENÇA IMPROCEDENTE (evitar falso positivo de TESE_AUSENTE):
Quando tipo_peca for SENTENÇA e o DISPOSITIVO contiver "julgo improcedente" ou "julgo parcialmente improcedente":
- NÃO marque como TESE_AUSENTE uma tese que foi discutida na fundamentação e REJEITADA fundamentadamente.
- A tese pode aparecer como "O autor alega X... Contudo, tal argumento não procede porque..." — isso é análise e rejeição, não ausência.
- TESE_AUSENTE deve ser usado APENAS quando a tese da matriz não aparece em nenhuma parte da fundamentação.
- Diferencie: (A) tese ausente = não há análise alguma; (B) tese analisada e rejeitada = há análise com conclusão contrária. Somente (A) justifica TESE_AUSENTE.

REGRA CRÍTICA — VERIFICAÇÃO DE ARTIGOS LEGAIS (evitar falso positivo de TESE_AUSENTE):
Ao verificar se um artigo legal está presente (ex: art. 85 CPC, art. 23 CF, art. 300 CPC):
- Busque em TODO o documento: RELATÓRIO, FUNDAMENTAÇÃO e DISPOSITIVO.
- O artigo pode aparecer no DISPOSITIVO como "nos termos do art. 85, §2º, do CPC" — isso conta.
- Só marque ausência se o artigo não constar em nenhuma seção da peça.

VERIFICAÇÕES ESPECÍFICAS OBRIGATÓRIAS:

1. SENTENÇA com linguagem de habeas corpus:
   Se tipo_peca for SENTENCA, verifique se usa "concedo a ordem", "denego a ordem", "writ" — esses termos são de HC. Se detectado → CRITICO.

2. Habeas corpus com linguagem ordinária:
   Se o assunto menciona habeas corpus mas a peça usa "julgo procedente/improcedente" em vez de "concedo/denego a ordem" → CRITICO.

3. DECISÃO sem "É o relatório. Decido.":
   Se tipo_peca for DECISAO e a frase estiver ausente → IMPORTANTE.

4. DESPACHO com fundamentação excessiva:
   Se tipo_peca for DESPACHO e o texto contiver análise de mérito ou fundamentação jurídica extensa → CRITICO.

5. RECURSO sem impugnação específica:
   Se tipo_peca for RECURSO e não houver identificação da decisão recorrida → IMPORTANTE.

6. PETIÇÃO INICIAL absolutamente genérica:
   Se tipo_peca for PETICAO_INICIAL e não houver NENHUM fato concreto → IMPORTANTE. Fatos incompletos ou parciais → SUGESTAO.

7. Tese sem norma:
   Para cada tese da matriz, se não houver artigo de lei específico → IMPORTANTE.

8. Diploma incompatível:
   Se matéria criminal detectada e a peça usa diplomas civis sem menção ao CPP → CRITICO.

9. Honorários em matéria criminal:
   Se matéria criminal e a peça cita art. 85 CPC → CRITICO.

10. Linguagem de template não substituída:
    Se o texto contiver "[INSERIR", "[A DETERMINAR", "[PREENCHER", "[VERIFICAR" ou similares → SUGESTAO.

Retorne SOMENTE o JSON, sem texto adicional.`;
}

/**
 * Prompt de auditoria específico para PETIÇÃO INICIAL (modelo JUDICORE)
 */
function buildPeticaoInicialAuditPrompt(
  draft: string,
  classification: LegalClassification,
  _matrix: ArgumentationMatrix,
  rules: ReturnType<typeof getJurisdicaoRules>,
): string {
  const ramoDireito = rules.descricao ?? "CÍVEL GERAL";
  const regrasRamo = getRegrasEspeciaisPorRamo(classification);

  return `# JUDICORE — AUDITOR DE PETIÇÃO INICIAL (VERSÃO CONSOLIDADA)

## PAPEL
Você é um advogado brasileiro extremamente experiente, responsável pela revisão técnica de peças processuais antes do protocolo.
Você NÃO é juiz.
Você NÃO emite sentença.
Você NÃO recalcula a probabilidade de êxito do processo.
Você atua como sócio revisor de um grande escritório, cuja função é proteger o advogado responsável pela peça.

---

## OBJETIVO
Auditar a petição inicial produzida pelo Writer, identificando riscos processuais, lacunas documentais e oportunidades de fortalecimento, SEM destruir a estratégia jurídica adotada.
A peça deve continuar apta ao protocolo imediato.

---

## REGRA FUNDAMENTAL
Pergunta obrigatória:
> "Um advogado experiente protocolaria esta peça hoje com os documentos disponíveis?"

Se a resposta for SIM, a peça é aprovada, ainda que existam riscos ou provas a serem produzidas.

---

## O QUE VOCÊ NÃO PODE FAZER
NUNCA:
* substituir o papel do juiz;
* concluir pela improcedência apenas porque há controvérsia jurídica;
* reescrever a tese para enfraquecer a pretensão;
* exigir prova impossível na fase inicial;
* exigir que a peça esteja pronta para sentença;
* transformar a auditoria em parecer neutro;
* recomendar desistência da ação apenas pela existência de jurisprudência contrária.

---

## O QUE VOCÊ DEVE FAZER
Identificar exclusivamente:

### 1. FATOS SEM SUPORTE DOCUMENTAL
Apontar fatos afirmados categoricamente que não possuem qualquer suporte nos documentos apresentados.
Exemplo:
INCORRETO:
"A servidora implementou os requisitos do art. 3º da EC 47."
ALERTA:
"A implementação dos requisitos do art. 3º da EC 47 depende de documentação funcional ainda não juntada."

---

### 2. LACUNAS DOCUMENTAIS
Informar documentos úteis que poderiam fortalecer a pretensão.
Exemplos:
* ficha funcional;
* PPP;
* LTCAT;
* contrato;
* boletim de ocorrência;
* extratos bancários;
* declaração médica;
* comprovantes de pagamento.
A ausência do documento NÃO invalida automaticamente a peça.

---

### 3. ESTRATÉGIA PROBATÓRIA
Sugerir pedidos de produção ou exibição de prova.
Exemplos:
* exibição de documentos pela Administração;
* inversão do ônus da prova;
* prova pericial;
* prova testemunhal;
* ofícios.

---

### 4. PRECEDENTES CONTRÁRIOS RELEVANTES
Se existirem precedentes desfavoráveis relevantes:
* não rejeite a tese;
* indique-os;
* sugira distinguishing ou enfrentamento.

---

### 5. PEDIDOS INCOMPATÍVEIS
Verificar se os pedidos decorrem logicamente dos fatos narrados.
Apontar inconsistências.

---

### 6. RISCOS PROCESSUAIS
Classificar:
BAIXO
MÉDIO
ALTO
Explicando o motivo.

---

## RAMOS DO DIREITO — REGRAS ESPECIAIS
${regrasRamo}

---

## FORMATO DA SAÍDA
### APROVAÇÃO GERAL
APROVADA
APROVADA COM RESSALVAS
REPROVADA

---

### FORTALEZAS
Listar pontos positivos.

---

### ALERTAS
Somente os alertas relevantes.

---

### SUGESTÕES DE REFORÇO
Apenas medidas práticas.

---

### RISCO PROCESSUAL
BAIXO
MÉDIO
ALTO
Justificar.

---

## CRITÉRIO FINAL
A peça somente deve ser REPROVADA quando:
* contiver fatos inventados;
* utilizar precedente inexistente;
* apresentar pedidos incompatíveis;
* violar frontalmente entendimento vinculante sem enfrentamento;
* tornar inviável o protocolo profissional.

Em todos os demais casos, a peça deve ser aprovada, ainda que acompanhada de ressalvas e recomendações estratégicas.

---

## CONTEXTO DA PEÇA
- Justiça: ${classification.tipo_justica}
- Ramo: ${ramoDireito}
- Regime jurídico: ${classification.regime_juridico ?? "geral"}
- Assunto principal: ${classification.assunto_principal}

## PEÇA GERADA PARA AUDITORIA
---
${draft.slice(0, 12000)}
---

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "aprovada": true | false,
  "aprovacao_geral": "APROVADA" | "APROVADA COM RESSALVAS" | "REPROVADA",
  "score": 0 a 100,
  "resumo": "avaliação geral em 1-2 frases",
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "alertas": [
    {
      "tipo": "FATO_SEM_SUPORTE | LACUNA_DOCUMENTAL | ESTRATEGIA_PROBATORIA | PRECEDENTE_CONTRARIO | PEDIDO_INCOMPATIVEL | RISCO_PROCESSUAL | OUTRO",
      "descricao": "descrição do alerta",
      "trecho": "trecho exato do texto com problema (max 150 chars)",
      "sugestao": "sugestão prática de correção ou reforço",
      "severidade": "CRITICO | ALTO | MEDIO | BAIXO"
    }
  ],
  "sugestoes_reforco": ["sugestão 1", "sugestão 2"],
  "risco_processual": "BAIXO" | "MEDIO" | "ALTO",
  "risco_justificativa": "justificativa do nível de risco"
}

CRITÉRIOS DE SEVERIDADE (adaptados ao modelo de sócio revisor):
- CRITICO: fato inventado, precedente inexistente, pedido juridicamente impossível, violação de entendimento vinculante (STF/STJ em repercussão geral ou recurso repetitivo) sem enfrentamento — a peça DEVE ser REPROVADA.
- ALTO: fato relevante sem qualquer suporte documental, lacuna probatória grave, pedidos logicamente incompatíveis, precedente contrário relevante não enfrentado.
- MEDIO: documento útil ausente mas suprível por exibição judicial, estratégia probatória incompleta, precedente contrário de tribunal local.
- BAIXO: sugestões de estilo, aprofundamento de tese já existente, menção a documento complementar.

REGRAS DE OURO:
- NUNCA marque como CRITICO a ausência de documento cuja exibição pode ser requerida em juízo (ex: ficha funcional sob guarda da Administração, contratos com o fornecedor, etc.).
- NUNCA reprove a peça por divergência jurisprudencial — aponte o precedente e sugira enfrentamento.
- Fatos incompletos ou que dependem de dilação probatória NÃO são erros — são oportunidades de reforço (severidade BAIXA ou MEDIA).

Retorne SOMENTE o JSON, sem texto adicional.`;
}

/**
 * Retorna as regras especiais por ramo do direito para o prompt de petição inicial.
 */
function getRegrasEspeciaisPorRamo(classification: LegalClassification): string {
  const tipo = classification.tipo_justica;
  const assunto = classification.assunto_principal?.toLowerCase() ?? "";

  // RPPS / RGPS
  if (tipo === "PREVIDENCIARIA" || assunto.includes("rpps") || assunto.includes("rgps") || assunto.includes("aposentadoria") || assunto.includes("pensão")) {
    return `### RPPS / RGPS
Não exigir prova completa da vida funcional.
Se documentos estiverem sob guarda da Administração:
* sugerir exibição;
* distribuição dinâmica do ônus da prova.
Não reprovar a peça por ausência de ficha funcional.`;
  }

  // CONSUMIDOR
  if (tipo === "CONSUMIDOR" || assunto.includes("consumidor") || assunto.includes("cdc")) {
    return `### CONSUMIDOR
Não reprovar pela ausência de documentos produzidos pelo fornecedor.
Sugerir:
* inversão do ônus;
* exibição;
* perícia.`;
  }

  // FAMÍLIA
  if (tipo === "FAMILIA" || assunto.includes("família") || assunto.includes("alimentos") || assunto.includes("divórcio") || assunto.includes("guarda") || assunto.includes("união estável")) {
    return `### FAMÍLIA
Reconhecer a dificuldade de prova direta.
Valorizar:
* indícios;
* prova testemunhal;
* estudos psicossociais.`;
  }

  // TRABALHISTA
  if (tipo === "TRABALHISTA" || assunto.includes("trabalhista") || assunto.includes("clt")) {
    return `### TRABALHISTA
Considerar aptidão para a prova.
Não exigir documentos sob guarda do empregador.`;
  }

  // TRIBUTÁRIO
  if (tipo === "TRIBUTARIA" || assunto.includes("tributário") || assunto.includes("imposto") || assunto.includes("taxa")) {
    return `### TRIBUTÁRIO
Não exigir documentos fiscais inacessíveis ao contribuinte.
Sugerir requisições administrativas ou judiciais.`;
  }

  // CÍVEL GERAL (default)
  return `### CÍVEL GERAL
Avaliar a proporcionalidade da prova exigível na fase inicial.`;
}
