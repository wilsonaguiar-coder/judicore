import type { Jurisprudencia } from "./types.js";

export function buildSystemPrompt(): string {
  return `VocÃª Ã© um assistente jurÃ­dico especializado na redaÃ§Ã£o de peÃ§as e atos processuais no Ã¢mbito do direito brasileiro.

REGRAS ABSOLUTAS â€” NUNCA VIOLE:
1. NUNCA cite nÃºmero de processo que nÃ£o esteja explicitamente no contexto fornecido.
2. NUNCA mencione tribunal, ministro, desembargador ou relator que nÃ£o esteja no contexto fornecido.
3. NUNCA invente datas, ementas ou trechos de acÃ³rdÃ£os.
4. Se o contexto nÃ£o contiver jurisprudÃªncia suficiente para embasar a resposta, diga exatamente: "NÃ£o foram encontradas decisÃµes suficientes no contexto para fundamentar este ponto."
5. Toda citaÃ§Ã£o jurisprudencial deve indicar: tribunal, nÃºmero do processo e data de julgamento â€” todos retirados do contexto.

VocÃª pode e deve:
- Redigir minutas de despacho, decisÃ£o interlocutÃ³ria e sentenÃ§a com linguagem judicial precisa.
- Redigir petiÃ§Ãµes iniciais e recursos com linguagem postulatÃ³ria adequada.
- Analisar as decisÃµes fornecidas e extrair os fundamentos relevantes ao caso.
- Estruturar a fundamentaÃ§Ã£o com lÃ³gica dedutiva clara.
- Adaptar o texto ao estilo formal exigido por cada tipo de peÃ§a processual.

REGRA DE JURISDIÃ‡ÃƒO â€” aplique sempre antes de redigir o endereÃ§amento:
A competÃªncia Ã© da JUSTIÃ‡A FEDERAL (art. 109, I da CF) quando o rÃ©u for: UniÃ£o, autarquia federal (INSS, ANATEL, IBAMA, CADE, ANVISA, Receita Federal, etc.), empresa pÃºblica federal (CEF, ECT, BNDES, etc.), fundaÃ§Ã£o pÃºblica federal, ou quando envolver matÃ©ria de competÃªncia federal (crimes federais, disputas tributÃ¡rias federais, etc.).
Nesses casos use: "EXCELENTÃ�SSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA FEDERAL DA SUBSEÃ‡ÃƒO JUDICIÃ�RIA DE [CIDADE]".
Em todos os demais casos a competÃªncia Ã© da JUSTIÃ‡A ESTADUAL: use "EXCELENTÃ�SSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA [ESPECIALIDADE] DA COMARCA DE [CIDADE]".

REGRA DE CITAÃ‡ÃƒO LEGAL â€” nunca confunda os cÃ³digos:
- Arts. 186, 421, 422, 927, 944 etc. sÃ£o do CÃ“DIGO CIVIL (CC/2002), nÃ£o do CPC.
- Arts. 300, 303, 319, 330, 485, 487, 537 etc. sÃ£o do CPC/2015.
- Sempre cite o diploma correto: "art. X do CC/2002" ou "art. X do CPC/2015".`;
}

export function buildRagContext(jurisprudencias: Jurisprudencia[]): string {
  if (jurisprudencias.length === 0) {
    return "Nenhuma jurisprudÃªncia foi recuperada para este caso.";
  }

  const items = jurisprudencias.map((j, i) => `
[${i + 1}] ${j.tribunal} â€” Processo nÂº ${j.numero}
Relator: ${j.relator}
Data de julgamento: ${j.dataJulgamento}
Ementa: ${j.ementa}
Link: ${j.url}
`);

  return `JURISPRUDÃexport function buildDocumentPrompt(
  type: "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
  caseDescription: string,
  jurisprudencias: Jurisprudencia[],
  instruction?: string,
): string {
  const typeLabel: Record<string, string> = {
    DESPACHO:        "despacho",
    DECISAO:         "decisÃ£o interlocutÃ³ria",
    SENTENCA:        "sentenÃ§a",
    PETICAO_INICIAL: "petiÃ§Ã£o inicial",
    RECURSO:         "recurso",
  };

  const instructionBlock = instruction?.trim()
    ? `\n---\nORIENTAÃ‡ÃƒO ADICIONAL:\n${instruction.trim()}\nUse esta orientaÃ§Ã£o como norte para a peÃ§a. Fundamente as decisÃµes jurisprudenciais exclusivamente nas fornecidas acima.\n`
    : "";

  const tarefaByType: Record<string, string> = {
    DESPACHO:
      "Redija uma minuta de despacho com linguagem formal e precisa.\nEstruture o documento com: relatÃ³rio sumÃ¡rio, fundamentaÃ§Ã£o e dispositivo.",
    DECISAO:
      "Redija uma minuta de decisÃ£o interlocutÃ³ria.\nEstruture o documento com: relatÃ³rio, fundamentaÃ§Ã£o jurÃ­dica persuasiva (citando as decisÃµes do contexto) e dispositivo.",
    SENTENCA:
      "Redija uma minuta de sentenÃ§a completa, densa e exaustivamente fundamentada.\nEstruture o documento com: relatÃ³rio, fundamentaÃ§Ã£o jurÃ­dica e dispositivo.",
    PETICAO_INICIAL: `Redija uma PETIÃ‡ÃƒO INICIAL completa, extremamente detalhada e tecnicamente sofisticada em favor da parte autora. Adote o tom persuasivo, argumentativo e robusto prÃ³prio das maiores e mais prestigiadas bancas de advocacia do paÃ­s.

ESTRUTURA OBRIGATÃ“RIA â€” siga exatamente esta ordem, desenvolvendo cada item com profundidade:

EXCELENTÃ�SSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) [endereÃ§amento conforme competÃªncia]

I â€” DA QUALIFICAÃ‡ÃƒO DAS PARTES
  Qualifique completamente autor e rÃ©u com todos os dados disponÃ­veis.

II â€” DOS FATOS
  Narre os fatos de forma cronolÃ³gica, detalhada e persuasiva. Destaque o impacto e a gravidade das aÃ§Ãµes da parte contrÃ¡ria.

III â€” DO DIREITO
  Construa uma argumentaÃ§Ã£o jurÃ­dica exaustiva, lÃ³gica e irrefutÃ¡vel para o mÃ©rito da pretensÃ£o principal.
  NÃƒO trate aqui de tutela de urgÃªncia nem de gratuidade.
  Desenvolva subseÃ§Ãµes (ex: 3.1, 3.2...) para cada tese jurÃ­dica.
  Para cada argumento jurÃ­dico, escreva NO MÃ�NIMO 3 a 4 parÃ¡grafos robustos. Conecte a Teoria Geral do Direito, os PrincÃ­pios Constitucionais, a Doutrina clÃ¡ssica (que vocÃª pode trazer do seu conhecimento interno) e a LegislaÃ§Ã£o aplicÃ¡vel ao caso concreto.
  Corrobore a tese EXCLUSIVAMENTE com as decisÃµes jurisprudenciais fornecidas no contexto.

IV â€” DA TUTELA DE URGÃŠNCIA (omita esta seÃ§Ã£o se nÃ£o houver urgÃªncia no caso)
  Demonstre de forma contundente o fumus boni iuris e o periculum in mora.
  Fundamente no art. 300 do CPC/2015.

V â€” DA GRATUIDADE DA JUSTIÃ‡A (omita se nÃ£o houver indÃ­cios de hipossuficiÃªncia)
  Fundamente no art. 98 do CPC/2015 e art. 5Âº, LXXIV da CF/88.

VI â€” DOS PEDIDOS
  Liste todos os pedidos numerados, cada um com seu fundamento legal direto.

VII â€” DO VALOR DA CAUSA
  Calcule e justifique o valor com base nos pedidos formulados (art. 292 CPC/2015).

ATENÃ‡ÃƒO: produza apenas o texto final da peÃ§a jurÃ­dica. NÃ£o inclua notas, ressalvas, avisos de IA, disclaimers ou comentÃ¡rios sobre ausÃªncia de dados no corpo da peÃ§a.`,

    RECURSO: `Redija um RECURSO completo, extremamente detalhado e tecnicamente sofisticado em favor da parte recorrente. Adote o tom persuasivo e combativo prÃ³prio das grandes bancas de advocacia.

ESTRUTURA OBRIGATÃ“RIA:

I â€” DA TEMPESTIVIDADE
  Comprove que o recurso Ã© tempestivo com base nas datas relevantes.

II â€” DO CABIMENTO E PREPARO
  Demonstre que o recurso Ã© cabÃ­vel e que o preparo foi realizado (ou isenÃ§Ã£o).

III â€” DOS FATOS E DA DECISÃƒO RECORRIDA
  Resuma os fatos e descreva com precisÃ£o os pontos da decisÃ£o que causaram prejuÃ­zo e devem ser reformados.

IV â€” DAS RAZÃ•ES RECURSAIS
  Para cada ponto impugnado, abra um subitem contendo:
    - O erro in judicando ou in procedendo especÃ­fico da decisÃ£o.
    - O fundamento doutrinÃ¡rio e principiolÃ³gico correto (use seu conhecimento jurÃ­dico).
    - A legislaÃ§Ã£o aplicÃ¡vel.
    - A jurisprudÃªncia de suporte (cite APENAS as decisÃµes fornecidas).
  Esta Ã© a seÃ§Ã£o principal. Seja prolixo, exaustivo e construa parÃ¡grafos densos que destruam os fundamentos da decisÃ£o recorrida.

V â€” DO PEDIDO
  Requeira o conhecimento e o provimento do recurso, com a reforma ou anulaÃ§Ã£o da decisÃ£o.

ATENÃ‡ÃƒO: produza apenas o texto da peÃ§a. NÃ£o inclua notas, ressalvas ou disclaimers no corpo da peÃ§a.`,
  };

  return `${buildRagContext(jurisprudencias)}
${instructionBlock}
---
CASO EM ANÃ�LISE:
${caseDescription}

---
REGRAS FUNDAMENTAIS PARA A REDAÃ‡ÃƒO:
1. JURISPRUDÃŠNCIA: Cite APENAS a jurisprudÃªncia explicitamente listada no contexto acima. NÃ£o invente decisÃµes.
2. DOUTRINA E LEGISLAÃ‡ÃƒO: VocÃª TEM PERMISSÃƒO e DEVE utilizar seu conhecimento jurÃ­dico interno para citar legislaÃ§Ã£o (ConstituiÃ§Ã£o, CÃ³digos, Leis Especiais), PrincÃ­pios Gerais do Direito e doutrina pacificada para enriquecer e dar profundidade Ã  argumentaÃ§Ã£o.
3. ESTILO: Seja denso, longo, argumentativo e altamente persuasivo. A peÃ§a deve parecer ter sido escrita por um advogado sÃªnior de um escritÃ³rio de elite.
4. Nunca invente dados pessoais, CPFs ou datas que nÃ£o estejam no caso.

TAREFA:
${tarefaByType[type]}`;
}ar legislaÃ§Ã£o com base no seu conhecimento jurÃ­dico â€” dispositivos legais sÃ£o necessÃ¡rios para a completude da peÃ§a.
4. NÃ£o inclua no texto final notas, ressalvas ou comentÃ¡rios meta sobre o que nÃ£o foi fornecido.

TAREFA:
${tarefaByType[type]}`;
}

export function buildPremiumDocumentPrompt(
  type: "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
  documents: string[],
  jurisprudencias: Jurisprudencia[],
  legislation: Record<string, string>,
  caseDescription?: string,
  instruction?: string,
): string {
  const typeLabel: Record<string, string> = {
    DESPACHO:        "despacho",
    DECISAO:         "decisÃ£o interlocutÃ³ria",
    SENTENCA:        "sentenÃ§a",
    PETICAO_INICIAL: "petiÃ§Ã£o inicial",
    RECURSO:         "recurso",
  };

  const docsBlock = documents.length > 0
    ? `DOCUMENTOS DO PROCESSO (leia com atenÃ§Ã£o â€” estes sÃ£o os documentos reais do caso):\n\n${documents.join("\n\n---\n\n")}`
    : "";

  const legBlock = Object.keys(legislation).length > 0
    ? `LEGISLAÃ‡ÃƒO VERIFICADA NA FONTE OFICIAL (Planalto):\n${
        Object.entries(legislation)
          .map(([lei, texto]) => `\n=== ${lei} ===\n${texto}`)
          .join("\n\n")
      }`
    : "";

  const jurBlock = buildRagContext(jurisprudencias);

  const instructionBlock = instruction?.trim()
    ? `\nORIENTAÃ‡ÃƒO ADICIONAL:\n${instruction.trim()}\n`
    : "";

  const caseBlock = caseDescription?.trim()
    ? `\nCONTEXTO ADICIONAL DO CASO:\n${caseDescription.trim()}\n`
    : "";

  const isPostulatorio = type === "PETICAO_INICIAL" || type === "RECURSO";

  const regraLegislacao = isPostulatorio
    ? `2. LEGISLAÃ‡ÃƒO: prefira sempre citar as leis que estÃ£o no bloco "LEGISLAÃ‡ÃƒO VERIFICADA" acima (texto conferido no Planalto). Para dispositivos nÃ£o presentes nesse bloco, vocÃª PODE citÃ¡-los com base no seu conhecimento jurÃ­dico â€” eles sÃ£o necessÃ¡rios para a completude da peÃ§a â€” mas sinalize com *(verificar redaÃ§Ã£o atualizada)* apenas se tiver dÃºvida sobre a redaÃ§Ã£o exata. Nunca invente nÃºmeros de artigos.`
    : `2. Cite APENAS legislaÃ§Ã£o que esteja no bloco "LEGISLAÃ‡ÃƒO VERIFICADA" acima. Se uma lei nÃ£o estiver nesse bloco, NÃƒO a cite.`;

  const tarefaByType: Record<string, string> = {
    DESPACHO:
  Requeira o conhecimento e o provimento do recurso com reforma ou anulaÃ§Ã£o da decisÃ£o.

ATENÃ‡ÃƒO: produza apenas o texto da peÃ§a. NÃ£o inclua notas, ressalvas ou disclaimers.`,
  };

  return `${docsBlock}

---

${jurBlock}

---

${legBlock}

---
${caseBlock}${instructionBlock}
---

REGRAS ABSOLUTAS:
1. Cite APENAS jurisprudÃªncia que esteja explicitamente listada acima.
${regraLegislacao}
3. Nunca invente processos, nomes, CPF, datas ou fatos nÃ£o presentes nos documentos.
4. A peÃ§a deve ser EXTENSA e COMPLETA â€” desenvolva cada seÃ§Ã£o com profundidade tÃ©cnica. NÃ£o resuma onde cabe fundamentar.

TAREFA:
${tarefaByType[type]}`;
}

export function buildAnalysisPrompt(
  caseDescription: string,
  jurisprudencias: Jurisprudencia[]
): string {
  return `${buildRagContext(jurisprudencias)}

---
CASO EM ANÃ�LISE:
${caseDescription}

---
TAREFA:
1. Identifique quais das decisÃµes acima sÃ£o mais relevantes para o caso.
2. Extraia os fundamentos jurÃ­dicos aplicÃ¡veis.
3. Indique a tendÃªncia jurisprudencial (favorÃ¡vel, desfavorÃ¡vel ou divergente).
4. Aponte pontos de atenÃ§Ã£o ou distinÃ§Ãµes relevantes entre os precedentes e o caso concreto.`;
}
