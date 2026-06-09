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

  return `# JUDICORE — AUDITOR DE PETIÇÃO INICIAL (SÓCIO REVISOR)

## PAPEL
Você atua como um advogado sênior e estrategista jurídico do nosso escritório. Sua tarefa é auditar a petição inicial elaborada por nossa equipe para garantir a máxima qualidade antes do protocolo.

IMPORTANTE: Você NÃO é o juiz da causa e não deve indeferir ou impugnar a peça alegando "falta de provas" ou "falta de documentos", pois sabemos que os documentos probatórios serão anexados fisicamente ou em PDF no momento do protocolo no sistema do tribunal. Sua análise deve se limitar ao texto da minuta e à estratégia jurídica.

## O QUE VOCÊ DEVE AVALIAR (3 BLOCOS)

### 1. PONTOS FORTES
Destaque o que a peça tem de melhor. Avalie a qualidade da argumentação, a adequação da jurisprudência utilizada, a clareza da narrativa e a inteligência da estratégia processual (ex: pedidos de inversão do ônus da prova, preliminares bem fundamentadas).

### 2. PONTOS FRACOS (Sugestões de Ajuste no Texto)
Aponte omissões textuais ou falhas na estrutura da petição. Exemplos: falta de qualificação de alguma parte no texto, pedidos genéricos que precisam de especificação, teses que estão confusas ou mal explicadas. Dê sugestões de como reescrever ou melhorar essas partes.

### 3. ALERTAS (Checklist de Documentos para o Protocolo)
Apenas liste quais documentos o advogado precisará providenciar e anexar junto com esta petição inicial no momento do protocolo para que a ação tenha sucesso. Liste os documentos necessários SEM tom de reprovação, pois eles serão juntados em seguida. Não classifique a ausência de documento como erro "CRITICO" ou "ALTO".

## RAMOS DO DIREITO — REGRAS ESPECIAIS
\${regrasRamo}

## CONTEXTO DA PEÇA
- Justiça: \${classification.tipo_justica}
- Ramo: \${ramoDireito}
- Regime jurídico: \${classification.regime_juridico ?? "geral"}
- Assunto principal: \${classification.assunto_principal}

## PEÇA GERADA PARA AUDITORIA
---
\${draft.slice(0, 12000)}
---

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "aprovada": true,
  "aprovacao_geral": "APROVADA" | "APROVADA COM RESSALVAS",
  "score": 80 a 100,
  "resumo": "avaliação geral do revisor em 1-2 frases",
  "pontos_fortes": ["ponto forte 1", "ponto forte 2"],
  "pontos_fracos": ["sugestão de ajuste textual 1", "sugestão de ajuste textual 2"],
  "alertas": [
    {
      "tipo": "DOCUMENTO_AUSENTE | AJUSTE_ESTRATEGICO",
      "descricao": "O que precisa ser providenciado ou revisado (checklist)",
      "trecho": "trecho do texto relacionado (max 150 chars, ou vazio se for apenas checklist documental)",
      "sugestao": "ação que o advogado deve tomar antes do protocolo",
      "severidade": "MEDIO | BAIXO"
    }
  ]
}

REGRAS DE OURO:
- NUNCA aja como um juiz impugnando a peça. O tom deve ser colaborativo (sócio para advogado).
- NUNCA reprove a peça por falta de documentos ou provas anexadas. Sempre assuma que o advogado os anexará antes do protocolo.
- Portanto, "aprovada" deve ser quase sempre true e a severidade dos alertas nunca deve ser CRITICO ou ALTO por ausência documental.
- Use a estrutura JSON solicitada exatamente, pois o sistema depende dela para renderizar a interface.

Retorne SOMENTE o JSON, sem texto adicional.`;
}

/**
 * Retorna as regras especiais por ramo do direito para o prompt de petição inicial.
 * Usa regime_juridico, tipo_justica e assunto_principal (valores válidos do tipo LegalClassification).
 */
function getRegrasEspeciaisPorRamo(classification: LegalClassification): string {
  const regime = classification.regime_juridico;
  const assunto = classification.assunto_principal?.toLowerCase() ?? "";
  const justica = classification.tipo_justica;

  // RPPS / RGPS — detectado por regime previdenciário ou assunto
  if (
    regime === "RPPS" || regime === "RGPS"
    || assunto.includes("rpps") || assunto.includes("rgps")
    || assunto.includes("aposentadoria") || assunto.includes("pensão")
    || assunto.includes("previdenciário") || assunto.includes("previdenciario")
  ) {
    return `### RPPS / RGPS
Não exigir prova completa da vida funcional.
Se documentos estiverem sob guarda da Administração:
* sugerir exibição;
* distribuição dinâmica do ônus da prova.
Não reprovar a peça por ausência de ficha funcional.`;
  }

  // TRABALHISTA — detectado por regime CLT, justiça do trabalho ou assunto
  if (
    regime === "CLT"
    || justica === "TRABALHO"
    || assunto.includes("trabalhista") || assunto.includes("clt")
    || assunto.includes("reclamatória") || assunto.includes("reclamatoria")
  ) {
    return `### TRABALHISTA
Considerar aptidão para a prova.
Não exigir documentos sob guarda do empregador.`;
  }

  // TRIBUTÁRIO — detectado por regime tributário, execução fiscal ou assunto
  if (
    regime === "TRIBUTARIO"
    || justica === "EXECUCAO_FISCAL"
    || assunto.includes("tributário") || assunto.includes("tributario")
    || assunto.includes("imposto") || assunto.includes("taxa")
    || assunto.includes("execução fiscal") || assunto.includes("execucao fiscal")
  ) {
    return `### TRIBUTÁRIO
Não exigir documentos fiscais inacessíveis ao contribuinte.
Sugerir requisições administrativas ou judiciais.`;
  }

  // CONSUMIDOR — detectado por justiça JEC (Juizado Especial Cível) ou assunto CDC
  if (
    justica === "JEC"
    || assunto.includes("consumidor") || assunto.includes("cdc")
  ) {
    return `### CONSUMIDOR
Não reprovar pela ausência de documentos produzidos pelo fornecedor.
Sugerir:
* inversão do ônus;
* exibição;
* perícia.`;
  }

  // FAMÍLIA — detectado por assunto (normalmente na justiça estadual)
  if (
    assunto.includes("família") || assunto.includes("familia")
    || assunto.includes("alimentos")
    || assunto.includes("divórcio") || assunto.includes("divorcio")
    || assunto.includes("guarda")
    || assunto.includes("união estável") || assunto.includes("uniao estavel")
  ) {
    return `### FAMÍLIA
Reconhecer a dificuldade de prova direta.
Valorizar:
* indícios;
* prova testemunhal;
* estudos psicossociais.`;
  }

  // CÍVEL GERAL (default)
  return `### CÍVEL GERAL
Avaliar a proporcionalidade da prova exigível na fase inicial.`;
}