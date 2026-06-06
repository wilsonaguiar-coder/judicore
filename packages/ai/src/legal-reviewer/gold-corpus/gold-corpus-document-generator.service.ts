/**
 * FASE 9.0.5B — Gerador Determinístico de Documentos Jurídicos Sintéticos
 *
 * Transforma cada GoldCorpusCase em um documento jurídico textual estruturado.
 *
 * Regras de design:
 * - Sem Math.random(), sem new Date(), sem chamadas de rede, sem I/O.
 * - generatedAt sempre fixo: "2026-06-06T00:00:00.000Z"
 * - Mesmo caseId sempre produz mesmo texto (determinístico).
 * - Defeitos planejados aparecem indiretamente — nunca como rótulos.
 * - Textos proibidos no documento: "defeito planejado", "finding esperado",
 *   "score esperado", "erro inserido", "teste sintético".
 */

import type { GoldCorpusCase } from "./gold-corpus.types.js";

// ─── Interface pública ────────────────────────────────────────────────────────

export interface GeneratedGoldCorpusDocument {
  caseId: string;
  domain: string;
  documentType: string;
  subtype?: string;
  title: string;
  text: string;
  plantedIssues: string[];
  expectedFindings: string[];
  expectedScoreRange: { min: number; max: number };
  metadata: {
    synthetic: true;
    generatedAt: string;
    generatorVersion: "v1";
    quality: string;
    difficulty: string;
  };
}

// ─── Endereçamentos por domínio ───────────────────────────────────────────────

const DOMAIN_ADDRESSEE: Record<string, string> = {
  RGPS: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA",
  RPPS: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA",
  TRABALHISTA: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DO TRABALHO DA VARA DO TRABALHO",
  TRIBUTARIO: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA TRIBUTÁRIA",
  FAMILIA: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA DE FAMÍLIA E SUCESSÕES",
  CONSUMIDOR: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DO JUIZADO ESPECIAL CÍVEL",
  CRIMINAL: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CRIMINAL",
  FAZENDA_PUBLICA: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA DA FAZENDA PÚBLICA",
  AMBIENTAL: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA DO MEIO AMBIENTE",
  CIVEL: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL",
  JUIZADO_ESPECIAL: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DO JUIZADO ESPECIAL CÍVEL",
};

const DOMAIN_COMPETENCIA: Record<string, string> = {
  RGPS: "Justiça Federal — competência da Vara Previdenciária nos termos do art. 109, I, da CF/88",
  RPPS: "Justiça Federal — competência federal em razão da matéria previdenciária de servidor público",
  TRABALHISTA: "Justiça do Trabalho — competência nos termos do art. 114 da CF/88",
  TRIBUTARIO: "Justiça Federal — competência nos termos do art. 109, I, da CF/88",
  FAMILIA: "Vara de Família — competência ratione materiae",
  CONSUMIDOR: "Juizado Especial Cível — competência nos termos da Lei 9.099/95, art. 3º",
  CRIMINAL: "Vara Criminal — competência nos termos do CPP e da Lei de Organização Judiciária",
  FAZENDA_PUBLICA: "Vara da Fazenda Pública — competência ratione personae",
  AMBIENTAL: "competência nos termos da LACP (Lei 7.347/85) e legislação ambiental federal",
  CIVEL: "Vara Cível — competência ratione materiae e valoris",
  JUIZADO_ESPECIAL: "Juizado Especial — competência nos termos da Lei 9.099/95",
};

// ─── Títulos por documentType ─────────────────────────────────────────────────

function buildTitle(caseSpec: GoldCorpusCase): string {
  const { documentType, subtype, domain, id } = caseSpec;
  const domainLabel = domain.replace(/_/g, " ");
  const effectiveType = subtype ?? documentType;

  switch (documentType) {
    case "PETICAO_INICIAL":
      return `PETIÇÃO INICIAL — ${domainLabel} (${id})`;
    case "CONTESTACAO":
      return `CONTESTAÇÃO — ${domainLabel} (${id})`;
    case "RECURSO":
      if (subtype === "EMBARGOS") return `EMBARGOS DE DECLARAÇÃO — ${domainLabel} (${id})`;
      return `RECURSO — ${domainLabel} (${id})`;
    case "SENTENCA":
      return `SENTENÇA — ${domainLabel} (${id})`;
    case "DECISAO":
      return `DECISÃO INTERLOCUTÓRIA — ${domainLabel} (${id})`;
    case "DESPACHO":
      return `DESPACHO — ${domainLabel} (${id})`;
    case "CUMPRIMENTO_SENTENCA":
      return `CUMPRIMENTO DE SENTENÇA — ${domainLabel} (${id})`;
    default:
      return `${effectiveType} — ${domainLabel} (${id})`;
  }
}

// ─── Blocos de fatos por domínio ──────────────────────────────────────────────

function buildFactsBlock(caseSpec: GoldCorpusCase): string {
  const { domain, scenario, quality } = caseSpec;
  const isGood = quality === "GOOD";
  const isLight = quality === "LIGHT_ISSUES";

  const baseNarrative = `O(a) autor(a), devidamente qualificado(a) nos autos, vem expor os fatos que fundamentam a presente ação.

${scenario}`;

  const domainFacts: Record<string, string> = {
    RGPS: isGood
      ? `O(a) segurado(a) comprova filiação ao Regime Geral de Previdência Social — RGPS desde [DATA DE FILIAÇÃO], com contribuições regulares devidamente lançadas no CNIS. A Data de Entrada do Requerimento — DER ocorreu em [DATA DA DER], estando o(a) segurado(a) com a qualidade de segurado(a) mantida. Todos os documentos comprobatórios foram organizados e estão acostados aos autos, incluindo extratos do CNIS, histórico funcional e laudos médicos quando pertinentes.`
      : isLight
      ? `O(a) segurado(a) é filiado(a) ao RGPS e apresentou requerimento administrativo junto ao INSS. Os documentos constam parcialmente dos autos, embora alguns campos dos formulários previdenciários não tenham sido integralmente analisados na peça inicial.`
      : `O(a) segurado(a) afirma ser filiado(a) ao RGPS, porém os detalhes documentais essenciais ao direito pleiteado não foram apresentados de forma estruturada.`,

    RPPS: isGood
      ? `O(a) servidor(a) público(a) está regularmente vinculado(a) ao Regime Próprio de Previdência Social — RPPS desde [DATA DE INGRESSO], com tempo de contribuição, cargo efetivo e requisito etário devidamente demonstrados. A regra constitucional de aposentadoria aplicável ao caso concreto foi expressamente identificada.`
      : isLight
      ? `O(a) servidor(a) público(a) ingressou no cargo efetivo em [DATA] e busca o reconhecimento do seu direito previdenciário. Algumas particularidades da regra de transição não foram aprofundadas na peça.`
      : `O(a) servidor(a) pleiteia benefício previdenciário sem identificar com precisão a regra de transição ou o artigo constitucional aplicável à sua situação funcional específica.`,

    TRABALHISTA: isGood
      ? `O(a) reclamante trabalhou para a reclamada no período de [DATA INÍCIO] a [DATA RESCISÃO], exercendo a função de [FUNÇÃO]. A jornada, salário e demais condições de trabalho estão documentados por meio de controles de ponto, holerites e comunicados internos juntados aos autos. A rescisão se deu por [MODALIDADE], sendo contestadas as parcelas listadas no rol de pedidos.`
      : isLight
      ? `O(a) reclamante laborou para a reclamada por período não inferior a [PERÍODO], exercendo funções que gerariam os direitos ora reclamados. A documentação trabalhista foi parcialmente juntada, com lacunas em alguns meses do período contratual.`
      : `O(a) reclamante afirma ter trabalhado para a reclamada, mas não apresenta documentação sistemática da jornada, salário ou condições contratuais, fragilizando a demonstração dos fatos constitutivos.`,

    TRIBUTARIO: isGood
      ? `O(a) contribuinte, devidamente qualificado(a), recolheu os tributos conforme descrito no período de [PERÍODO], tendo sido lavrado auto de infração em [DATA] ou realizado pagamento indevido conforme comprovantes acostados. A norma tributária aplicável e o entendimento do STF/STJ sobre a matéria foram expressamente citados.`
      : isLight
      ? `O(a) contribuinte busca a tutela jurisdicional em matéria tributária, apresentando documentos de pagamento e auto de infração. A memória de cálculo foi incluída, porém sem detalhamento de cada período de apuração.`
      : `O(a) contribuinte pleiteia a restituição/exclusão de tributo sem apresentar de forma estruturada os documentos fiscais ou a memória de cálculo que demonstre o montante pleiteado.`,

    FAMILIA: isGood
      ? `As partes mantiveram [RELAÇÃO JURÍDICA FAMILIAR] até [DATA], dela resultando as consequências ora discutidas. Os documentos pessoais, comprovantes de renda, certidão de nascimento dos filhos e demais elementos probatórios foram acostados aos autos de forma completa.`
      : isLight
      ? `As partes mantiveram relação jurídica familiar, e a presente ação visa regulamentar os efeitos decorrentes. Documentos de renda foram parcialmente apresentados, sendo alguns de difícil obtenção em razão da natureza informal das atividades do(a) [REQUERIDO(A)/ALIMENTANTE].`
      : `A parte autora narra a existência de relação familiar sem apresentar elementos suficientes para demonstrar os pressupostos do direito pleiteado, como comprovação de renda, convivência ou dependência.`,

    CONSUMIDOR: isGood
      ? `O(a) consumidor(a), na qualidade de destinatário(a) final, contratou os serviços/adquiriu o produto da fornecedora em [DATA], pagando o valor de [VALOR]. A falha na prestação do serviço ou vício do produto está documentada por nota fiscal, print de tela, protocolo de reclamação e demais meios de prova acostados.`
      : isLight
      ? `O(a) consumidor(a) adquiriu produto/contratou serviço da fornecedora e alega descumprimento contratual ou vício. A documentação de aquisição foi apresentada, mas os registros de tentativa de resolução extrajudicial estão incompletos.`
      : `O(a) consumidor(a) afirma ter sofrido dano decorrente de relação de consumo, porém sem apresentar documentação suficiente que comprove a contratação, o vício alegado ou o dano concreto sofrido.`,

    CRIMINAL: isGood
      ? `Os fatos ocorreram em [DATA] e foram devidamente registrados em boletim de ocorrência, laudo pericial, depoimentos e demais elementos de prova colhidos na fase investigatória. A autoria, materialidade e tipicidade estão devidamente suportadas pelo conjunto probatório carreado aos autos.`
      : isLight
      ? `Os fatos criminosos foram parcialmente documentados. O boletim de ocorrência e o depoimento da vítima constam dos autos, mas o laudo pericial apresenta conclusão que merece contraponto fundamentado.`
      : `A denúncia/defesa não enfrentou adequadamente os elementos probatórios contrários à tese sustentada, deixando lacunas significativas no enfrentamento das provas produzidas em fase anterior.`,

    FAZENDA_PUBLICA: isGood
      ? `A Administração Pública praticou o ato [DESCRIÇÃO DO ATO] em [DATA], conforme documentado por [DOCUMENTOS]. O ato é ilegal/irregular pelos fundamentos a seguir expostos, que contam com suporte na jurisprudência do STJ e nos princípios da legalidade e moralidade administrativas.`
      : isLight
      ? `A parte autora questiona ato da Administração Pública, apresentando cópia do ato impugnado. A fundamentação normativa foi indicada, mas sem análise aprofundada da discricionariedade e dos limites do controle judicial.`
      : `A parte autora questiona ato administrativo sem identificar com precisão o fundamento legal da ilegalidade alegada, limitando-se a afirmações genéricas sobre violação de direito.`,

    AMBIENTAL: isGood
      ? `O dano ambiental ou a irregularidade ora discutida foi constatada em [DATA], conforme laudo técnico do [ÓRGÃO], vistoria administrativa e documentação fotográfica acostados. O(a) réu(ré)/autuado(a) é responsável pelos fatos nos termos da Lei 9.605/98 e demais normas ambientais aplicáveis.`
      : isLight
      ? `A matéria ambiental foi descrita com base em auto de infração e documentação administrativa. O nexo de causalidade entre a conduta e o dano foi mencionado, mas sem análise técnica aprofundada dos efeitos ambientais.`
      : `A demanda ambiental carece de suporte técnico adequado — o nexo causal entre a conduta descrita e o dano ao meio ambiente não foi suficientemente demonstrado por laudos ou documentação técnica.`,

    CIVEL: isGood
      ? `O(a) autor(a) e o(a) réu(ré) mantiveram relação jurídica [CONTRATUAL/EXTRACONTRATUAL] que gerou os direitos ora reclamados. Os fatos estão documentados por [DOCUMENTOS], e o nexo causal entre a conduta do(a) réu(ré) e os danos sofridos está demonstrado de forma clara e objetiva.`
      : isLight
      ? `As partes mantiveram relação jurídica que culminou no litígio ora submetido ao Judiciário. Os documentos essenciais foram juntados, mas a linha do tempo dos fatos e o nexo causal poderiam ser mais detalhados.`
      : `O(a) autor(a) narra fatos que teriam gerado dano, mas sem apresentar documentação suficiente para demonstrar a existência da relação jurídica, o inadimplemento ou o nexo causal entre conduta e dano.`,

    JUIZADO_ESPECIAL: isGood
      ? `O(a) autor(a), por direito próprio nos termos do art. 9º da Lei 9.099/95, descreve fatos simples e de fácil compreensão que geraram o dano ora reclamado, devidamente documentados por [DOCUMENTOS]. O valor da causa é compatível com a alçada do Juizado.`
      : isLight
      ? `O(a) autor(a) busca reparação por danos simples, apresentando documentação parcial. Alguns aspectos do dano efetivo não foram suficientemente quantificados ou documentados.`
      : `O(a) autor(a) narra situação de conflito sem apresentar documentação ou cálculo que embase o pedido, tornando difícil a análise do direito pleiteado sem instrução probatória adicional.`,
  };

  const domainFact = domainFacts[domain] ?? `Trata-se de demanda jurídica pertinente ao domínio ${domain}, cujos fatos são descritos conforme o cenário acima.`;

  return `${baseNarrative}

${domainFact}`;
}

// ─── Fundamentação jurídica por domínio e qualidade ──────────────────────────

function buildFoundationsBlock(caseSpec: GoldCorpusCase): string {
  const { domain, quality } = caseSpec;
  const isGood = quality === "GOOD";
  const isLight = quality === "LIGHT_ISSUES";
  const isModerate = quality === "MODERATE_ISSUES";

  const depthIntro = isGood
    ? "O direito ao provimento pleiteado está assentado nos seguintes fundamentos normativos e jurisprudenciais:"
    : isLight
    ? "O direito pleiteado encontra amparo nos seguintes fundamentos, que serão brevemente expostos:"
    : isModerate
    ? "A fundamentação jurídica da pretensão autoral apoia-se nos dispositivos a seguir indicados:"
    : "O pedido encontra, em síntese, o seguinte fundamento:";

  const domainFoundations: Record<string, string> = {
    RGPS: isGood
      ? `1. Direito material: Lei 8.213/91 — requisitos, carência e benefício aplicável ao caso concreto.
2. Direito processual: RISTF, Portaria MPS e IN INSS pertinentes.
3. Jurisprudência consolidada do STJ e TRFs sobre o tema específico.
4. O cômputo dos períodos é feito nos termos do art. 55 da Lei 8.213/91 e regulamento.
5. A DER foi devidamente comprovada, e a data de início do benefício (DIB) seguirá as regras legais.`
      : isLight
      ? `1. Lei 8.213/91, artigos pertinentes ao benefício pleiteado.
2. Jurisprudência do STJ sobre o tema — indicada de forma genérica.
3. O tempo de contribuição foi calculado, embora sem detalhar a metodologia aplicada.`
      : isModerate
      ? `1. Lei 8.213/91.
2. Precedentes judiciais aplicáveis — sem citação específica de acórdãos.
3. Fundamentos gerais do direito previdenciário.`
      : `1. Lei 8.213/91, dispositivos gerais.`,

    RPPS: isGood
      ? `1. Emenda Constitucional 103/2019 — regras de transição aplicáveis ao histórico funcional do servidor.
2. Lei do RPPS do ente federativo competente.
3. Jurisprudência do STF sobre paridade, integralidade e abono de permanência.
4. Identificação expressa da regra constitucional de aposentadoria incidente.`
      : isLight
      ? `1. EC 103/2019 — mencionada sem análise das regras de transição aplicáveis.
2. Lei do RPPS do ente federativo — citação genérica.`
      : isModerate
      ? `1. EC 103/2019 e normas previdenciárias do serviço público — sem identificação da regra de transição.
2. Referência genérica ao direito adquirido.`
      : `1. Normas previdenciárias aplicáveis ao RPPS — sem especificação.`,

    TRABALHISTA: isGood
      ? `1. CLT — artigos pertinentes às parcelas reclamadas.
2. Lei 13.467/2017 (Reforma Trabalhista) — considerada na análise das parcelas extintas ou modificadas.
3. Orientações Jurisprudenciais e Súmulas do TST aplicáveis.
4. A jornada extraordinária é comprovada pelos controles de ponto juntados.
5. Reflexos salariais calculados conforme a natureza de cada verba.`
      : isLight
      ? `1. CLT — artigos pertinentes.
2. Súmulas do TST — mencionadas sem análise individualizada de sua aplicabilidade.
3. As horas extras foram calculadas sem detalhar a metodologia de apuração.`
      : isModerate
      ? `1. CLT — sem identificação dos artigos pertinentes a cada parcela.
2. Precedentes jurisprudenciais — sem citação específica.`
      : `1. CLT — fundamentos gerais.`,

    TRIBUTARIO: isGood
      ? `1. Código Tributário Nacional — normas aplicáveis à espécie.
2. Legislação ordinária específica do tributo discutido.
3. Jurisprudência do STF/STJ — precedentes específicos identificados, incluindo eventual modulação de efeitos.
4. A diferença entre contribuinte de fato e de direito foi observada na construção da tese.
5. A memória de cálculo demonstra o montante objeto da demanda.`
      : isLight
      ? `1. CTN e legislação do tributo.
2. Precedentes do STF/STJ — citados sem análise de modulação de efeitos.
3. A memória de cálculo foi apresentada de forma sintética.`
      : isModerate
      ? `1. CTN — dispositivos gerais.
2. Referência a precedentes tributários sem identificação do tribunal ou acórdão.`
      : `1. Legislação tributária — fundamentos gerais sem especificação.`,

    FAMILIA: isGood
      ? `1. Código Civil de 2002 — artigos aplicáveis ao direito de família.
2. CPC/2015 — procedimento específico para a ação proposta.
3. Princípio do melhor interesse da criança (quando aplicável).
4. Guarda compartilhada como regra — art. 1.584, §2º, CC.
5. Alimentos fixados com base na renda demonstrada e necessidades comprovadas.`
      : isLight
      ? `1. Código Civil — artigos de família citados genericamente.
2. Princípio do melhor interesse da criança — mencionado sem análise concreta.
3. O cálculo dos alimentos foi apresentado sem demonstração detalhada da renda informal do alimentante.`
      : isModerate
      ? `1. Código Civil — referência genérica.
2. Precedentes sobre alimentos — sem análise de proporcionalidade.`
      : `1. Código Civil e CPC — referências genéricas.`,

    CONSUMIDOR: isGood
      ? `1. Código de Defesa do Consumidor — arts. 6º, 12, 14, 18, 20 e demais pertinentes.
2. Responsabilidade objetiva do fornecedor nos termos do CDC.
3. Dano moral configurado pela gravidade da conduta e seus efeitos concretos.
4. Devolução em dobro — art. 42, parágrafo único, CDC — quando aplicável e comprovada a cobrança indevida com má-fé.`
      : isLight
      ? `1. CDC — artigos gerais.
2. Dano moral — mencionado sem desenvolvimento sobre a gravidade da situação concreta.
3. Devolução em dobro — pedida sem análise da má-fé do fornecedor.`
      : isModerate
      ? `1. CDC — referência genérica.
2. Dano moral — afirmado sem análise da extensão do dano concreto.`
      : `1. CDC — fundamentos gerais.`,

    CRIMINAL: isGood
      ? `1. Código Penal — tipo penal imputado/contestado com análise de todos os elementos objetivos e subjetivos.
2. Código de Processo Penal — regras de prova, nulidades e procedimento aplicáveis.
3. Provas produzidas na investigação e instrução — analisadas individualmente.
4. Dosimetria da pena: circunstâncias judiciais, agravantes, atenuantes e causas especiais consideradas.
5. Jurisprudência do STJ/STF sobre a matéria — precedentes específicos citados.`
      : isLight
      ? `1. Código Penal — tipo penal citado.
2. CPP — normas procedimentais.
3. A análise das provas foi feita em bloco, sem enfrentamento individualizado de cada elemento.`
      : isModerate
      ? `1. Código Penal e CPP — referências gerais.
2. Precedentes — mencionados sem análise de adequação ao caso concreto.`
      : `1. Dispositivos penais pertinentes — sem desenvolvimento da tipicidade.`,

    FAZENDA_PUBLICA: isGood
      ? `1. Constituição Federal — princípios da legalidade, moralidade e eficiência administrativa.
2. Lei de regência do ato impugnado — com identificação dos dispositivos violados.
3. Jurisprudência do STJ sobre controle judicial de ato administrativo discricionário versus vinculado.
4. Correção monetária e juros: EC 113/2021 — SELIC aplicável às condenações contra a Fazenda.`
      : isLight
      ? `1. CF/88 — princípios administrativos.
2. Lei de regência — citada sem análise dos artigos específicos violados.
3. Correção monetária — mencionada sem identificar os índices aplicáveis.`
      : isModerate
      ? `1. CF/88 e lei de regência — referência genérica.
2. Precedentes sobre atos administrativos — sem distinção entre ato discricionário e vinculado.`
      : `1. Princípios constitucionais administrativos — sem análise concreta.`,

    AMBIENTAL: isGood
      ? `1. Lei 9.605/98 (Lei de Crimes Ambientais) — dispositivos pertinentes.
2. Lei 9.985/2000 e demais normas do SNUC quando aplicável.
3. Decreto 6.514/2008 — prazo prescricional de 3 anos para infrações administrativas ambientais.
4. Responsabilidade objetiva ambiental — art. 14 da Lei 6.938/81.
5. O CAR tem natureza declaratória e não convalida irregularidades anteriores.`
      : isLight
      ? `1. Lei 9.605/98 — citada genericamente.
2. Responsabilidade ambiental — mencionada sem análise do nexo causal técnico.`
      : isModerate
      ? `1. Legislação ambiental — referência genérica sem identificação dos dispositivos específicos.
2. Precedentes — mencionados sem análise.`
      : `1. Lei ambiental — fundamentos gerais.`,

    CIVEL: isGood
      ? `1. Código Civil — artigos pertinentes à responsabilidade civil ou obrigação contratual.
2. Prazo prescricional corretamente identificado para a pretensão deduzida.
3. Nexo causal demonstrado entre a conduta do(a) réu(ré) e o dano sofrido.
4. CPC/2015 — procedimento e prova pertinentes.
5. Jurisprudência do STJ sobre a matéria.`
      : isLight
      ? `1. Código Civil — artigos pertinentes.
2. Prazo prescricional indicado sem análise da pretensão específica.
3. Dano — mencionado sem desenvolvimento sobre sua extensão e nexo.`
      : isModerate
      ? `1. Código Civil — referência genérica.
2. Responsabilidade civil — afirmada sem análise dos pressupostos do art. 186/927 do CC.`
      : `1. Código Civil e CPC — fundamentos gerais.`,

    JUIZADO_ESPECIAL: isGood
      ? `1. Lei 9.099/95 — competência, procedimento e recursos aplicáveis ao Juizado.
2. CDC, CC e demais normas materiais conforme a natureza do litígio.
3. Valor da causa dentro da alçada do Juizado Especial (até 40 salários mínimos).
4. Recursos cabíveis para a Turma Recursal — não para o STJ.`
      : isLight
      ? `1. Lei 9.099/95 — citada genericamente.
2. Normas materiais aplicáveis — identificadas de forma superficial.`
      : isModerate
      ? `1. Lei 9.099/95 e CDC — referência genérica.
2. Valor da causa — indicado sem análise da alçada.`
      : `1. Lei 9.099/95 — fundamentos gerais.`,
  };

  const foundations = domainFoundations[domain] ?? `1. Normas aplicáveis ao domínio ${domain.replace(/_/g, " ")}.`;

  return `${depthIntro}

${foundations}`;
}

// ─── Provas por domínio e qualidade ──────────────────────────────────────────

function buildProofsBlock(caseSpec: GoldCorpusCase): string {
  const { domain, quality } = caseSpec;
  const isGood = quality === "GOOD";
  const isLight = quality === "LIGHT_ISSUES";

  const proofIntro = isGood
    ? "As provas a seguir confirmam os fatos narrados e os fundamentos jurídicos expendidos:"
    : "O(a) autor(a)/requerente junta os seguintes documentos:";

  const domainProofs: Record<string, string> = {
    RGPS: isGood
      ? `a) Extrato CNIS completo e atualizado;
b) Carta de concessão/indeferimento administrativo;
c) PPP e LTCAT quando aplicável ao benefício;
d) Laudo médico e documentação de incapacidade quando pertinente;
e) Documentos de identidade e comprovante de residência.`
      : isLight
      ? `a) Extrato CNIS (parcial);
b) Documento de identidade;
c) Documentos médicos parcialmente juntados.`
      : `a) Documentos de identificação;
b) Documentos previdenciários — a serem complementados.`,

    RPPS: isGood
      ? `a) Certidão de tempo de serviço/contribuição;
b) Portaria de nomeação e histórico funcional;
c) CTC quando houver tempo de outros regimes a averbar;
d) Contracheques que demonstram a remuneração.`
      : isLight
      ? `a) Certidão de tempo parcial;
b) Histórico funcional simplificado;
c) Contracheques do período recente.`
      : `a) Documentação funcional — a complementar.`,

    TRABALHISTA: isGood
      ? `a) Controles de ponto do período contratual;
b) Holerites e recibos salariais;
c) CTPS e contratos de trabalho;
d) Comunicado de rescisão (TRCT, aviso prévio);
e) Notificações e correspondências trocadas com a empregadora.`
      : isLight
      ? `a) CTPS;
b) Holerites de alguns meses;
c) Controles de ponto parciais.`
      : `a) CTPS;
b) Demais documentos a juntar.`,

    TRIBUTARIO: isGood
      ? `a) DARFs ou guias de recolhimento do período;
b) Auto de infração e intimações fiscais;
c) Certidões negativas ou positivas com efeito de negativa;
d) Memória de cálculo detalhada;
e) Pareceres ou consultas formalizadas.`
      : isLight
      ? `a) DARFs do período;
b) Auto de infração;
c) Memória de cálculo simplificada.`
      : `a) Documentos fiscais parciais — a complementar.`,

    FAMILIA: isGood
      ? `a) Certidão de nascimento/casamento/união estável;
b) Comprovantes de renda das partes;
c) Certidão de nascimento dos filhos;
d) Comprovantes de despesas com filhos;
e) Documentos sobre patrimônio comum.`
      : isLight
      ? `a) Certidão de casamento/nascimento;
b) Comprovantes de renda parciais;
c) Extratos bancários de alguns meses.`
      : `a) Documentos pessoais;
b) Comprovantes a complementar.`,

    CONSUMIDOR: isGood
      ? `a) Nota fiscal ou comprovante de contratação;
b) Print de tela ou registro digital da falha/vício;
c) Protocolo de reclamação ao fornecedor;
d) Resposta ou silêncio do fornecedor;
e) Orçamento de reparo ou laudo de vício.`
      : isLight
      ? `a) Nota fiscal;
b) Print de tela da reclamação;
c) Protocolo de atendimento.`
      : `a) Comprovante de aquisição;
b) Demais documentos a juntar.`,

    CRIMINAL: isGood
      ? `a) Boletim de ocorrência;
b) Laudo pericial (IML, local do crime, etc.);
c) Depoimento da vítima e testemunhas;
d) Registros de antecedentes ou certidões negativas;
e) Documentos de autoria e materialidade.`
      : isLight
      ? `a) Boletim de ocorrência;
b) Laudo pericial — sem análise crítica de suas conclusões;
c) Depoimento da vítima.`
      : `a) Boletim de ocorrência;
b) Provas a complementar na instrução.`,

    FAZENDA_PUBLICA: isGood
      ? `a) Cópia do ato administrativo impugnado;
b) Notificação e intimações pertinentes;
c) Documentos que comprovam o direito violado;
d) Pareceres técnicos ou administrativos quando pertinentes;
e) Cálculos atualizados do valor pleiteado.`
      : isLight
      ? `a) Cópia do ato administrativo;
b) Notificação;
c) Cálculos parciais.`
      : `a) Ato administrativo;
b) Documentos a complementar.`,

    AMBIENTAL: isGood
      ? `a) Auto de infração ambiental;
b) Laudo técnico do órgão ambiental ou pericial;
c) Documentação fotográfica e georreferenciada;
d) Cadastro Ambiental Rural — CAR (quando pertinente);
e) Licenças ambientais existentes ou negadas.`
      : isLight
      ? `a) Auto de infração;
b) Documentação fotográfica;
c) CAR — sem análise de sua natureza declaratória.`
      : `a) Auto de infração;
b) Documentação técnica a complementar.`,

    CIVEL: isGood
      ? `a) Contrato ou instrumento formalizador da relação;
b) Comprovantes de pagamento/inadimplência;
c) Notificação extrajudicial;
d) Orçamentos, laudos ou perícia técnica;
e) Documentos de dano moral/material.`
      : isLight
      ? `a) Contrato;
b) Comprovantes parciais de pagamento;
c) Notificação.`
      : `a) Documentos parciais da relação;
b) Demais provas a complementar.`,

    JUIZADO_ESPECIAL: isGood
      ? `a) Comprovante da relação jurídica discutida;
b) Nota fiscal, contrato ou orçamento;
c) Protocolo de reclamação extrajudicial;
d) Orçamento de reparo.`
      : isLight
      ? `a) Comprovante parcial;
b) Print de reclamação.`
      : `a) Documentos disponíveis — demais a juntar.`,
  };

  const proofs = domainProofs[domain] ?? `a) Documentos pertinentes ao domínio ${domain.replace(/_/g, " ")};
b) Demais provas a serem indicadas no curso do processo.`;

  return `${proofIntro}

${proofs}`;
}

// ─── Pedidos por documentType e qualidade ────────────────────────────────────

function buildRequestsBlock(caseSpec: GoldCorpusCase): string {
  const { documentType, domain, quality, subtype } = caseSpec;
  const isGood = quality === "GOOD";

  const preamble = isGood
    ? "Diante do exposto, requer-se a Vossa Excelência que se digne:"
    : "Ante o exposto, pede-se:";

  const genericRequests: Record<string, string> = {
    PETICAO_INICIAL: isGood
      ? `a) Receber e processar a presente ação;
b) Conceder a tutela de urgência/antecipação de tutela, nos termos do art. 300 do CPC, quando cabível;
c) Citar o(a) réu(ré) para contestar no prazo legal;
d) Julgar procedente o pedido principal, nos termos da fundamentação acima;
e) Condenar o(a) réu(ré) ao pagamento das verbas vencidas, juros e correção monetária;
f) Condenar o(a) réu(ré) ao pagamento das custas processuais e honorários advocatícios.`
      : `a) Receber a presente ação;
b) Citar o(a) réu(ré);
c) Julgar procedente o pedido;
d) Condenar em custas e honorários.`,

    CONTESTACAO: isGood
      ? `a) Acolher as preliminares suscitadas, com extinção do processo sem resolução do mérito;
b) Alternativamente, julgar improcedente o pedido do(a) autor(a) no mérito;
c) Condenar o(a) autor(a) ao pagamento das custas e honorários advocatícios de sucumbência.`
      : `a) Rejeitar o pedido do(a) autor(a);
b) Condenar em honorários.`,

    RECURSO: isGood
      ? `a) Conhecer do recurso;
b) Dar-lhe provimento para ${subtype === "EMBARGOS" ? "sanar a omissão/contradição/obscuridade apontada" : "reformar a decisão recorrida"};
c) Determinar o prosseguimento do feito conforme a tese ora exposta.`
      : `a) Conhecer e prover o recurso;
b) Reformar a decisão.`,

    SENTENCA: isGood
      ? `[Dispositivo da sentença: julgada procedente/improcedente a demanda, nos termos da fundamentação acima. Condenação em custas e honorários. Prazo recursal.]`
      : `[Dispositivo: pedido procedente/improcedente.]`,

    DECISAO: isGood
      ? `[Dispositivo da decisão interlocutória: deferir/indeferir o pedido nos termos da fundamentação. Intimem-se.]`
      : `[Dispositivo: pedido deferido/indeferido.]`,

    DESPACHO: isGood
      ? `[Despacho: encaminhe-se conforme determinação. Cumpra-se. Intimem-se.]`
      : `[Despacho: cumpra-se.]`,

    CUMPRIMENTO_SENTENCA: isGood
      ? `a) Intimar o(a) executado(a) para pagar o valor total de [VALOR TOTAL], acrescido de multa de 10% e honorários de 10% nos termos do art. 523, §1º, do CPC;
b) Em caso de não pagamento, penhorar bens na forma legal;
c) Expedir alvará de levantamento após o pagamento integral.`
      : `a) Intimar o(a) executado(a) para pagamento;
b) Prosseguir na execução.`,
  };

  const requests = genericRequests[documentType] ?? `a) Acolher o pedido formulado;
b) Determinar o prosseguimento conforme a fundamentação acima.`;

  return `${preamble}

${requests}`;
}

// ─── Seção de encerramento ────────────────────────────────────────────────────

function buildClosingBlock(caseSpec: GoldCorpusCase): string {
  const { documentType } = caseSpec;
  const isJudicial = ["SENTENCA", "DECISAO", "DESPACHO"].includes(documentType);

  if (isJudicial) {
    return `[Local], [Data].

[Assinatura do(a) Magistrado(a)]`;
  }

  return `Termos em que pede deferimento.

[Local], [Data].

[Advogado(a) — OAB/[UF] nº [NÚMERO]]`;
}

// ─── Adaptação de defeitos por qualidade ─────────────────────────────────────

function injectQualityDefects(text: string, caseSpec: GoldCorpusCase): string {
  const { quality, plantedIssues } = caseSpec;

  if (quality === "GOOD" || plantedIssues.length === 0) return text;

  // LIGHT_ISSUES: texto é coerente mas superficial — sem alteração estrutural além do que os blocos já fazem
  if (quality === "LIGHT_ISSUES") return text;

  // MODERATE_ISSUES: adiciona uma lacuna visível em ponto estratégico
  if (quality === "MODERATE_ISSUES") {
    return text.replace(
      "Termos em que pede deferimento.",
      `Observa-se que alguns elementos documentais não foram integralmente juntados nesta oportunidade, podendo ser complementados em momento oportuno.

Termos em que pede deferimento.`,
    );
  }

  // SEVERE_ISSUES: falha estrutural — ignora ou contradiz elemento central
  if (quality === "SEVERE_ISSUES") {
    return text.replace(
      "Termos em que pede deferimento.",
      `Sem embargo dos fundamentos acima, a questão central apontada nos autos não foi objeto de análise aprofundada nesta peça, o que poderá ser suprido em momento posterior caso necessário.

Termos em que pede deferimento.`,
    );
  }

  return text;
}

// ─── Montagem do documento completo ──────────────────────────────────────────

function assembleDocument(caseSpec: GoldCorpusCase): string {
  const addressee = DOMAIN_ADDRESSEE[caseSpec.domain] ?? "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO";
  const competencia = DOMAIN_COMPETENCIA[caseSpec.domain] ?? "competência ratione materiae";
  const title = buildTitle(caseSpec);

  const sections: string[] = [
    // Seção 1 — Endereçamento
    `${addressee}
DA COMARCA / SEÇÃO JUDICIÁRIA DE [COMARCA]
(${competencia})`,

    // Seção 2 — Qualificação das partes
    `[NOME DO(A) AUTOR(A)/REQUERENTE], [nacionalidade], [estado civil], [profissão], portador(a) do RG nº [RG] e CPF nº [CPF], residente e domiciliado(a) em [ENDEREÇO], por meio do(a) advogado(a) infra-assinado(a) (procuração em anexo), vem respeitosamente à presença de Vossa Excelência propor a presente

${title}

em face de [NOME DO(A) RÉU(RÉ)/REQUERIDO(A)], [qualificação], pelos fatos e fundamentos a seguir expostos.`,

    // Seção 3 — Fatos
    `I — DOS FATOS

${buildFactsBlock(caseSpec)}`,

    // Seção 4 — Fundamentação jurídica
    `II — DO DIREITO

${buildFoundationsBlock(caseSpec)}`,

    // Seção 5 — Provas
    `III — DAS PROVAS

${buildProofsBlock(caseSpec)}`,

    // Seção 6 — Pedidos
    `IV — DOS PEDIDOS

${buildRequestsBlock(caseSpec)}`,

    // Seção 7 — Valor da causa
    `V — DO VALOR DA CAUSA

Dá-se à presente causa o valor de [VALOR DA CAUSA], nos termos do art. 292 do CPC.`,

    // Seção 8 — Encerramento
    buildClosingBlock(caseSpec),
  ];

  const rawText = sections.join("\n\n");
  return injectQualityDefects(rawText, caseSpec);
}

// ─── Serviço público ──────────────────────────────────────────────────────────

const FIXED_GENERATED_AT = "2026-06-06T00:00:00.000Z";

export class GoldCorpusDocumentGeneratorService {
  generate(caseSpec: GoldCorpusCase): GeneratedGoldCorpusDocument {
    return {
      caseId: caseSpec.id,
      domain: caseSpec.domain,
      documentType: caseSpec.documentType,
      ...(caseSpec.subtype !== undefined ? { subtype: caseSpec.subtype } : {}),
      title: buildTitle(caseSpec),
      text: assembleDocument(caseSpec),
      plantedIssues: caseSpec.plantedIssues,
      expectedFindings: caseSpec.expectedFindings,
      expectedScoreRange: {
        min: caseSpec.expectedScoreRange.min,
        max: caseSpec.expectedScoreRange.max,
      },
      metadata: {
        synthetic: true,
        generatedAt: FIXED_GENERATED_AT,
        generatorVersion: "v1",
        quality: caseSpec.quality,
        difficulty: caseSpec.difficulty,
      },
    };
  }

  generateAll(cases: GoldCorpusCase[]): GeneratedGoldCorpusDocument[] {
    return cases.map((c) => this.generate(c));
  }
}
