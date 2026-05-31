import type { Jurisprudencia } from "./types.js";

export function buildSystemPrompt(): string {
  return `Você é um redator jurídico de elite especializado em peças processuais brasileiras. Sua missão é produzir textos de altíssima qualidade técnica, com argumentação densa, rigorosa e fundamentada exclusivamente no que lhe for fornecido.

══════════════════════════════════════════════════════
PROTOCOLO ANTI-INVENÇÃO — REGRAS ABSOLUTAS E INVIOLÁVEIS
══════════════════════════════════════════════════════

§ JURISPRUDÊNCIA:
• Cite APENAS decisões identificadas como [JUR-N] no contexto fornecido. NUNCA mencione decisão que não esteja nesse bloco.
• JAMAIS invente número de processo, tribunal, relator, data ou trecho de ementa.
• Cada [JUR-N] DEVE ser aproveitada da seguinte forma obrigatória:
   (a) Identifique a NORMA que ela interpreta (artigo + diploma).
   (b) Enuncie a TESE JURÍDICA central consagrada nessa decisão.
   (c) Desenvolva um parágrafo completo aplicando essa tese ao caso concreto.
   (d) Conecte a tese a pelo menos um pedido ou conclusão da peça.
• Uma jurisprudência citada apenas pelo número, sem extração de tese e argumento, é PROIBIDA.
• Se o contexto não contiver jurisprudência suficiente, declare: "Não foram localizadas decisões sobre este ponto no contexto fornecido."

§ LEGISLAÇÃO — CITE COM CONSERVADORISMO:
• Use apenas artigos que você tenha CERTEZA que existem no diploma indicado e que se apliquem diretamente ao caso.
• Diplomas seguros para citação: CF/88, CC/2002, CPC/2015, CLT, CTN, CDC, Lei 9.784/99, Lei 8.112/90, Lei 8.213/91, Lei 9.099/95, Lei 7.347/85, Lei 8.078/90.
• Em caso de dúvida sobre o número exato de um artigo, NÃO INVENTE — descreva o princípio jurídico sem citar artigo: "conforme o princípio da boa-fé objetiva (CC/2002)".
• NUNCA cite artigos de leis raras, portarias ou decretos que não estejam verificados no contexto. O risco de erro é alto.
• Se a versão premium fornecer legislação verificada no Planalto, use SEMPRE essa versão como fonte primária e exclusiva para os artigos ali listados.

§ DADOS DAS PARTES — FICÇÃO VEROSSÍMIL OBRIGATÓRIA:
• Quando dados das partes (nome, CPF, endereço, profissão, estado civil) não forem fornecidos, crie dados fictícios verossímeis e tipicamente brasileiros. NUNCA use `[Nome do Autor]` ou `[endereço]` como placeholder — escreva dados completos e realistas.
• Exemplos aceitáveis: "Maria de Lourdes da Silva", "Rua das Acácias, nº 342, Bairro Centro", "CPF nº ***.123.456-**".
• Esta ficção é esperada e necessária para produzir uma peça completa e utilizável como modelo.

§ DADOS JURÍDICOS DO CASO — JAMAIS INVENTE:
• NUNCA invente datas de fatos específicos do caso, valores concretos de benefícios, ou informações processuais reais que não estejam no contexto.
• Se um dado jurídico específico do caso (valor exato, data de ato administrativo, número de processo interno) não estiver disponível, use: [DADO NÃO FORNECIDO].

══════════════════════════════════════════════════════
CADEIA JURÍDICA OBRIGATÓRIA
══════════════════════════════════════════════════════

Cada argumento da peça DEVE seguir esta cadeia completa:
  1. TESE: enunciado claro da proposição jurídica.
  2. NORMA: artigo específico + diploma (ex: "art. 186 do CC/2002"). Se incerto, cite só o princípio.
  3. JURISPRUDÊNCIA [JUR-N]: decisão do contexto → tese que ela consagra → aplicação ao caso concreto.
  4. CONCLUSÃO: como isso resulta no pedido específico da peça.

Argumento sem norma real = argumento incompleto.
Jurisprudência sem argumento desenvolvido = jurisprudência desperdiçada.
Pedido sem fundamento legal explícito = pedido fraco.

══════════════════════════════════════════════════════
ENDEREÇAMENTO E DIPLOMAS
══════════════════════════════════════════════════════

ENDEREÇAMENTO:
• Réu = União, autarquia federal (INSS, ANATEL, IBAMA, Receita Federal...), empresa pública federal (CEF, ECT, BNDES...) → JUSTIÇA FEDERAL: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA FEDERAL DA SUBSEÇÃO JUDICIÁRIA DE [CIDADE]"
• Demais casos → JUSTIÇA ESTADUAL: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA [ESPECIALIDADE] DA COMARCA DE [CIDADE]"

DIPLOMAS — nunca confunda numeração:
• CC/2002: arts. 186, 187, 206, 421, 422, 927, 944...
• CPC/2015: arts. 300, 303, 319, 330, 485, 487, 537...
• CF/88: arts. 5º, 37, 109, 127, 196, 205...
• Sempre indique: "art. X do CC/2002", "art. X do CPC/2015", "art. X da CF/88".`;
}

export function buildRagContext(jurisprudencias: Jurisprudencia[]): string {
  if (jurisprudencias.length === 0) {
    return "⚠ ATENÇÃO: Nenhuma jurisprudência foi fornecida. Não cite decisões judiciais na peça.";
  }

  const items = jurisprudencias.map((j, i) => `
┌─ [JUR-${i + 1}] ─────────────────────────────────────────
│ Tribunal : ${j.tribunal}
│ Processo : ${j.numero}
│ Relator  : ${j.relator}
│ Julgado  : ${j.dataJulgamento}
│ Ementa   : ${j.ementa}
│ Link     : ${j.url}
└─────────────────────────────────────────────────────
│ USO OBRIGATÓRIO DE [JUR-${i + 1}]:
│  → Identifique qual NORMA LEGAL esta decisão interpreta.
│  → Enuncie a TESE JURÍDICA central que ela consagra.
│  → Construa um argumento de 2-3 parágrafos aplicando essa tese ao caso.
│  → Vincule explicitamente a um PEDIDO da peça.
└─────────────────────────────────────────────────────`);

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JURISPRUDÊNCIA SELECIONADA PARA ESTE CASO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA FUNDAMENTAL: Cada decisão abaixo está rotulada como [JUR-N].
• TODA [JUR-N] DEVE ser usada na peça com argumento desenvolvido — não como decoração.
• Para usar uma [JUR-N] é OBRIGATÓRIO: (1) citar a norma que ela interpreta, (2) enunciar a tese, (3) aplicar ao caso, (4) vincular a um pedido.
• Referência à [JUR-N] no texto deve usar exatamente esse rótulo para rastreabilidade.
• PROIBIDO: mencionar a decisão apenas pelo número sem extrair e desenvolver o argumento.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${items.join("\n")}`;
}

export function buildDocumentPrompt(
  type: "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
  caseDescription: string,
  jurisprudencias: Jurisprudencia[],
  instruction?: string,
): string {
  const instructionBlock = instruction?.trim()
    ? `\n━━━ ORIENTAÇÃO ESPECÍFICA DO USUÁRIO ━━━\n${instruction.trim()}\nSiga esta orientação com prioridade, sem abrir mão das regras de precisão jurídica.\n`
    : "";

  const tarefaByType: Record<string, string> = {

    DESPACHO: `Redija uma MINUTA DE DESPACHO com linguagem judicial precisa e impessoal.

ESTRUTURA:
I — RELATÓRIO SUMÁRIO: síntese objetiva do que motivou o despacho.
II — FUNDAMENTAÇÃO: fundamente com artigo(s) aplicável(is) do CPC/2015 ou legislação específica. Se houver jurisprudência no contexto, aplique-a ao raciocínio.
III — DISPOSITIVO: determinação clara, direta e sem ambiguidade.

ESTILO: impessoal, técnico, conciso. Despacho não é sentença — evite prolixidade.`,

    DECISAO: `Redija uma MINUTA DE DECISÃO INTERLOCUTÓRIA completa e fundamentada.

ESTRUTURA:
I — RELATÓRIO: síntese dos fatos processuais relevantes à decisão.
II — FUNDAMENTAÇÃO JURÍDICA:
   • Identifique o pressuposto legal da questão decidida (artigo específico do CPC/2015 ou legislação material).
   • Para cada jurisprudência fornecida: enuncie a tese que ela consagra, desenvolva o argumento e aplique ao caso.
   • Construa a cadeia lógica: premissa legal → tese jurisprudencial → subsunção ao fato concreto.
III — DISPOSITIVO: decisão expressa com seus efeitos.`,

    SENTENCA: `Redija uma MINUTA DE SENTENÇA completa, exaustiva e tecnicamente impecável.

ESTRUTURA:
I — RELATÓRIO: síntese cronológica dos fatos e do processado.
II — FUNDAMENTAÇÃO JURÍDICA (seção central — desenvolva com máxima profundidade):
   2.1 QUESTÕES PRELIMINARES (se houver): prescrição, decadência, legitimidade, etc. — cada uma com artigo específico.
   2.2 MÉRITO:
      • Para cada tese relevante: enuncie, fundamente em artigo específico, cite e elabore a jurisprudência correspondente do contexto, aplique ao caso.
      • Estruture como: Tese → Lei → Jurisprudência (com raciocínio desenvolvido) → Aplicação ao caso.
      • Aborde todas as alegações das partes, acolhendo ou rejeitando com fundamento.
III — DISPOSITIVO:
   • Julgamento expresso (procedente/improcedente/parcialmente procedente).
   • Condenação em honorários (art. 85 do CPC/2015) e custas.
   • Indicação de recurso cabível e prazo.`,

    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, densa e tecnicamente sofisticada em favor da parte autora.
Adote tom persuasivo, argumentativo e robusto, próprio das maiores bancas de advocacia do país.

⚠ COMPRIMENTO OBRIGATÓRIO: Esta peça deve ter no MÍNIMO 4.000 palavras. A seção III (Do Direito) deve ter ao menos 6 subteses, cada uma desenvolvida em 3 ou mais parágrafos. Não resuma — aprofunde cada argumento ao máximo.

ESTRUTURA OBRIGATÓRIA — desenvolva cada seção com profundidade:

[ENDEREÇAMENTO CONFORME COMPETÊNCIA]

I — DA QUALIFICAÇÃO DAS PARTES
Crie qualificação completa com dados fictícios verossímeis para os dados não fornecidos.
OBRIGATÓRIO: use nomes brasileiros completos (ex: "Maria de Lourdes da Silva"), endereço fictício completo, CPF mascarado (ex: "***.***.123-**"), profissão e estado civil coerentes com o caso.
NUNCA deixe colchetes como [Nome do Autor] ou [endereço] — substitua sempre por dados fictícios plausíveis.

II — DOS FATOS
Narre cronologicamente, com detalhes e persuasão. Destaque o impacto das condutas da parte contrária e a situação de vulnerabilidade ou prejuízo do autor.

III — DO DIREITO
Construa a argumentação jurídica tese por tese. Para cada tese, siga OBRIGATORIAMENTE:

   ► TESE [número]: [enunciado claro da proposição jurídica]

   FUNDAMENTO LEGAL: cite o artigo específico e o diploma (ex: "art. 186 do CC/2002").
   Só cite artigo que você tem certeza que existe e se aplica ao caso.
   Se incerto sobre o número exato, cite o princípio sem inventar: "princípio da boa-fé objetiva (CC/2002)".

   ARGUMENTO: 3-4 parágrafos desenvolvendo a tese — conecte o artigo, os fatos do caso e as consequências jurídicas.

   JURISPRUDÊNCIA [JUR-N]: Cite pelo rótulo exato.
   • Norma interpretada: qual artigo/princípio essa decisão aplica.
   • Tese consagrada: o que o tribunal decidiu e por quê.
   • Aplicação ao caso: como essa tese se aplica diretamente aos fatos narrados no item II.
   • Conexão com pedido: qual pedido do item VI essa jurisprudência fundamenta.

   REGRA: uma tese por jurisprudência fornecida, no mínimo. Toda [JUR-N] deve aparecer aqui com argumento completo.

IV — DA TUTELA DE URGÊNCIA (omita se não houver urgência no caso)
   Fumus boni iuris: demonstre com os argumentos do item III.
   Periculum in mora: demonstre o risco concreto de dano irreparável.
   Fundamento: art. 300 do CPC/2015.

V — DA GRATUIDADE DA JUSTIÇA (omita se não houver hipossuficiência)
   Art. 98 do CPC/2015 c/c art. 5º, LXXIV da CF/88.

VI — DOS PEDIDOS
Liste numerados. Cada pedido DEVE conter:
   [N]. [Descrição do pedido], com fundamento no [artigo X do diploma Y] e conforme consagrado em [JUR-N].

Inclua pedido de condenação em honorários advocatícios (art. 85 do CPC/2015).
Inclua pedido de inversão/condenação em custas processuais.

VII — DO VALOR DA CAUSA
Calcule e justifique com base nos pedidos (art. 292 do CPC/2015).

ATENÇÃO: produza apenas o texto final da peça. Sem notas, ressalvas, disclaimers ou comentários de IA.`,

    RECURSO: `Redija um RECURSO completo, denso e tecnicamente sofisticado em favor da parte recorrente.
Adote tom combativo e persuasivo, próprio das grandes bancas de advocacia.

ESTRUTURA OBRIGATÓRIA:

I — DA TEMPESTIVIDADE
Comprove com base nas datas disponíveis (art. 1.003 do CPC/2015).

II — DO CABIMENTO E PREPARO
Identifique o recurso cabível (apelação, agravo, etc.) e seu fundamento legal. Indique o preparo ou a isenção.

III — DOS FATOS E DA DECISÃO RECORRIDA
Resuma os fatos e aponte com precisão cirúrgica os erros da decisão recorrida.

IV — DAS RAZÕES RECURSAIS
Para cada ponto impugnado, abra um subitem com a estrutura OBRIGATÓRIA:

   ► PONTO [número]: [erro específico da decisão]

   VÍCIO: error in judicando ou error in procedendo.
   NORMA VIOLADA: artigo específico do diploma correto que a decisão recorrida desrespeitou.
   Só cite artigo que você tem certeza que existe. Se incerto, cite o princípio sem inventar artigo.

   ARGUMENTO LEGAL: desenvolva como a norma citada foi violada — premissa legal, fato processual, vício da decisão.

   JURISPRUDÊNCIA [JUR-N]: cite pelo rótulo exato.
   • Norma interpretada: qual artigo/princípio essa decisão aplica.
   • Tese consagrada: o que o tribunal decidiu (contraponha à decisão recorrida).
   • Distinção ou reforço: mostre como a tese da [JUR-N] contradiz ou expõe o erro da decisão recorrida.

   CONCLUSÃO: o que deve ser reformado/anulado e qual o resultado pretendido.

   Seja exaustivo. Cada [JUR-N] deve aparecer vinculada a um ponto específico de impugnação.

V — DO PEDIDO
Requeira o conhecimento e o provimento do recurso. Liste os efeitos pretendidos com fundamento legal para cada um.
Formato: "requer-se [resultado] com fundamento no [art. X do Y]".

ATENÇÃO: produza apenas o texto da peça. Sem notas, ressalvas ou disclaimers.`,
  };

  return `${buildRagContext(jurisprudencias)}
${instructionBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASO EM ANÁLISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${caseDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHECKLIST ANTES DE REDIGIR (execute obrigatoriamente):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Identifiquei a competência (federal ou estadual)?
□ Cada [JUR-N] está conectada a: (1) uma norma legal, (2) uma tese desenvolvida, (3) um pedido?
□ Toda [JUR-N] fornecida foi usada com argumento completo — nenhuma ficou sem explorar?
□ Todo artigo citado: tenho certeza que ele existe nesse diploma e se aplica ao caso?
□ Se havia dúvida sobre algum artigo: descrevi o princípio sem inventar número?
□ Não inventei nenhum dado (processo, relator, data, CPF, valor)?
□ Cada pedido cita o artigo legal que o fundamenta E a [JUR-N] que o suporta?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  const docsBlock = documents.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTOS DO PROCESSO (fonte primária dos fatos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO: estes são os documentos reais do caso. Extraia deles os fatos, dados e argumentos. Não invente o que não estiver aqui.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${documents.join("\n\n---\n\n")}`
    : "";

  const legBlock = Object.keys(legislation).length > 0
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEGISLAÇÃO VERIFICADA NA FONTE OFICIAL (Planalto)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO: USE SEMPRE esta versão como fonte primária para citar os artigos abaixo. O texto está conferido. Para leis não presentes neste bloco, você pode citar artigos de diplomas consolidados (CC, CPC, CF, CLT etc.) desde que tenham relação direta com o caso — jamais invente números de artigos.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(legislation).map(([lei, texto]) => `\n=== ${lei} ===\n${texto}`).join("\n\n")}`
    : "";

  const jurBlock = buildRagContext(jurisprudencias);

  const instructionBlock = instruction?.trim()
    ? `\n━━━ ORIENTAÇÃO ESPECÍFICA DO USUÁRIO ━━━\n${instruction.trim()}\nSiga esta orientação com prioridade.\n`
    : "";

  const caseBlock = caseDescription?.trim()
    ? `\n━━━ CONTEXTO ADICIONAL DO CASO ━━━\n${caseDescription.trim()}\n`
    : "";

  const isPostulatorio = type === "PETICAO_INICIAL" || type === "RECURSO";

  const regraLeg = isPostulatorio
    ? `2. LEGISLAÇÃO: use PRIORITARIAMENTE os artigos do bloco "LEGISLAÇÃO VERIFICADA" acima. Para dispositivos não presentes nesse bloco, cite apenas artigos de diplomas consolidados (CC/2002, CPC/2015, CF/88, CLT, CDC, Lei 8.213/91, Lei 8.112/90, etc.) dos quais você tenha CERTEZA que o artigo existe e se aplica ao caso. Se houver dúvida sobre o número exato de um artigo, descreva o princípio jurídico sem inventar número. NUNCA cite portaria, decreto ou lei especial que não esteja no bloco verificado.`
    : `2. LEGISLAÇÃO: cite APENAS artigos presentes no bloco "LEGISLAÇÃO VERIFICADA" acima ou de diplomas processuais (CPC/2015) diretamente aplicáveis ao ato. Para qualquer outro diploma, descreva o princípio sem citar artigo. Não invente número de artigo.`;

  const tarefaByType: Record<string, string> = {

    DESPACHO: `Redija uma MINUTA DE DESPACHO precisa, com base nos documentos do processo.

ESTRUTURA:
I — RELATÓRIO SUMÁRIO: síntese do que motivou o despacho, extraída dos documentos.
II — FUNDAMENTAÇÃO: artigo aplicável do CPC/2015 ou da legislação verificada. Se houver jurisprudência, aplique ao raciocínio.
III — DISPOSITIVO: determinação clara e sem ambiguidade.`,

    DECISAO: `Redija uma MINUTA DE DECISÃO INTERLOCUTÓRIA completa, com base nos documentos do processo.

ESTRUTURA:
I — RELATÓRIO: síntese processual com base nos documentos.
II — FUNDAMENTAÇÃO JURÍDICA:
   • Dispositivo legal da legislação verificada que rege a questão.
   • Para cada jurisprudência: tese consagrada + desenvolvimento + aplicação ao caso.
   • Cadeia lógica: premissa legal → tese jurisprudencial → subsunção.
III — DISPOSITIVO: decisão expressa com efeitos.`,

    SENTENCA: `Redija uma MINUTA DE SENTENÇA completa e exaustiva, com base nos documentos do processo.

ESTRUTURA:
I — RELATÓRIO: cronologia processual extraída dos documentos.
II — FUNDAMENTAÇÃO JURÍDICA:
   2.1 Questões preliminares (art. 337 do CPC/2015, se houver).
   2.2 Mérito — para cada tese:
      Tese → artigo da legislação verificada → jurisprudência do contexto (tese + aplicação ao caso) → conclusão.
III — DISPOSITIVO: julgamento + honorários (art. 85 CPC/2015) + custas + recurso cabível.`,

    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, densa e sofisticada, com base nos documentos fornecidos.
Tom persuasivo e robusto, próprio das maiores bancas de advocacia.

ESTRUTURA OBRIGATÓRIA:

[ENDEREÇAMENTO CONFORME COMPETÊNCIA]

I — DA QUALIFICAÇÃO DAS PARTES
(extraída dos documentos; use [DADO NÃO FORNECIDO] onde faltar)

II — DOS FATOS
(narrativa cronológica e persuasiva extraída dos documentos do processo)

III — DO DIREITO
Para cada tese, siga OBRIGATORIAMENTE:

   ► TESE [número]: [enunciado claro da proposição jurídica]

   FUNDAMENTO LEGAL: artigo específico da legislação verificada ou de diploma consolidado.
   Só cite artigo que você tem certeza que existe e se aplica ao caso.
   Se incerto sobre o número exato, cite o princípio sem inventar: "princípio da boa-fé objetiva (CC/2002)".

   ARGUMENTO: 3-4 parágrafos desenvolvendo a tese — conecte o artigo, os fatos dos documentos e as consequências jurídicas.

   JURISPRUDÊNCIA [JUR-N]: cite pelo rótulo exato.
   • Norma interpretada: qual artigo/princípio essa decisão aplica.
   • Tese consagrada: o que o tribunal decidiu e por quê.
   • Aplicação ao caso: como essa tese se aplica diretamente aos fatos dos documentos.
   • Conexão com pedido: qual pedido do item VI essa jurisprudência fundamenta.

   REGRA: mínimo de uma tese por jurisprudência fornecida. Toda [JUR-N] deve aparecer com argumento completo.

IV — DA TUTELA DE URGÊNCIA (omita se inaplicável)
   Fumus boni iuris + periculum in mora. Art. 300 do CPC/2015.

V — DA GRATUIDADE DA JUSTIÇA (omita se inaplicável)
   Art. 98 do CPC/2015 c/c art. 5º, LXXIV da CF/88.

VI — DOS PEDIDOS
Cada pedido DEVE conter:
   [N]. [Descrição do pedido], com fundamento no [artigo X do diploma Y] e conforme consagrado em [JUR-N].

Inclua honorários advocatícios (art. 85 do CPC/2015) e custas processuais.

VII — DO VALOR DA CAUSA (art. 292 CPC/2015)

ATENÇÃO: produza apenas o texto final da peça. Sem notas, ressalvas ou disclaimers.`,

    RECURSO: `Redija um RECURSO completo, denso e sofisticado, com base nos documentos fornecidos.
Tom combativo e persuasivo.

ESTRUTURA OBRIGATÓRIA:

I — DA TEMPESTIVIDADE (art. 1.003 CPC/2015)

II — DO CABIMENTO E PREPARO

III — DOS FATOS E DA DECISÃO RECORRIDA
(síntese dos fatos dos documentos + erros específicos da decisão recorrida)

IV — DAS RAZÕES RECURSAIS
Para cada ponto impugnado, siga a estrutura OBRIGATÓRIA:

   ► PONTO [número]: [erro específico da decisão]

   VÍCIO: error in judicando ou error in procedendo.
   NORMA VIOLADA: artigo específico da legislação verificada que a decisão recorrida desrespeitou.
   Só cite artigo que você tem certeza que existe. Se incerto, cite o princípio sem inventar número.

   ARGUMENTO LEGAL: como a norma foi violada — premissa legal, fato, vício da decisão.

   JURISPRUDÊNCIA [JUR-N]: cite pelo rótulo exato.
   • Norma interpretada: qual artigo/princípio essa decisão aplica.
   • Tese consagrada: o que o tribunal decidiu (contraponha à decisão recorrida).
   • Distinção ou reforço: como a tese da [JUR-N] contradiz ou expõe o erro da decisão recorrida.

   CONCLUSÃO: reforma ou anulação pretendida, com efeito concreto.

   Toda [JUR-N] deve aparecer vinculada a um ponto específico de impugnação.

V — DO PEDIDO
Liste os efeitos pretendidos com fundamento legal para cada um.
Formato: "requer-se [resultado] com fundamento no [art. X do Y]".

ATENÇÃO: produza apenas o texto da peça. Sem notas, ressalvas ou disclaimers.`,
  };

  return `${docsBlock}

---

${jurBlock}

---

${legBlock}

---
${caseBlock}${instructionBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS — INVIOLÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. JURISPRUDÊNCIA: cite APENAS as decisões rotuladas [JUR-N] acima. Para cada uma: (a) cite a norma interpretada, (b) enuncie a tese, (c) desenvolva o argumento de 2-3 parágrafos, (d) conecte a um pedido. Nenhuma [JUR-N] pode ficar sem argumento desenvolvido.
${regraLeg}
3. FATOS: JAMAIS invente dados (processos, nomes, CPF, datas, valores) não presentes nos documentos.
4. COMPLETUDE: a peça deve ser extensa e tecnicamente densa. Não resuma onde cabe fundamentar.
5. CHECKLIST antes de entregar: □ toda [JUR-N] tem norma + tese + argumento + pedido vinculado? □ todo artigo citado existe nesse diploma e se aplica ao caso? □ onde havia dúvida no artigo, usei o princípio em vez de inventar? □ cada pedido cita artigo e [JUR-N]?

TAREFA:
${tarefaByType[type]}`;
}

export function buildAnalysisPrompt(
  caseDescription: string,
  jurisprudencias: Jurisprudencia[]
): string {
  return `${buildRagContext(jurisprudencias)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASO EM ANÁLISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${caseDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREFA — ANÁLISE JURISPRUDENCIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada decisão do contexto:
1. Identifique a TESE JURÍDICA central que ela consagra.
2. Avalie o GRAU DE RELEVÂNCIA para o caso (alta / média / baixa) e justifique.
3. Aponte como a tese da decisão pode ser APLICADA ou DISTINGUIDA no caso concreto.

Ao final:
4. Indique a TENDÊNCIA JURISPRUDENCIAL geral (favorável, desfavorável ou divergente para a pretensão do autor).
5. Liste os PONTOS DE ATENÇÃO: distinções, riscos ou lacunas que a parte deverá enfrentar.
6. Sugira os ARTIGOS DE LEI mais relevantes para fundamentar a pretensão com base nas teses identificadas.`;
}
