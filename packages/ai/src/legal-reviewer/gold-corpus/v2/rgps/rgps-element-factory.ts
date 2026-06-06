/**
 * FASE 9.0.8.10 — RGPS Element Factory
 *
 * Constrói arrays de DocumentElement específicos por cenário RGPS.
 * Cada benefitType tem sua própria função builder.
 *
 * Regras:
 * - GOOD: fullContent com dados concretos (números, datas, fundamentos).
 * - MODERATE/SEVERE/LIGHT: fullContent correto; omittedContent/absentContent
 *   usados pelo degradation map.
 * - Sem placeholders em conteúdo fullContent.
 * - Sem API externa, sem Math.random(), sem new Date().
 */

import type { DocumentElement } from "../gold-corpus-v2.types.js";
import { DocumentSection } from "../gold-corpus-v2.types.js";
import type { CaseSeedData } from "../gold-corpus-v2.types.js";
import type { RgpsScenarioConfig } from "./rgps-scenario.types.js";

// ─── Hash interno (FNV-1a) ─────────────────────────────────────────────────────

function h(s: string): number {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return n >>> 0;
}

/** Deriva um inteiro no intervalo [min, min+range) a partir da semente + salt. */
function dn(seed: CaseSeedData, salt: string, min: number, range: number): number {
  return min + (h(seed.cpf + salt) % range);
}

/** Data fixa de geração (determinístico, alinhado com V1). */
const GEN_DATE = "06 de junho de 2026";

// ─── Builders por benefitType ──────────────────────────────────────────────────

function buildAposentadoriaPorIdadeUrbana(seed: CaseSeedData): DocumentElement[] {
  const contrib = dn(seed, "c1", 182, 58);          // 182–239
  const idadeAnos = dn(seed, "idade", 65, 15);      // 65–79
  const nbNum = `${dn(seed, "nb", 10000000, 89999999)}`;
  const rmi = seed.salaryBase;
  const atrasados = `R$ ${(dn(seed, "atr", 1200000, 4800000) / 100).toFixed(2).replace(".", ",")}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, nascido(a) há ${idadeAnos} anos, ` +
        `residente em ${seed.city}, vem, por seu advogado, propor\n\n` +
        `AÇÃO DE CONCESSÃO DE APOSENTADORIA POR IDADE (URBANA)\n\n` +
        `Processo n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`,
      lightContent: "",
      omittedContent: "",
      omissionDescription: "",
      correctPresenceKeywords: [seed.personName, seed.cpf],
    },
    {
      id: "fatos_carencia",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a) comprova, pelo CNIS atualizado emitido em ${seed.derDate}, ` +
        `${contrib} contribuições mensais ao RGPS, superando a carência mínima de 180 ` +
        `contribuições exigida pelo art. 25, II, da Lei n.º 8.213/1991. ` +
        `O vínculo mais antigo registrado data de ${seed.birthDate.slice(6)}, ` +
        `com contribuições ininterruptas comprovadas até a DER.`,
      lightContent:
        `O(A) autor(a) afirma possuir contribuições suficientes para cumprir a carência. ` +
        `[número exato de contribuições não indicado na peça]`,
      omittedContent:
        `[número de contribuições e comprovação de carência ausentes na peça]`,
      omissionDescription: "ausência de comprovação numérica da carência",
      correctPresenceKeywords: [String(contrib), "contribuições", "carência", "180"],
    },
    {
      id: "fatos_der",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A Data de Entrada do Requerimento — DER — é ${seed.derDate}, data em que o(a) autor(a) ` +
        `compareceu à agência do INSS em ${seed.city} e protocolizou o requerimento ` +
        `de Aposentadoria por Idade sob n.º ${seed.protocolNumber}. ` +
        `Na ocasião, o INSS reconheceu o cumprimento da carência mas indeferiu o benefício ` +
        `por entender, equivocadamente, não ter sido atingida a idade mínima.`,
      lightContent:
        `O(A) autor(a) formulou requerimento administrativo junto ao INSS. ` +
        `[data de entrada do requerimento não especificada]`,
      omittedContent:
        `[DER e número do protocolo administrativo não indicados]`,
      omissionDescription: "ausência de DER e protocolo administrativo identificados",
      correctPresenceKeywords: ["DER", seed.derDate, seed.protocolNumber],
    },
    {
      id: "fatos_cnis",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O CNIS de ${seed.personName} (CPF ${seed.cpf}), emitido em ${seed.derDate}, ` +
        `registra os seguintes vínculos principais: ` +
        `(a) Empresa Alfa Indústria Ltda., CNPJ 12.345.678/0001-00, de 03/1985 a 07/2002 — 208 meses; ` +
        `(b) Empresa Beta Comércio S/A, CNPJ 98.765.432/0001-11, de 08/2002 a ${seed.derDate.slice(3)} — ` +
        `vínculos ativos. Total de contribuições: ${contrib}. Sem lacunas incompatíveis.`,
      lightContent:
        `CNIS juntado. [vínculos e períodos não detalhados na peça]`,
      omittedContent:
        `[CNIS não analisado — períodos e vínculos não descritos na petição]`,
      omissionDescription: "ausência de análise do CNIS com vínculos e períodos",
      correctPresenceKeywords: ["CNIS", seed.cpf, String(contrib)],
    },
    {
      id: "direito_idade",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `I — DO DIREITO À APOSENTADORIA POR IDADE URBANA\n\n` +
        `Nos termos do art. 48, § 1.º, da Lei n.º 8.213/1991, tem direito à aposentadoria por ` +
        `idade o segurado que completar 65 (sessenta e cinco) anos de idade, se homem, ou ` +
        `60 (sessenta) anos, se mulher, e contar com, no mínimo, 180 contribuições mensais. ` +
        `O(A) autor(a), com ${idadeAnos} anos à DER (${seed.derDate}) e ${contrib} contribuições ` +
        `comprovadas, preenche integralmente os requisitos legais. ` +
        `A RMI apurada pelo INSS administrativamente foi de ${rmi}, valor ora confirmado ` +
        `pelo cálculo do escritório com base nas competências do CNIS.`,
      lightContent:
        `O(A) autor(a) faz jus à aposentadoria por idade com base na Lei n.º 8.213/1991. ` +
        `[fundamentação sem indicação de requisitos preenchidos concretamente]`,
      omittedContent:
        `[fundamentos legais não desenvolvidos]`,
      omissionDescription: "ausência de fundamentação legal específica",
      correctPresenceKeywords: ["art. 48", "Lei n.º 8.213", "180", String(idadeAnos)],
    },
    {
      id: "provas_docs",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `Para provar o alegado, junta-se: (1) CNIS emitido em ${seed.derDate}; ` +
        `(2) Certidão de Nascimento / RG; (3) CPF n.º ${seed.cpf}; ` +
        `(4) Comprovante de residência em ${seed.city}; ` +
        `(5) Carta de indeferimento do INSS, protocolo n.º ${seed.protocolNumber}; ` +
        `(6) Requerimento Administrativo n.º ${seed.protocolNumber}; ` +
        `(7) Comprovantes de contribuição dos últimos 36 meses.`,
      lightContent: `Documentos em anexo. [rol sem especificação]`,
      omittedContent: `[rol de documentos não apresentado]`,
      omissionDescription: "ausência de rol de documentos identificados",
      correctPresenceKeywords: ["CNIS", seed.cpf, seed.protocolNumber],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) a concessão de Aposentadoria por Idade Urbana com DIB na DER (${seed.derDate}); ` +
        `(b) o pagamento das parcelas vencidas desde a DER, ora estimadas em ${atrasados}, ` +
        `com correção pelo INPC e juros de 1% ao mês; ` +
        `(c) RMI inicial de ${rmi}; ` +
        `(d) honorários advocatícios de 10% sobre o montante das prestações vencidas; ` +
        `(e) benefícios da Assistência Judiciária Gratuita (art. 98 a 102 do CPC/2015).\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão do benefício. [pedidos sem especificação de DIB, RMI ou atrasados]`,
      omittedContent: `[pedidos não detalhados]`,
      omissionDescription: "pedidos sem especificação de DIB e RMI",
      correctPresenceKeywords: ["DIB", "DER", seed.derDate, "RMI", rmi],
    },
  ];
}

function buildAposentadoriaEspecial(seed: CaseSeedData): DocumentElement[] {
  const anosEspeciais = dn(seed, "anos_esp", 21, 9);   // 21–29
  const pppNum = `PPP-${dn(seed, "ppp", 1000, 8999)}`;
  const ruido = dn(seed, "ruido", 88, 10);              // 88–97 dB(A)
  const contrib = dn(seed, "c2", 252, 36);              // 252–287

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, propõe\n\n` +
        `AÇÃO DE CONCESSÃO DE APOSENTADORIA ESPECIAL\n\nProcesso n.º ${seed.processNumber} — Valor: ${seed.causeValue}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "APOSENTADORIA ESPECIAL"],
    },
    {
      id: "fatos_trabalho_especial",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a), ${seed.personName}, CPF ${seed.cpf}, trabalhou por ${anosEspeciais} anos ` +
        `em condições especiais com exposição a agentes nocivos à saúde, ` +
        `conforme registrado no CNIS (${contrib} contribuições até a DER de ${seed.derDate}) ` +
        `e no PPP (${pppNum}) emitido pelo empregador.`,
      lightContent:
        `O(A) autor(a) trabalhou em condições especiais por anos. [período exato não indicado]`,
      omittedContent:
        `[período de trabalho especial não comprovado documentalmente]`,
      omissionDescription: "ausência de comprovação do período de trabalho especial",
      correctPresenceKeywords: [String(anosEspeciais), "condições especiais", "PPP", pppNum],
    },
    {
      id: "ppp_referencia",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O PPP n.º ${pppNum}, emitido em ${seed.baseDate} pelo empregador, registra exposição ao ` +
        `agente nocivo RUÍDO com intensidade medida de ${ruido} dB(A), superior ao limite de ` +
        `tolerância de 85 dB(A) (Anexo 1, NR-15 e Decreto n.º 3.048/1999, Anexo IV). ` +
        `A exposição ocorreu de forma habitual e permanente durante todo o contrato de trabalho.`,
      lightContent:
        `Foi juntado o PPP (${pppNum}) emitido pelo empregador referente ao período especial. ` +
        `[análise do agente nocivo e enquadramento legal não desenvolvidos]`,
      omittedContent:
        `Foi juntado o PPP (${pppNum}) emitido pelo empregador. ` +
        `[a identificação do agente nocivo específico, sua intensidade e o enquadramento ` +
        `no Decreto n.º 3.048/1999 não foram desenvolvidos na peça]`,
      omissionDescription: "ausência de análise concreta do PPP",
      correctPresenceKeywords: ["PPP", pppNum, "agente nocivo", String(ruido)],
    },
    {
      id: "habitualidade_permanencia",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A exposição ao ruído de ${ruido} dB(A) ocorreu de forma habitual e permanente, ` +
        `não eventual ou intermitente, no setor de produção, durante toda a jornada laboral, ` +
        `conforme atestado pelo LTCAT de ${seed.baseDate}.`,
      lightContent:
        `A habitualidade e permanência constam do PPP. [não desenvolvidas na peça]`,
      omittedContent:
        `[habitualidade e permanência da exposição ao agente nocivo não analisadas]`,
      absentContent: null,
      omissionDescription: "ausência de habitualidade/permanência",
      correctPresenceKeywords: ["habitual", "permanente", "LTCAT"],
    },
    {
      id: "direito_especial",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Nos termos do art. 57 da Lei n.º 8.213/1991, a aposentadoria especial é devida ao ` +
        `segurado que tiver trabalhado ${anosEspeciais >= 25 ? "25" : "20"} anos sob condições ` +
        `especiais. O(A) autor(a) preenche o requisito por ${anosEspeciais} anos de exposição.`,
      lightContent: `Cabe aposentadoria especial com base no art. 57 da Lei n.º 8.213/1991.`,
      omittedContent: `[fundamentação legal não desenvolvida]`,
      omissionDescription: "ausência de fundamentação legal do tempo especial",
      correctPresenceKeywords: ["art. 57", "Lei n.º 8.213"],
    },
    {
      id: "provas_ppp",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `Junta-se: (1) PPP n.º ${pppNum} de ${seed.baseDate}; ` +
        `(2) LTCAT atualizado; (3) CNIS com ${contrib} contribuições; ` +
        `(4) Documentos pessoais (RG, CPF ${seed.cpf}); ` +
        `(5) Protocolo administrativo n.º ${seed.protocolNumber}.`,
      lightContent: `Documentos em anexo.`,
      omittedContent: `[documentos não identificados]`,
      omissionDescription: "rol de provas não especificado",
      correctPresenceKeywords: ["PPP", pppNum, "LTCAT", "CNIS"],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão de Aposentadoria Especial com DIB na DER (${seed.derDate}); ` +
        `(b) parcelas vencidas com correção e juros; ` +
        `(c) honorários de 10% sobre atrasados.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão da aposentadoria especial.`,
      omittedContent: `[pedidos não especificados]`,
      omissionDescription: "pedidos incompletos",
      correctPresenceKeywords: ["DIB", "DER"],
    },
  ];
}

function buildBeneficioIncapacidade(seed: CaseSeedData): DocumentElement[] {
  const laudoFls = dn(seed, "fls", 45, 80);   // fls. 45–124
  const cid = `M${dn(seed, "cid", 40, 59)}.${dn(seed, "cid2", 0, 9)}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EGRÉGIO TRIBUNAL REGIONAL FEDERAL — [CÂMARA PREVIDENCIÁRIA]\n\n` +
        `APELANTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\n` +
        `APELAÇÃO CÍVEL — BENEFÍCIO POR INCAPACIDADE`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "APELAÇÃO", "INCAPACIDADE"],
    },
    {
      id: "decisao_recorrida",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A r. sentença de fls. ${laudoFls + 30} julgou IMPROCEDENTE o pedido de auxílio por incapacidade, ` +
        `acolhendo integralmente o laudo pericial de fls. ${laudoFls}, subscrito pelo perito ` +
        `judicial nomeado pelo Juízo, que concluiu pela AUSÊNCIA de incapacidade laboral, ` +
        `reconhecendo capacidade residual para atividades de menor esforço físico. ` +
        `O MM. Juízo a quo entendeu que o laudo pericial é prova técnica prevalente.`,
      lightContent:
        `A sentença julgou improcedente com base no laudo pericial desfavorável.`,
      omittedContent:
        `A sentença julgou improcedente com base no laudo pericial de fls. ${laudoFls}, ` +
        `que concluiu pela ausência de incapacidade. ` +
        `[o recurso não detalha as razões da decisão recorrida para fins de enfrentamento]`,
      omissionDescription: "decisão recorrida não suficientemente detalhada para enfrentamento",
      correctPresenceKeywords: ["laudo pericial", `fls. ${laudoFls}`, "incapacidade", "sentença"],
    },
    {
      id: "laudo_mencao",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O laudo pericial de fls. ${laudoFls} merece ser afastado pelos seguintes fundamentos: ` +
        `(i) o perito desconsiderou os laudos médicos particulares de fls. ${laudoFls - 20}-${laudoFls - 10}, ` +
        `que atestam ${cid} com restrição total para esforço físico; ` +
        `(ii) a avaliação não considerou a profissão do apelante, que exige esforço físico incompatível ` +
        `com o quadro diagnosticado; ` +
        `(iii) o perito ignorou os exames complementares de imagem juntados às fls. ${laudoFls - 5}.`,
      lightContent:
        `O laudo pericial de fls. ${laudoFls} deve ser afastado. [razões técnicas não desenvolvidas]`,
      omittedContent:
        `O recurso menciona o laudo pericial de fls. ${laudoFls} que concluiu pela ausência ` +
        `de incapacidade, sem enfrentar tecnicamente sua fundamentação. ` +
        `[o apelante não apresenta contraponto técnico às conclusões periciais]`,
      omissionDescription: "enfrentamento insuficiente da prova pericial",
      correctPresenceKeywords: ["laudo pericial", `fls. ${laudoFls}`, "afastado", cid],
    },
    {
      id: "contraponto_tecnico",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Ademais, o apelante junta parecer técnico do Dr. [Perito Particular], CRM n.º ${dn(seed, "crm", 10000, 89999)}, ` +
        `que, após exame clínico em ${seed.baseDate}, diagnosticou ${cid} com incapacidade total ` +
        `e permanente para a função habitualmente exercida, divergindo fundamentadamente do perito judicial.`,
      lightContent:
        `Há laudos particulares divergentes do laudo judicial. [não desenvolvidos]`,
      omittedContent:
        `[contraponto técnico ao laudo pericial não apresentado no recurso]`,
      absentContent: null,
      omissionDescription: "ausência de contraponto técnico",
      correctPresenceKeywords: ["parecer técnico", "divergindo", cid],
    },
    {
      id: "pedido_recursal",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer o PROVIMENTO do recurso para reformar a sentença e conceder o benefício ` +
        `por incapacidade com DIB na data do requerimento administrativo (${seed.derDate}), ` +
        `com pagamento de atrasados corrigidos.\n\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer o provimento do recurso.`,
      omittedContent: `[pedido recursal não especificado]`,
      omissionDescription: "pedido recursal sem especificação de DIB",
      correctPresenceKeywords: ["PROVIMENTO", "DIB", seed.derDate],
    },
  ];
}

function buildLoasBpc(seed: CaseSeedData): DocumentElement[] {
  const membros = dn(seed, "mbr", 2, 4); // 2–5 membros
  const renda = `R$ ${(dn(seed, "rnd", 100, 200) / 100).toFixed(2).replace(".", ",")}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE CONCESSÃO DE BPC/LOAS\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "BPC", "LOAS"],
    },
    {
      id: "fatos_deficiencia",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a), ${seed.personName}, CPF ${seed.cpf}, é portador(a) de deficiência ` +
        `diagnosticada em ${seed.baseDate}, conforme laudo médico do Dr. [Médico Assistente], ` +
        `CRM ${dn(seed, "crm2", 10000, 89999)}, que atesta limitação funcional de longa duração ` +
        `impeditiva de participação plena e efetiva na sociedade.`,
      lightContent: `O(A) autor(a) é deficiente. [deficiência não descrita com detalhes]`,
      omittedContent: `[deficiência alegada sem documentação médica identificada]`,
      omissionDescription: "deficiência não documentada concretamente",
      correctPresenceKeywords: ["deficiência", seed.baseDate, "laudo"],
    },
    {
      id: "miserabilidade_analise",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O grupo familiar do(a) autor(a) é composto por ${membros} membros, ` +
        `com renda per capita de ${renda}/mês — abaixo de 1/4 do salário mínimo ` +
        `(R$ 353,00 — Lei n.º 14.663/2023), comprovada por declarações de renda, ` +
        `extratos bancários e Cadastro Único n.º ${seed.protocolNumber}.`,
      lightContent:
        `O grupo familiar possui baixa renda. [análise de miserabilidade sem dados concretos]`,
      omittedContent:
        `[análise socioeconômica do grupo familiar não desenvolvida — ` +
        `renda per capita, composição familiar e CadÚnico não apresentados na peça]`,
      omissionDescription: "análise socioeconômica insuficiente",
      correctPresenceKeywords: [String(membros), renda, "1/4", "Cadastro Único"],
    },
    {
      id: "direito_loas",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O BPC/LOAS está previsto no art. 203, V, da CF/88 e regulamentado pelo art. 20 ` +
        `da Lei n.º 8.742/1993 (LOAS), exigindo deficiência e renda per capita ` +
        `inferior a 1/4 do salário mínimo. Ambos os requisitos restam demonstrados.`,
      lightContent: `O direito ao BPC/LOAS está previsto na Lei n.º 8.742/1993.`,
      omittedContent: `[fundamentação legal não desenvolvida]`,
      omissionDescription: "fundamentos legais não desenvolvidos",
      correctPresenceKeywords: ["art. 203", "art. 20", "Lei n.º 8.742", "1/4"],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão do BPC/LOAS com DIB no requerimento administrativo (${seed.derDate}); ` +
        `(b) pagamento dos atrasados com correção; (c) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão do BPC/LOAS.`,
      omittedContent: `[pedidos sem especificação]`,
      omissionDescription: "pedidos sem DIB especificada",
      correctPresenceKeywords: ["BPC", "DIB", seed.derDate],
    },
  ];
}

function buildRevisaoAposentadoria(seed: CaseSeedData): DocumentElement[] {
  const salErrado = `R$ ${(dn(seed, "sal_e", 150000, 100000) / 100).toFixed(2).replace(".", ",")}`;
  const salCerto  = `R$ ${(dn(seed, "sal_c", 250000, 100000) / 100).toFixed(2).replace(".", ",")}`;
  const nbNum = `${dn(seed, "nb2", 10000000, 89999999)}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EGRÉGIO TRIBUNAL REGIONAL FEDERAL\n\nAPELANTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\nAPELAÇÃO — REVISÃO DE APOSENTADORIA (NB ${nbNum})`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "REVISÃO", nbNum],
    },
    {
      id: "decisao_recorrida",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A r. sentença manteve o cálculo administrativo da aposentadoria (NB ${nbNum}), ` +
        `desconsiderando a impugnação do apelante quanto aos salários de contribuição ` +
        `das competências 01/2008 a 12/2010, que o INSS lançou como ${salErrado}/mês ` +
        `quando o CNIS registra ${salCerto}/mês para o mesmo período.`,
      lightContent: `A sentença manteve o cálculo do INSS. [divergência não detalhada]`,
      omittedContent: `[decisão recorrida não descrita com detalhes para enfrentamento]`,
      omissionDescription: "decisão recorrida não detalhada",
      correctPresenceKeywords: [nbNum, salErrado, salCerto, "CNIS"],
    },
    {
      id: "razoes_erro_cnis",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O CNIS atualizado, emitido em ${seed.baseDate}, registra salários de contribuição de ` +
        `${salCerto}/mês no período de 01/2008 a 12/2010, divergindo do valor de ${salErrado}/mês ` +
        `utilizado pelo INSS. A Carta de Concessão (doc. fls. 12) confirma que o INSS adotou ` +
        `${salErrado} para 36 competências. A diferença no PBC acarreta redução indevida de ` +
        `aproximadamente 8,3% na RMI, gerando atrasados desde a DIB.`,
      lightContent: `Há divergência entre o CNIS e o cálculo do INSS. [não demonstrada concretamente]`,
      omittedContent: `[demonstração do erro de cálculo não desenvolvida]`,
      omissionDescription: "erro de cálculo não demonstrado concretamente",
      correctPresenceKeywords: [salErrado, salCerto, "CNIS", "Carta de Concessão"],
    },
    {
      id: "fundamento_legal",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Nos termos do art. 29, I, da Lei n.º 8.213/1991, o PBC deve considerar os ` +
        `salários de contribuição efetivamente anotados no CNIS. O art. 29-A impõe ao ` +
        `INSS a obrigação de utilizar os dados do CNIS. O erro material apurado ` +
        `é corrigível, pois os dados do CNIS prevalecem sobre os lançamentos administrativos ` +
        `(art. 29-A da Lei n.º 8.213/1991; STJ, REsp 1.348.173/RS).`,
      lightContent: `O INSS deve usar os dados do CNIS (art. 29-A da Lei 8.213/91).`,
      omittedContent: `[fundamentos legais da revisão não citados]`,
      omissionDescription: "fundamentos legais da revisão não especificados",
      correctPresenceKeywords: ["art. 29", "Lei n.º 8.213", "CNIS", "REsp 1.348.173"],
    },
    {
      id: "pedido_recursal",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer o PROVIMENTO para: (a) retificar os salários de contribuição de 01/2008 a 12/2010 ` +
        `de ${salErrado} para ${salCerto}; (b) recalcular a RMI; (c) pagar diferenças com correção. ` +
        `\n\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer o provimento para revisão do benefício.`,
      omittedContent: `[pedido recursal sem especificação do período impugnado]`,
      omissionDescription: "pedido recursal sem detalhamento do período e valores",
      correctPresenceKeywords: ["PROVIMENTO", salErrado, salCerto, "RMI"],
    },
  ];
}

function buildAposentadoriaRural(seed: CaseSeedData): DocumentElement[] {
  const anosRural = dn(seed, "ar", 15, 20);  // 15–34 anos de atividade rural

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE APOSENTADORIA RURAL POR IDADE\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "RURAL"],
    },
    {
      id: "fatos_rural",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a), ${seed.personName}, trabalhou como trabalhador(a) rural (segurado especial) ` +
        `por aproximadamente ${anosRural} anos na região de ${seed.city}, ` +
        `cultivando lavoura de subsistência em regime de economia familiar.`,
      lightContent: `O(A) autor(a) trabalhou como trabalhador rural.`,
      omittedContent: `[atividade rural mencionada sem comprovação documental]`,
      omissionDescription: "trabalho rural sem comprovação documental",
      correctPresenceKeywords: [String(anosRural), "rural", seed.city],
    },
    {
      id: "prova_material",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `Como início de prova material do labor rural, juntam-se: ` +
        `(a) ITR (Imposto Territorial Rural) dos exercícios 2010–2020 em nome do pai do autor; ` +
        `(b) Declaração de Aptidão ao PRONAF — DAP vigente; ` +
        `(c) Certidão de casamento (profissão: lavrador); ` +
        `(d) Notas fiscais de venda de produção rural ao mercado local. ` +
        `Esses documentos, em conjunto, constituem início de prova material suficiente (Súm. 149/STJ).`,
      lightContent:
        `Há documentos rurais juntados. [natureza dos documentos não esclarecida como início de prova material]`,
      omittedContent:
        `[início de prova material do labor rural não indicado ou insuficientemente identificado na peça]`,
      omissionDescription: "prova rural insuficientemente demonstrada",
      correctPresenceKeywords: ["ITR", "DAP", "início de prova material", "Súm. 149"],
    },
    {
      id: "direito_rural",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O art. 143 da Lei n.º 8.213/1991 assegura ao trabalhador rural o direito à aposentadoria ` +
        `por idade sem exigência de contribuições, desde que comprove o exercício de atividade rural ` +
        `pelo tempo equivalente à carência (art. 25, II). A Súmula 149/STJ dispensa contribuições ` +
        `para o segurado especial que comprova trabalho rural por início de prova material.`,
      lightContent: `O trabalhador rural tem direito à aposentadoria (art. 143 da Lei 8.213/91).`,
      omittedContent: `[fundamentos da aposentadoria rural não desenvolvidos]`,
      omissionDescription: "fundamentos legais da aposentadoria rural não especificados",
      correctPresenceKeywords: ["art. 143", "Lei n.º 8.213", "Súmula 149", "segurado especial"],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão da aposentadoria rural por idade com DIB na DER (${seed.derDate}); ` +
        `(b) pagamento de atrasados; (c) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão da aposentadoria rural.`,
      omittedContent: `[pedidos sem especificação de DIB]`,
      omissionDescription: "pedidos sem DIB especificada",
      correctPresenceKeywords: ["DIB", "DER", seed.derDate],
    },
  ];
}

function buildTempoEspecialLight(seed: CaseSeedData): DocumentElement[] {
  const pppNum = `PPP-${dn(seed, "ppp2", 2000, 7999)}`;
  const anosEsp = dn(seed, "ae2", 20, 10);

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE APOSENTADORIA ESPECIAL\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "ESPECIAL"],
    },
    {
      id: "fatos_especial",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a), ${seed.personName}, CPF ${seed.cpf}, trabalhou ${anosEsp} anos ` +
        `em condições especiais, conforme PPP n.º ${pppNum} juntado.`,
      lightContent: `O(A) autor(a) trabalhou em condições especiais. PPP juntado.`,
      omittedContent: `[período de trabalho especial não indicado]`,
      omissionDescription: "período especial não comprovado",
      correctPresenceKeywords: [String(anosEsp), "PPP", pppNum],
    },
    {
      id: "ppp_analise_tecnica",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O PPP n.º ${pppNum} registra: agente nocivo — RUÍDO — ${dn(seed, "r2", 87, 10)} dB(A); ` +
        `EPI utilizado — protetor auricular mod. X com CA n.º ${dn(seed, "ca", 10000, 89999)} ` +
        `(sem eficácia neutralizante comprovada por NHO-01); ` +
        `habitualidade — diária; permanência — durante toda jornada. ` +
        `Enquadramento: Decreto n.º 3.048/1999, Anexo IV, item 2.0.1.`,
      lightContent:
        `O PPP n.º ${pppNum} foi juntado e registra exposição a ruído. ` +
        `[análise dos campos técnicos — intensidade, EPI, CA e enquadramento — não desenvolvida na peça]`,
      omittedContent:
        `PPP n.º ${pppNum} juntado. ` +
        `[análise técnica dos campos específicos — intensidade do agente, eficácia do EPI ` +
        `e enquadramento no Decreto n.º 3.048/1999 — não desenvolvida]`,
      omissionDescription: "fundamentação técnica incompleta",
      correctPresenceKeywords: ["PPP", pppNum, "dB(A)", "Decreto n.º 3.048"],
    },
    {
      id: "direito_especial",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Art. 57 da Lei n.º 8.213/1991. Enquadramento pelo Decreto n.º 3.048/1999.`,
      lightContent: `Base legal: art. 57, Lei 8.213/91.`,
      omittedContent: `[base legal não citada]`,
      omissionDescription: "base legal não citada",
      correctPresenceKeywords: ["art. 57", "Lei n.º 8.213"],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer a concessão da aposentadoria especial com DIB na DER (${seed.derDate}).\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão da aposentadoria especial.`,
      omittedContent: `[pedidos não especificados]`,
      omissionDescription: "pedidos sem DIB",
      correctPresenceKeywords: ["DIB", "DER"],
    },
  ];
}

function buildCumprimentoSentencaPrev(seed: CaseSeedData): DocumentElement[] {
  const sentencaAno = 2020 + (dn(seed, "sa", 0, 4));
  const valorFinal = `R$ ${(dn(seed, "vf", 2000000, 5000000) / 100).toFixed(2).replace(".", ",")}`;
  const nbNum = `${dn(seed, "nb3", 10000000, 89999999)}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `EXEQUENTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\nCUMPRIMENTO DE SENTENÇA PREVIDENCIÁRIA`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "CUMPRIMENTO DE SENTENÇA"],
    },
    {
      id: "titulo_executivo",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `Trata-se de cumprimento da sentença proferida nestes autos em ${sentencaAno}, ` +
        `transitada em julgado em ${sentencaAno + 1}, que condenou o INSS a conceder ` +
        `aposentadoria por invalidez ao exequente (NB ${nbNum}), com DIB em ${seed.derDate}, ` +
        `e pagar as diferenças vencidas. O valor total apurado é de ${valorFinal}, ` +
        `incluindo principal e atualização monetária.`,
      lightContent: `Sentença de ${sentencaAno} condenou o INSS. Valor total: ${valorFinal}. [parâmetros não detalhados]`,
      omittedContent: `[título executivo não descrito com parâmetros do julgado]`,
      omissionDescription: "título executivo sem parâmetros do julgado",
      correctPresenceKeywords: [String(sentencaAno), valorFinal, "CUMPRIMENTO", nbNum],
    },
    {
      id: "valor_final",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O valor total do débito é de ${valorFinal}, composto por: ` +
        `(a) parcelas vencidas desde a DIB (${seed.derDate}); ` +
        `(b) diferenças mensais do benefício; ` +
        `(c) correção monetária pelo INPC; ` +
        `(d) juros de mora de 1% a.m. Valor: ${valorFinal}.`,
      lightContent: `Valor total: ${valorFinal}.`,
      omittedContent: `Valor global do débito: ${valorFinal}. [sem decomposição dos componentes]`,
      omissionDescription: "valor sem decomposição de componentes",
      correctPresenceKeywords: [valorFinal, "INPC", "juros"],
    },
    {
      id: "memoria_calculo",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `MEMÓRIA DE CÁLCULO DETALHADA\n\n` +
        `DIB: ${seed.derDate} | RMI inicial: ${seed.salaryBase}\n` +
        `Período: ${seed.derDate} a ${seed.baseDate}\n` +
        `Atualização: INPC acumulado no período\n` +
        `Competência 01/2021: diferença R$ 312,44 × fator 1,1234 = R$ 350,98\n` +
        `Competência 02/2021: diferença R$ 312,44 × fator 1,1256 = R$ 351,66\n` +
        `[...demais competências na planilha em anexo]\n` +
        `Total atualizado: ${valorFinal}`,
      lightContent:
        `Cálculo apresentado. [memória simplificada sem detalhe por competência]`,
      omittedContent:
        `Valor total apurado: ${valorFinal}. ` +
        `[memória de cálculo detalhada não apresentada — valor global informado sem demonstrativo por competência]`,
      omissionDescription: "ausência de memória de cálculo verificável",
      correctPresenceKeywords: ["DIB", "INPC", "competência", "fator", valorFinal],
    },
    {
      id: "pedidos_executivos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) expedição de RPV ou precatório conforme valor apurado (${valorFinal}); ` +
        `(b) reserva de honorários de 10%; (c) intimação do INSS.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a expedição de RPV/precatório.`,
      omittedContent: `[pedidos executivos sem especificação de RPV/precatório]`,
      omissionDescription: "pedidos executivos incompletos",
      correctPresenceKeywords: ["RPV", valorFinal],
    },
  ];
}

function buildReafirmacaoDer(seed: CaseSeedData): DocumentElement[] {
  const derOriginal = seed.derDate;
  const derNova = `${String(dn(seed, "dnd", 1, 28)).padStart(2, "0")}/${String(dn(seed, "dnm", 1, 12)).padStart(2, "0")}/${2022 + dn(seed, "dny", 0, 2)}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EGRÉGIO TRIBUNAL REGIONAL FEDERAL\n\nAPELANTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\nAPELAÇÃO — APOSENTADORIA POR IDADE (REAFIRMAÇÃO DE DER)`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "REAFIRMAÇÃO"],
    },
    {
      id: "decisao_recorrida",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A sentença denegou a aposentadoria sob o fundamento de que, na DER original (${derOriginal}), ` +
        `o apelante não havia cumprido a carência mínima de 180 contribuições, ` +
        `sem analisar a possibilidade de reafirmação da DER.`,
      lightContent: `A sentença denegou o benefício por falta de carência na DER (${derOriginal}).`,
      omittedContent: `[decisão recorrida não detalhada]`,
      omissionDescription: "decisão recorrida sem detalhamento",
      correctPresenceKeywords: [derOriginal, "carência", "sentença"],
    },
    {
      id: "razoes_principais",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O r. MM. Juízo ignorou que o apelante passou a cumprir a carência em ${derNova}, ` +
        `data posterior à DER original, quando atingiu 180 contribuições mensais. ` +
        `A reafirmação da DER é direito assegurado pela IN PRES/INSS n.º 77/2015 e ` +
        `pela jurisprudência consolidada do STJ (REsp 1.412.136/SC).`,
      lightContent: `O apelante preencheu a carência após a DER original. [argumento não desenvolvido]`,
      omittedContent: `[razões do recurso não desenvolvidas]`,
      omissionDescription: "razões recursais não desenvolvidas",
      correctPresenceKeywords: ["reafirmação", derNova, "180 contribuições", "STJ"],
    },
    {
      id: "argumento_reafirmacao",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Em ${derNova}, o apelante possuía 182 contribuições mensais, conforme CNIS juntado, ` +
        `configurando o direito à reafirmação da DER para essa data, com reflexo na DIB e ` +
        `nos atrasados. O Enunciado n.º 02 da TNU consolida o entendimento.`,
      lightContent:
        `Na data de ${derNova} o apelante já tinha contribuições suficientes. [argumento de reafirmação não explorado]`,
      omittedContent:
        `[a possibilidade de reafirmação da DER para ${derNova}, quando a carência foi cumprida, ` +
        `não foi explorada como argumento recursal]`,
      omissionDescription: "oportunidade argumentativa não explorada",
      correctPresenceKeywords: [derNova, "182 contribuições", "TNU", "reafirmação da DER"],
    },
    {
      id: "pedido",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer o PROVIMENTO para reconhecer a reafirmação da DER para ${derNova} ` +
        `e conceder a aposentadoria com DIB nessa data.\n\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer o provimento para concessão da aposentadoria.`,
      omittedContent: `[pedido sem especificação da nova DER]`,
      omissionDescription: "pedido sem indicação da DER reafirmada",
      correctPresenceKeywords: ["PROVIMENTO", derNova, "DIB"],
    },
  ];
}

function buildQualidadeSegurado(seed: CaseSeedData): DocumentElement[] {
  const ultimaContrib = `${String(dn(seed, "ucm", 1, 12)).padStart(2, "0")}/${2019 + dn(seed, "ucy", 0, 3)}`;
  const mesesGraca = 12;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE BENEFÍCIO POR INCAPACIDADE\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "INCAPACIDADE"],
    },
    {
      id: "fatos_incapacidade",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a) ficou incapacitado(a) em ${seed.baseDate} por acidente de trabalho, ` +
        `conforme laudo médico do Dr. [Médico], CRM ${dn(seed, "crm3", 10000, 89999)}, ` +
        `com diagnóstico CID ${`M${dn(seed, "cid3", 50, 29)}.${dn(seed, "cid4", 0, 9)}`}.`,
      lightContent: `O(A) autor(a) ficou incapacitado em ${seed.baseDate}. [detalhes do laudo não descritos]`,
      omittedContent: `[incapacidade mencionada sem laudo identificado]`,
      omissionDescription: "incapacidade sem laudo identificado",
      correctPresenceKeywords: [seed.baseDate, "CID", "laudo médico"],
    },
    {
      id: "qualidade_segurado_arg",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a) era segurado(a) do RGPS na data do acidente, com última contribuição ` +
        `em ${ultimaContrib}. O período de graça de ${mesesGraca} meses (art. 15, II, ` +
        `Lei n.º 8.213/1991) mantém a qualidade de segurado até ` +
        `${String(dn(seed, "pgm", 1, 12)).padStart(2, "0")}/${2020 + dn(seed, "pgy", 0, 2)}, ` +
        `data posterior ao acidente, configurando a qualidade de segurado exigida.`,
      lightContent:
        `O(A) autor(a) era segurado. [período de graça não analisado]`,
      omittedContent:
        `[qualidade de segurado afirmada sem análise do período de graça — ` +
        `última contribuição e prazo de manutenção não enfrentados na peça]`,
      omissionDescription: "qualidade de segurado mal fundamentada",
      correctPresenceKeywords: [ultimaContrib, String(mesesGraca), "período de graça", "art. 15"],
    },
    {
      id: "periodo_graca",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `O art. 15, II, da Lei n.º 8.213/1991 garante período de graça de ${mesesGraca} meses ` +
        `após a última contribuição, podendo ser prorrogado para 24 meses (§ 1.º) se o ` +
        `segurado tiver mais de 120 contribuições. O(A) autor(a) possui ${dn(seed, "tc", 100, 100)} ` +
        `contribuições, mantendo a qualidade de segurado na data do acidente.`,
      lightContent:
        `Aplica-se o período de graça do art. 15, II, da Lei 8.213/91.`,
      omittedContent:
        `[período de graça ignorado na fundamentação jurídica — ` +
        `art. 15 da Lei n.º 8.213/1991 não analisado em face dos dados do segurado]`,
      omissionDescription: "qualidade de segurado mal fundamentada",
      correctPresenceKeywords: ["art. 15", "período de graça", "120 contribuições"],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão do auxílio por incapacidade com DIB em ${seed.baseDate}; ` +
        `(b) atrasados; (c) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão do auxílio por incapacidade.`,
      omittedContent: `[pedidos sem especificação de DIB]`,
      omissionDescription: "pedidos sem DIB especificada",
      correctPresenceKeywords: ["DIB", seed.baseDate],
    },
  ];
}

function buildAposentadoriaCarenciaCompleta(seed: CaseSeedData): DocumentElement[] {
  const contribuicoes: string[] = [];
  const base = 180 + dn(seed, "bc", 0, 40);
  for (let i = 0; i < 6; i++) {
    const mo = String((dn(seed, `mo${i}`, 1, 12))).padStart(2, "0");
    const yr = 2000 + i * 3;
    contribuicoes.push(`${mo}/${yr}: R$ ${(dn(seed, `sv${i}`, 100000, 200000) / 100).toFixed(2).replace(".", ",")}`);
  }
  const listagem = contribuicoes.join("; ");

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE CONCESSÃO DE APOSENTADORIA POR IDADE (URBANA)\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "APOSENTADORIA POR IDADE"],
    },
    {
      id: "fatos_contribuicoes_detalhadas",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a) possui ${base} contribuições mensais ao RGPS, organizadas conforme ` +
        `planilha extraída do CNIS emitido em ${seed.derDate}. Amostra das competências: ` +
        `${listagem}. Todas as contribuições foram pagas até o vencimento, sem lacunas.`,
      lightContent:
        `O(A) autor(a) possui ${base} contribuições. [listagem mês a mês não apresentada]`,
      omittedContent:
        `[contribuições afirmadas sem listagem mês a mês]`,
      omissionDescription: "contribuições sem listagem por competência",
      correctPresenceKeywords: [String(base), "CNIS", "contribuições", seed.derDate],
    },
    {
      id: "fatos_der_carencia",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A DER é ${seed.derDate} (protocolo n.º ${seed.protocolNumber}). ` +
        `Na DER, o(a) autor(a) possuía ${base} contribuições, superando a carência de 180. ` +
        `O INSS, contudo, indeferiu o benefício sob o fundamento de que o CNIS apresentava inconsistências ` +
        `no período de 01/2000 a 12/2004, desconsiderando ${base - 180} competências regularmente recolhidas.`,
      lightContent:
        `DER: ${seed.derDate}. Carência cumprida.`,
      omittedContent:
        `[DER e número de contribuições na DER não especificados]`,
      omissionDescription: "DER e carência não especificadas na data do requerimento",
      correctPresenceKeywords: ["DER", seed.derDate, seed.protocolNumber, String(base)],
    },
    {
      id: "direito_carencia",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Nos termos do art. 25, II, e art. 29 da Lei n.º 8.213/1991, ` +
        `a carência de 180 contribuições encontra-se plenamente comprovada. ` +
        `O PBC será apurado sobre os ${base} salários de contribuição.`,
      lightContent: `Carência cumprida (art. 25 da Lei 8.213/91).`,
      omittedContent: `[carência não fundamentada legalmente]`,
      omissionDescription: "carência não fundamentada legalmente",
      correctPresenceKeywords: ["art. 25", "Lei n.º 8.213", String(base), "PBC"],
    },
    {
      id: "provas_cnis_organizado",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `Junta-se CNIS de ${seed.derDate} com ${base} contribuições organizadas em planilha; ` +
        `RG e CPF ${seed.cpf}; protocolo administrativo n.º ${seed.protocolNumber}; ` +
        `comprovantes de contribuições dos últimos 36 meses.`,
      lightContent: `CNIS e documentos em anexo.`,
      omittedContent: `[documentos não identificados]`,
      omissionDescription: "rol de provas não especificado",
      correctPresenceKeywords: ["CNIS", String(base), seed.cpf, seed.protocolNumber],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão da aposentadoria com DIB na DER (${seed.derDate}); ` +
        `(b) RMI calculada sobre ${base} salários de contribuição (${seed.salaryBase} médio); ` +
        `(c) atrasados; (d) honorários; (e) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão da aposentadoria.`,
      omittedContent: `[pedidos sem detalhamento de RMI e atrasados]`,
      omissionDescription: "pedidos sem RMI e atrasados especificados",
      correctPresenceKeywords: ["DIB", seed.derDate, String(base), seed.salaryBase],
    },
  ];
}

function buildConversaoTempoEspecial(seed: CaseSeedData): DocumentElement[] {
  const fatorConv = dn(seed, "fc", 0, 2) === 0 ? "1,4 (20 para 28 anos)" : "1,2 (25 para 30 anos)";
  const anosEsp2 = dn(seed, "ae3", 8, 12);

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EGRÉGIO TRIBUNAL REGIONAL FEDERAL\n\nAPELANTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\nAPELAÇÃO — CONVERSÃO DE TEMPO ESPECIAL`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "CONVERSÃO", "ESPECIAL"],
    },
    {
      id: "decisao_recorrida",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A sentença negou a conversão do tempo especial (${anosEsp2} anos) em comum ` +
        `aplicando fator ${fatorConv}, por entender que a documentação juntada ` +
        `era insuficiente para comprovar a especialidade do período.`,
      lightContent: `A sentença negou a conversão. [razões não detalhadas]`,
      omittedContent: `[decisão recorrida sem detalhamento para enfrentamento]`,
      omissionDescription: "decisão recorrida sem detalhamento",
      correctPresenceKeywords: [String(anosEsp2), fatorConv, "conversão", "sentença"],
    },
    {
      id: "razoes_conversao",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `A conversão do tempo especial (${anosEsp2} anos) em comum pelo fator ${fatorConv} ` +
        `está prevista no art. 70, § 1.º, do Decreto n.º 3.048/1999. ` +
        `A jurisprudência do STJ (REsp 1.151.363/MG — Tema 422) consolidou que ` +
        `o direito à conversão é adquirido na vigência do art. 57 da Lei n.º 8.213/1991 ` +
        `e não pode ser suprimido por legislação posterior. O PPP juntado comprova ` +
        `exposição a agente nocivo no período e o fator de conversão aplicável é ${fatorConv}.`,
      lightContent:
        `Cabe a conversão do tempo especial com base no art. 70 do Decreto n.º 3.048/1999. ` +
        `[tese não desenvolvida concretamente em face da decisão]`,
      omittedContent:
        `A conversão do tempo especial é cabível. ` +
        `[fundamentação genérica — fator de conversão aplicável, período exato e ` +
        `jurisprudência do STJ não desenvolvidos em face da decisão recorrida]`,
      omissionDescription: "tese de conversão pouco desenvolvida",
      correctPresenceKeywords: ["art. 70", "Decreto n.º 3.048", "STJ", fatorConv, String(anosEsp2)],
    },
    {
      id: "pedido",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer o PROVIMENTO para reconhecer ${anosEsp2} anos especiais convertidos pelo ` +
        `fator ${fatorConv} e conceder a aposentadoria por tempo de contribuição.\n\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer o provimento para reconhecer a conversão.`,
      omittedContent: `[pedido sem especificação do fator e período]`,
      omissionDescription: "pedido sem fator de conversão e período especificados",
      correctPresenceKeywords: ["PROVIMENTO", fatorConv, String(anosEsp2)],
    },
  ];
}

function buildAuxilioIncapacidade(seed: CaseSeedData): DocumentElement[] {
  const cid = `M${dn(seed, "ci5", 40, 59)}.${dn(seed, "ci6", 0, 9)}`;
  const profissao = ["operador de máquinas", "auxiliar de produção", "motorista", "metalúrgico"][dn(seed, "pf", 0, 4) % 4] ?? "operador de máquinas";
  const contrib3 = dn(seed, "c3", 90, 50);
  const incapYear = parseInt(seed.baseDate.slice(6), 10);
  const incapMonth = parseInt(seed.baseDate.slice(3, 5), 10);
  const lastContribOffset = 1 + dn(seed, "ulo", 0, 3);
  let lastContribMonth = incapMonth - lastContribOffset;
  let lastContribYear = incapYear;
  if (lastContribMonth <= 0) { lastContribMonth += 12; lastContribYear -= 1; }
  const lastContrib = `${String(lastContribMonth).padStart(2, "0")}/${lastContribYear}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE AUXÍLIO POR INCAPACIDADE TEMPORÁRIA\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "AUXÍLIO", "INCAPACIDADE"],
    },
    {
      id: "fatos_incapacidade_detalhada",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `O(A) autor(a), ${seed.personName}, profissão: ${profissao}, CPF ${seed.cpf}, ` +
        `ficou incapacitado(a) em ${seed.baseDate} por diagnóstico de ${cid}, ` +
        `conforme laudo do Dr. [Nome], CRM ${dn(seed, "crm4", 10000, 89999)}, ` +
        `datado de ${seed.baseDate}. A patologia acarreta limitação funcional total ` +
        `para as atividades de ${profissao}, conforme declaração médica e resultado de ` +
        `exames de imagem juntados.`,
      lightContent:
        `O(A) autor(a) ficou incapacitado(a) e não pode exercer sua profissão.`,
      omittedContent:
        `[incapacidade alegada sem laudo médico identificado e sem relação com a profissão]`,
      omissionDescription: "incapacidade sem laudo e sem relação com a profissão",
      correctPresenceKeywords: [cid, profissao, seed.baseDate, "laudo"],
    },
    {
      id: "fatos_qualidade_segurado",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `Na data da incapacidade (${seed.baseDate}), o(a) autor(a) era segurado(a) do RGPS, ` +
        `com ${contrib3} contribuições mensais (CNIS de ${seed.baseDate}), ` +
        `cumprindo a carência mínima de 12 contribuições (art. 25, I, da Lei n.º 8.213/1991). ` +
        `Última contribuição: ${lastContrib}.`,
      lightContent:
        `O(A) autor(a) era segurado na data da incapacidade.`,
      omittedContent:
        `[qualidade de segurado afirmada sem número de contribuições ou última contribuição]`,
      omissionDescription: "qualidade de segurado sem comprovação numérica",
      correctPresenceKeywords: [String(contrib3), "CNIS", "12 contribuições", "art. 25"],
    },
    {
      id: "direito_auxilio",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Nos termos do art. 59 da Lei n.º 8.213/1991, faz jus ao auxílio por incapacidade ` +
        `temporária o segurado que ficar incapacitado para o seu trabalho por mais de 15 dias ` +
        `consecutivos, cumprida a carência de 12 contribuições (art. 25, I). ` +
        `O(A) autor(a) preenche todos os requisitos.`,
      lightContent: `O(A) autor(a) tem direito ao auxílio (art. 59 da Lei 8.213/91).`,
      omittedContent: `[fundamento legal do auxílio não citado]`,
      omissionDescription: "fundamento legal não citado",
      correctPresenceKeywords: ["art. 59", "Lei n.º 8.213", "12 contribuições", "15 dias"],
    },
    {
      id: "provas",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `Junta-se: (1) laudo médico de ${seed.baseDate} — CID ${cid}; ` +
        `(2) exames de imagem; (3) CNIS com ${contrib3} contribuições; ` +
        `(4) CPF ${seed.cpf}; (5) protocolo administrativo n.º ${seed.protocolNumber}.`,
      lightContent: `Documentos em anexo.`,
      omittedContent: `[documentos não identificados]`,
      omissionDescription: "rol de provas não especificado",
      correctPresenceKeywords: [cid, String(contrib3), seed.protocolNumber],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) concessão do auxílio com DIB em ${seed.baseDate}; ` +
        `(b) atrasados com correção; (c) honorários; (d) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão do auxílio com DIB.`,
      omittedContent: `[pedidos sem DIB especificada]`,
      omissionDescription: "pedidos sem DIB",
      correctPresenceKeywords: ["DIB", seed.baseDate],
    },
  ];
}

function buildPensaoPorMorte(seed: CaseSeedData): DocumentElement[] {
  const falecido = `${["José", "Pedro", "Carlos", "Antônio", "Francisco"][dn(seed, "fn", 0, 5) % 5] ?? "José"} ${seed.personName.split(" ").slice(-1)[0] ?? ""}`.trim();
  const obito = seed.baseDate;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `${seed.personName.toUpperCase()}, CPF ${seed.cpf}, propõe\n\nAÇÃO DE CONCESSÃO DE PENSÃO POR MORTE\n\nProcesso n.º ${seed.processNumber}`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "PENSÃO POR MORTE"],
    },
    {
      id: "fatos_obito",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `Em ${obito} faleceu ${falecido}, segurado do RGPS com NB ativo, ` +
        `deixando como dependente a autora ${seed.personName}, CPF ${seed.cpf}, ` +
        `cônjuge, conforme certidão de óbito e certidão de casamento juntadas.`,
      lightContent:
        `O segurado faleceu em ${obito}. A autora é dependente.`,
      omittedContent:
        `[óbito e vínculo com o segurado mencionados sem documentação identificada]`,
      omissionDescription: "óbito e vínculo não comprovados documentalmente",
      correctPresenceKeywords: [falecido, obito, seed.personName, "certidão de óbito"],
    },
    {
      id: "dependencia_economica",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `A dependência econômica da autora em relação ao de cujus restou comprovada pelos ` +
        `seguintes elementos: (a) extratos bancários da conta conjunta (${seed.protocolNumber}); ` +
        `(b) declaração de imposto de renda em que ${falecido} declara ${seed.personName} como dependente; ` +
        `(c) comprovante de que a renda do falecido representava 80% da renda familiar; ` +
        `(d) declaração de não percepção de renda própria pela autora.`,
      lightContent:
        `A autora dependia economicamente do segurado. [não demonstrada concretamente]`,
      omittedContent:
        `A dependência econômica da autora é alegada. ` +
        `[extratos, declaração de IR e demais provas de dependência não apresentadas ou não analisadas]`,
      omissionDescription: "prova de dependência econômica insuficiente",
      correctPresenceKeywords: ["dependência econômica", seed.protocolNumber, "imposto de renda", falecido],
    },
    {
      id: "direito_pensao",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Nos termos do art. 74 da Lei n.º 8.213/1991, a pensão por morte é devida ao conjunto ` +
        `dos dependentes do segurado falecido a partir do óbito (${obito}). ` +
        `A qualidade de segurado de ${falecido} à data do óbito é comprovada pelo CNIS.`,
      lightContent: `A autora tem direito à pensão (art. 74 da Lei 8.213/91).`,
      omittedContent: `[fundamentos legais da pensão não desenvolvidos]`,
      omissionDescription: "fundamentos legais da pensão não desenvolvidos",
      correctPresenceKeywords: ["art. 74", "Lei n.º 8.213", obito, falecido],
    },
    {
      id: "pedidos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) pensão por morte com DIB na data do óbito (${obito}); ` +
        `(b) atrasados; (c) AJG.\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a concessão da pensão por morte.`,
      omittedContent: `[pedidos sem especificação de DIB]`,
      omissionDescription: "pedidos sem DIB especificada",
      correctPresenceKeywords: ["DIB", obito, "pensão por morte"],
    },
  ];
}

function buildCumprimentoJulgadoCompleto(seed: CaseSeedData): DocumentElement[] {
  const sentencaAno = 2019 + dn(seed, "sja", 0, 4);
  const dib = seed.derDate;
  const dibYear = parseInt(seed.derDate.slice(6), 10);
  const dibMonth = parseInt(seed.derDate.slice(3, 5), 10);
  const dipYear = Math.max(sentencaAno + 2, dibYear + 1);
  const dip = `${String(dn(seed, "dipm", 1, 12)).padStart(2, "0")}/${dipYear}`;
  const rmiCents = 100000 + dn(seed, "rmic", 0, 120000);
  const rmi = `R$ ${(rmiCents / 100).toFixed(2).replace(".", ",")}`;
  const c01 = `R$ ${(Math.round(rmiCents * 1.0234) / 100).toFixed(2).replace(".", ",")}`;
  const c02 = `R$ ${(Math.round(rmiCents * 1.0251) / 100).toFixed(2).replace(".", ",")}`;
  const comp1 = `${String(dibMonth).padStart(2, "0")}/${dibYear}`;
  const comp2 = `${String(dibMonth < 12 ? dibMonth + 1 : 1).padStart(2, "0")}/${dibMonth < 12 ? dibYear : dibYear + 1}`;
  const nbNum = `${dn(seed, "nb5", 10000000, 89999999)}`;
  const atrasados = `R$ ${(dn(seed, "atj", 3000000, 7000000) / 100).toFixed(2).replace(".", ",")}`;
  const corr = `INPC acumulado de ${dib} a ${dip}`;

  return [
    {
      id: "cabecalho",
      section: DocumentSection.CABECALHO,
      fullContent:
        `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA VARA PREVIDENCIÁRIA DE ${seed.city.toUpperCase()}\n\n` +
        `EXEQUENTE: ${seed.personName.toUpperCase()}, CPF ${seed.cpf}\n` +
        `Processo n.º ${seed.processNumber}\n\nCUMPRIMENTO DE SENTENÇA PREVIDENCIÁRIA`,
      lightContent: "", omittedContent: "", omissionDescription: "",
      correctPresenceKeywords: [seed.personName, "CUMPRIMENTO DE SENTENÇA"],
    },
    {
      id: "titulo_executivo",
      section: DocumentSection.DOS_FATOS,
      fullContent:
        `Trata-se de cumprimento da sentença proferida em ${sentencaAno} (transitada em julgado ` +
        `em ${sentencaAno + 1}), que condenou o INSS a conceder aposentadoria por invalidez ` +
        `(NB ${nbNum}) com DIB em ${dib} e DIP em ${dip}, ` +
        `com RMI inicial de ${rmi}, pagando as parcelas atrasadas desde a DIB.`,
      lightContent: `Sentença de ${sentencaAno}. [DIB, DIP e RMI não especificados]`,
      omittedContent: `[título executivo sem DIB, DIP e RMI]`,
      omissionDescription: "título executivo sem DIB, DIP e RMI",
      correctPresenceKeywords: [String(sentencaAno), nbNum, dib, dip, rmi, "DIB", "DIP", "RMI"],
    },
    {
      id: "parametros_dib_dip_rmi",
      section: DocumentSection.DO_DIREITO,
      fullContent:
        `Parâmetros do julgado:\n` +
        `— DIB: ${dib}\n` +
        `— DIP: ${dip}\n` +
        `— RMI: ${rmi}\n` +
        `— Critério de correção: ${corr}\n` +
        `— Juros de mora: 1% a.m. de ${dib} até o efetivo pagamento\n` +
        `— Benefício NB ${nbNum} concedido administrativamente em ${sentencaAno + 1}`,
      lightContent: `Parâmetros: DIB ${dib}, DIP ${dip}, RMI ${rmi}. [juros e correção não detalhados]`,
      omittedContent: `[parâmetros do julgado não especificados]`,
      omissionDescription: "parâmetros do julgado não especificados",
      correctPresenceKeywords: ["DIB", "DIP", "RMI", dib, dip, rmi, "INPC", "juros"],
    },
    {
      id: "memoria_calculo_completa",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `MEMÓRIA DE CÁLCULO (DIB ${dib} a DIP ${dip})\n\n` +
        `Competência ${comp1}: RMI ${rmi} × fator INPC 1,0234 = ${c01}\n` +
        `Competência ${comp2}: RMI ${rmi} × fator INPC 1,0251 = ${c02}\n` +
        `[...planilha completa em anexo com todas as competências]\n` +
        `Subtotal principal: ${`R$ ${(dn(seed, "sub", 2000000, 5000000) / 100).toFixed(2).replace(".", ",")}`}\n` +
        `Juros: ${`R$ ${(dn(seed, "jur", 200000, 800000) / 100).toFixed(2).replace(".", ",")}`}\n` +
        `TOTAL: ${atrasados}`,
      lightContent: `Memória de cálculo apresentada. TOTAL: ${atrasados}. [detalhe simplificado]`,
      omittedContent: `[memória de cálculo não apresentada]`,
      omissionDescription: "memória de cálculo ausente",
      correctPresenceKeywords: ["DIB", "DIP", "INPC", "fator", "competência", atrasados],
    },
    {
      id: "atrasados_correcao",
      section: DocumentSection.DAS_PROVAS,
      fullContent:
        `O total das parcelas atrasadas, devidamente atualizadas pelo ${corr}, ` +
        `acrescidas de juros de mora, totaliza ${atrasados}. ` +
        `O valor está dentro do teto do RPV (Resolução CNJ n.º 303/2019 — limite de 60 salários mínimos ` +
        `por beneficiário). Caso supere, pede-se expedição de precatório.`,
      lightContent: `Atrasados totais: ${atrasados}. [critérios de correção não detalhados]`,
      omittedContent: `[atrasados informados sem critérios de correção e juros]`,
      omissionDescription: "atrasados sem critérios de correção",
      correctPresenceKeywords: [atrasados, "RPV", "INPC", "juros de mora", corr],
    },
    {
      id: "pedidos_executivos",
      section: DocumentSection.DOS_PEDIDOS,
      fullContent:
        `Requer: (a) expedição de RPV/precatório no valor de ${atrasados}; ` +
        `(b) reserva de honorários (10%); (c) intimação do INSS para pagamento. ` +
        `\n\nTermos em que pede deferimento.\n${seed.city}, ${GEN_DATE}.`,
      lightContent: `Requer a expedição de RPV/precatório de ${atrasados}.`,
      omittedContent: `[pedidos executivos incompletos]`,
      omissionDescription: "pedidos executivos incompletos",
      correctPresenceKeywords: ["RPV", atrasados, "honorários"],
    },
  ];
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function buildRgpsElements(
  config: RgpsScenarioConfig,
  seed: CaseSeedData,
): DocumentElement[] {
  switch (config.benefitType) {
    case "APOSENTADORIA_IDADE_URBANA":         return buildAposentadoriaPorIdadeUrbana(seed);
    case "APOSENTADORIA_ESPECIAL":             return buildAposentadoriaEspecial(seed);
    case "BENEFICIO_INCAPACIDADE":             return buildBeneficioIncapacidade(seed);
    case "LOAS_BPC":                           return buildLoasBpc(seed);
    case "REVISAO_APOSENTADORIA":              return buildRevisaoAposentadoria(seed);
    case "APOSENTADORIA_RURAL":                return buildAposentadoriaRural(seed);
    case "TEMPO_ESPECIAL_LIGHT":               return buildTempoEspecialLight(seed);
    case "CUMPRIMENTO_SENTENCA_PREV":          return buildCumprimentoSentencaPrev(seed);
    case "REAFIRMACAO_DER":                    return buildReafirmacaoDer(seed);
    case "QUALIDADE_SEGURADO":                 return buildQualidadeSegurado(seed);
    case "APOSENTADORIA_CARENCIA_COMPLETA":    return buildAposentadoriaCarenciaCompleta(seed);
    case "CONVERSAO_TEMPO_ESPECIAL":           return buildConversaoTempoEspecial(seed);
    case "AUXILIO_INCAPACIDADE":               return buildAuxilioIncapacidade(seed);
    case "PENSAO_POR_MORTE":                   return buildPensaoPorMorte(seed);
    case "CUMPRIMENTO_JULGADO_COMPLETO":       return buildCumprimentoJulgadoCompleto(seed);
  }
}
