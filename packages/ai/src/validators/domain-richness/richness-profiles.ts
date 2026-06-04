import type { DomainDimension, DomainProfile } from "./domain-richness.types.js";

// ── Shared constants ──────────────────────────────────────────────────────────

const SECTION_MARKERS_RE =
  /\bTese\s+\d+|^\s*\d+\.\s+\S|^\s*[IVX]+\s*[.—\-\):;]|^\s*D[AO]S?\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚ]{3}/gim;

const OBJECTION_HANDLING_RE =
  /(?:poder[-\s]se[-\s]ia\s+(?:alegar|sustentar|objetar|arguir)|eventual\s+(?:alegação|objeção|argumento|sustentação)|argumento\s+(?:em\s+contrário|contrário|da\s+(?:parte\s+)?ré|do\s+réu)|tese\s+(?:contrária|da\s+defesa|adversa)|em\s+resposta\s+(?:a\s+eventual|ao\s+argumento)|pode[-\s]se\s+(?:alegar|objetar)|a\s+(?:parte\s+)?(?:ré|recorrida|requerida)\s+(?:poderá?|poderão|argumentará?|sustentará?)|n[ãa]o\s+(?:é|será)\s+suficiente\s+(?:alegar|arguir)|ainda\s+que\s+se\s+alegue|mesmo\s+que\s+(?:se\s+)?(?:invoque|sustente|alegue)|contrarrazões?\s+(?:que\s+)?(?:podem|deverão?\s+ser))/i;

export const BANNED_EXPRESSIONS = [
  "direito alegado",
  "pretensão da parte",
  "reconhecimento do direito",
  "matéria cível",
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function countSections(draft: string): number {
  const re = new RegExp(SECTION_MARKERS_RE.source, SECTION_MARKERS_RE.flags);
  return (draft.match(re) ?? []).length;
}

function countCourts(draft: string): number {
  const s = new Set<string>();
  if (/\bSTF\b/.test(draft)) s.add("stf");
  if (/\bSTJ\b/.test(draft)) s.add("stj");
  if (/\bTST\b/.test(draft)) s.add("tst");
  if (/\bTNU\b/.test(draft)) s.add("tnu");
  if (/\bTRF\b/.test(draft)) s.add("trf");
  if (/\bTJ[A-Z]{2}\b/.test(draft)) s.add("tj");
  if (/\bTRT\b/.test(draft)) s.add("trt");
  return s.size;
}

function countPrecedents(draft: string): number {
  return new Set(
    (draft.match(/(?:Tema\s+(?:STF|STJ)\s+\d+|REsp\.?\s*[\d.\/]+|RE\s+[\d.\/]+|Súmula\s+(?:n[.°º]?\s*)?\d+|EREsp\.?\s*[\d.\/]+)/gi) ?? [])
      .map((m) => m.toLowerCase()),
  ).size;
}

function countNormasGeral(draft: string): number {
  const arts = new Set(
    (draft.match(/art(?:igo)?\.\s*\d+[\w\-º°]*/gi) ?? [])
      .map((m) => m.toLowerCase().replace(/\s/g, "")),
  );
  const laws = new Set([
    ...(draft.match(/lei\s+(?:n[.°º]?\s*)?\d[\d.,\/]*/gi) ?? []),
    ...(draft.match(/decreto[\s-]lei\s+n[.°º]?\s*\d+/gi) ?? []),
    ...(draft.match(/EC\s+\d+\/\d+|emenda\s+constitucional\s+n[.°º]?\s*\d+/gi) ?? []),
    ...(draft.match(/\bCPC\/\d{4}|\bCF\/\d{2}\b|\bCDC\b/gi) ?? []),
  ].map((m) => m.toLowerCase().replace(/\s/g, "")));
  return arts.size + laws.size;
}

function tiered4(n: number, t1: number, t2: number, t3: number, t4: number, max: number): number {
  return n >= t4 ? max :
    n >= t3 ? Math.round(max * 0.75) :
    n >= t2 ? Math.round(max * 0.5) :
    n >= t1 ? Math.round(max * 0.25) : 0;
}

function tiered3(n: number, t1: number, t2: number, t3: number, max: number): number {
  return n >= t3 ? max :
    n >= t2 ? Math.round(max * 0.6) :
    n >= t1 ? Math.round(max * 0.25) : 0;
}

function sectionDim(draft: string, max: number): DomainDimension {
  const score = tiered4(countSections(draft), 1, 2, 4, 6, max);
  return { key: "estrutura", label: "Estrutura de Seções", score, max };
}

function jurCount(draft: string): number {
  return countCourts(draft) + countPrecedents(draft);
}

function objecoesDim(draft: string, max: number): DomainDimension {
  return {
    key: "objecoes",
    label: "Objeções e Enfrentamento",
    score: OBJECTION_HANDLING_RE.test(draft) ? max : 0,
    max,
  };
}

// ── EXECUCAO_CUMPRIMENTO ──────────────────────────────────────────────────────
// FASE 4.6.1 — tiers recalibrados para medidas e estratégia.
// Peças executivas tecnicamente corretas devem marcar 80+ sem depender de jur.
// Medidas (30): 1→15 | 2→22 | 3→27 | 4+→30
// Estratégia (20): 1→8 | 2→14 | 3→18 | 4+→20

function scoreExecucao(draft: string): DomainDimension[] {
  // Normas (15) — arts. de execução do CPC + lei processual
  const n = countNormasGeral(draft);
  const normasScore = tiered4(n, 1, 2, 4, 6, 15);

  // Jurisprudência (5) — requisito mínimo; não penaliza ausência
  const jc = jurCount(draft);
  const jurScore = jc >= 2 ? 5 : jc >= 1 ? 3 : 0;

  // Estrutura (20)
  const estr = sectionDim(draft, 20);

  // Medidas executivas (30) — FASE 4.6.1: tiers generosos + padrões expandidos
  // Valoriza: SISBAJUD, RENAJUD, INFOJUD, CNIB, penhora, expropriação,
  // art. 523/524/835/854, multa, impugnação, excesso de execução, honorários
  const medidas = [
    /SISBAJUD/i,
    /RENAJUD/i,
    /INFOJUD/i,
    /BacenJud/i,
    /\bCNIB\b/i,
    /\bpenhora\b/i,
    /bloqueio\s+(?:de\s+)?(?:valores?|ativos?|conta)|bloqueio\s+eletr[oô]nico/i,
    /expropia[cç][aã]o/i,
    /grada[cç][aã]o\s+(?:de\s+)?bens\s+pen[uh]or[aá]veis|art\.?\s*835\s+(?:do\s+)?CPC/i,
    /arresto/i,
    /hasta\s+p[úu]blica|leil[ãa]o\s+(?:judicial|eletr[oô]nico)/i,
    /adjudica[cç][aã]o/i,
    /art\.?\s*523\s+(?:do\s+)?CPC|multa\s+(?:de\s+)?10\s*%\s+(?:do\s+)?d[eé]bito/i,
    /art\.?\s*524\s+(?:do\s+)?CPC|demonstrativo\s+(?:do\s+)?d[eé]bito/i,
    /art\.?\s*854\s+(?:do\s+)?CPC|penhora\s+(?:de\s+ativos\s+)?online/i,
    /impugna[cç][aã]o\s+(?:ao\s+)?cumprimento/i,
    /excesso\s+de\s+execu[cç][aã]o/i,
    /honor[aá]rios\s+(?:advocat[íi]cios\s+)?da\s+(?:fase\s+de\s+)?execu[cç][aã]o/i,
  ];
  const medidasCount = medidas.filter((re) => re.test(draft)).length;
  // Tiers customizados: 2 medidas relevantes já pontuam 22/30
  const medidasScore =
    medidasCount >= 4 ? 30 :
    medidasCount >= 3 ? 27 :
    medidasCount >= 2 ? 22 :
    medidasCount >= 1 ? 15 : 0;

  // Estratégia processual (20) — FASE 4.6.1: tiers mais generosos
  const estrategia = [
    /intimação\s+(?:do\s+)?(?:executado|devedor|réu)/i,
    /prazo\s+de\s+(?:15|quinze)\s+dias?\s+(?:úteis?\s+)?(?:para|a\s+contar)/i,
    /certid[aã]o\s+de\s+d[íi]vida\s+ativa|CDA\b/i,
    /t[íi]tulo\s+executivo\s+(?:judicial|extrajudicial)/i,
    /juros\s+de\s+mora|corre[cç][aã]o\s+monet[aá]ria/i,
    /mem[oó]ria\s+de\s+c[áa]lculo|planilha\s+de\s+(?:cálculo|débito)/i,
    /liquida[cç][aã]o\s+de\s+senten[cç]a|cálculo\s+de\s+liquida[cç][aã]o/i,
    /cita[cç][aã]o\s+(?:do\s+)?executado|citar\s+o\s+(?:executado|réu)/i,
    /exce[cç][aã]o\s+de\s+pré[-\s]executividade/i,
    /pagamento\s+voluntário|pagamento\s+em\s+(?:15|quinze)\s+dias/i,
  ];
  const estrategiaCount = estrategia.filter((re) => re.test(draft)).length;
  // Tiers customizados: 3 estratégias já garantem 18/20
  const estrategiaScore =
    estrategiaCount >= 4 ? 20 :
    estrategiaCount >= 3 ? 18 :
    estrategiaCount >= 2 ? 14 :
    estrategiaCount >= 1 ? 8 : 0;

  return [
    { key: "normas", label: "Normas Processuais", score: normasScore, max: 15 },
    { key: "jurisprudencia", label: "Jurisprudência", score: jurScore, max: 5 },
    { ...estr },
    { key: "medidas_executivas", label: "Medidas Executivas", score: medidasScore, max: 30 },
    { key: "estrategia_processual", label: "Estratégia Processual", score: estrategiaScore, max: 20 },
    { ...objecoesDim(draft, 10) },
  ];
}

// ── RPPS ──────────────────────────────────────────────────────────────────────
// FASE 4.6.1 — peso jurisprudência 25→15, argumentação constitucional 20→30.
// RPPS é predominantemente constitucional: EC + paridade + transição compensam
// ausência de múltiplos precedentes.
// ArgConst tiers: n=1→8 | n=2→16 | n=3→22 | n=4→27 | n=5+→30

function scoreRpps(draft: string): DomainDimension[] {
  // Normas (25) — Emendas constitucionais + art. 40 CF
  const emendas = [
    /\bEC\s+20(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?20\b/i,
    /\bEC\s+41(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?41\b/i,
    /\bEC\s+47(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?47\b/i,
    /\bEC\s+70(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?70\b/i,
    /art\.?\s*40\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)/i,
    /art\.?\s*6[oº°]\s+(?:da\s+)?EC\s+41/i,
    /regime\s+pr[oó]prio\s+de\s+previd[eê]ncia/i,
    /estatuto\s+(?:do\s+)?servidor/i,
  ];
  const emendaCount = emendas.filter((re) => re.test(draft)).length;
  const normasScore = tiered4(emendaCount, 1, 2, 4, 6, 25);

  // Jurisprudência STF (15) — FASE 4.6.1: peso reduzido de 25 → 15
  const jc = jurCount(draft);
  const jurScore = jc >= 3 ? 15 : jc >= 2 ? 10 : jc >= 1 ? 5 : 0;

  // Estrutura (15)
  const estr = sectionDim(draft, 15);

  // Argumentação constitucional (30) — FASE 4.6.1: peso ampliado de 20 → 30
  // Detecta: EC refs (overlap intencional com normas), paridade standalone,
  // integralidade standalone, transição, direito adquirido, isonomia, ingresso.
  // A sobreposição com normas é INTENCIONAL — citar EC 41 É um argumento constitucional.
  const args = [
    /\bparidade\b/i,
    /\bintegralidade\b/i,
    /regra\s+de\s+transi[cç][aã]o/i,
    /\bEC\s+41(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?41\b/i,
    /\bEC\s+47(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?47\b/i,
    /\bEC\s+70(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?70\b/i,
    /art\.?\s*40\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)/i,
    /art\.?\s*6[oº°]\s+(?:da\s+)?EC\s+41/i,
    /direito\s+adquirido/i,
    /ato\s+jur[íi]dico\s+perfeito/i,
    /irredutibilidade/i,
    /isonomia/i,
    /ingresso\s+(?:antes|anterior)\s+(?:da|à)\s+(?:EC|Emenda|reforma)/i,
    /proventos?\s+(?:de|da)\s+aposentadoria/i,
  ];
  const argCount = args.filter((re) => re.test(draft)).length;
  // Tiers customizados: 4 argumentos constitucionais → 27/30 (90%)
  const argScore =
    argCount >= 5 ? 30 :
    argCount >= 4 ? 27 :
    argCount >= 3 ? 22 :
    argCount >= 2 ? 16 :
    argCount >= 1 ? 8 : 0;

  return [
    { key: "normas", label: "Normas Constitucionais", score: normasScore, max: 25 },
    { key: "jurisprudencia", label: "Jurisprudência STF", score: jurScore, max: 15 },
    { ...estr },
    { key: "argumentacao_constitucional", label: "Argumentação Constitucional", score: argScore, max: 30 },
    { ...objecoesDim(draft, 15) },
  ];
}

// ── RGPS ──────────────────────────────────────────────────────────────────────
// FASE 4.6.1 — tiers de jurisprudência suavizados (0 courts → 4 pts, não 0).
// Requisitos previdenciários robustos devem compensar ausência de precedentes.

function scoreRgps(draft: string): DomainDimension[] {
  // Normas (25) — Lei 8.213, Decreto 3.048, art. 201 CF
  const rgpsNorms = [
    /lei\s+(?:n[.°º]?\s*)?8\.213/i,
    /decreto\s+(?:n[.°º]?\s*)?3\.048/i,
    /art\.?\s*201\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)/i,
    /art\.?\s*195\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)/i,
    /lei\s+(?:n[.°º]?\s*)?8\.742/i,
    /\bLOAS\b/i,
    /lei\s+(?:n[.°º]?\s*)?9\.876/i,
  ];
  const specificCount = rgpsNorms.filter((re) => re.test(draft)).length;
  const artCount = Math.min(
    new Set((draft.match(/art(?:igo)?\.\s*\d+[\w\-º°]*/gi) ?? []).map((m) => m.toLowerCase())).size,
    5,
  );
  const normasScore = tiered4(specificCount + artCount, 1, 3, 5, 8, 25);

  // Jurisprudência STJ/TNU (20) — FASE 4.6.1: tiers suavizados
  // jc=0 → 4 pts (pontuação base para não punir ausência de citação direta)
  const jc = jurCount(draft);
  const jurScore =
    jc >= 3 ? 20 :
    jc >= 2 ? 14 :
    jc >= 1 ? 9 :
    4;  // baseline — requisitos sólidos compensam ausência de jur

  // Estrutura (15)
  const estr = sectionDim(draft, 15);

  // Requisitos previdenciários (25) — FASE 4.6.1: tiers mais generosos
  // reqCount=5 → 21/25 (84%) para premiar cobertura sólida
  const requisitos = [
    /qualidade\s+de\s+segurado/i,
    /per[íi]odo\s+de\s+gra[cç]a/i,
    /car[eê]ncia/i,
    /recolhimentos?\s+(?:mensais?|(?:à|ao)\s+previd[eê]ncia)/i,
    /incapacidade\s+(?:labor[ae]|para\s+o\s+trabalho|total|parcial)/i,
    /\bCNIS\b/i,
    /\bDER\b|\bdata\s+de\s+entrada\s+do\s+requerimento/i,
    /\bDIB\b|\bdata\s+de\s+in[íi]cio\s+do\s+benef[íi]cio/i,
    /laudo\s+pericial|per[íi]cia\s+médica/i,
    /v[íi]nculo\s+(?:empregatício|trabalhista|previdenciário)/i,
    /tempo\s+de\s+contribui[cç][aã]o/i,
    /segurado\s+especial/i,
  ];
  const reqCount = requisitos.filter((re) => re.test(draft)).length;
  // Tiers customizados: cobertura de 5 requisitos já atinge 84% do máximo
  const reqScore =
    reqCount >= 7 ? 25 :
    reqCount >= 5 ? 21 :
    reqCount >= 3 ? 15 :
    reqCount >= 1 ? 7 : 0;

  return [
    { key: "normas", label: "Normas Previdenciárias", score: normasScore, max: 25 },
    { key: "jurisprudencia", label: "Jurisprudência STJ/TNU", score: jurScore, max: 20 },
    { ...estr },
    { key: "requisitos_previdenciarios", label: "Requisitos Previdenciários", score: reqScore, max: 25 },
    { ...objecoesDim(draft, 15) },
  ];
}

// ── JEF_ESTADUAL ──────────────────────────────────────────────────────────────
// Juizados estaduais: rito dos juizados + tutela e competência são primários.

function scoreJefEstadual(draft: string): DomainDimension[] {
  const jefNorms = [
    /lei\s+(?:n[.°º]?\s*)?9\.099/i,
    /lei\s+dos?\s+juizados?\s+especiais?\s+(?:cíveis?\s+e\s+)?criminais?/i,
    /art\.?\s*3[oº°]?\s+(?:da\s+)?(?:lei\s+(?:n[.°º]?\s*)?9\.099|lei\s+dos?\s+juizados)/i,
    /art\.?\s*[89]\s+(?:da\s+)?lei\s+(?:n[.°º]?\s*)?9\.099/i,
    /art\.?\s*20\s+(?:da\s+)?lei\s+(?:n[.°º]?\s*)?9\.099/i,
  ];
  const normCount = jefNorms.filter((re) => re.test(draft)).length;
  const normasScore = normCount >= 3 ? 15 : normCount >= 2 ? 10 : normCount >= 1 ? 5 : 0;

  const jc = jurCount(draft);
  const jurScore = jc >= 2 ? 10 : jc >= 1 ? 5 : 0;

  const estr = sectionDim(draft, 15);

  const rito = [
    /recurso\s+inominado/i,
    /[Tt]urma\s+[Rr]ecursal/i,
    /competência\s+(?:do\s+)?(?:juizado|JEF|JEC)/i,
    /valor\s+da\s+causa/i,
    /sal[aá]rio(?:s)?\s+m[íi]nimo(?:s)?/i,
    /informalismo|celeridade\s+processual/i,
    /pedido\s+alternativo/i,
    /art\.?\s*3[oº°]?\s+(?:da\s+)?(?:lei\s+9\.099|lei\s+dos?\s+juizados)/i,
    /\bFONAJE\b/i,
    /enunciado\s+(?:n[.°º]?\s*)?\d+/i,
    /competência\s+absoluta/i,
    /al[cç]ada/i,
  ];
  const ritoScore = tiered4(rito.filter((re) => re.test(draft)).length, 1, 3, 6, 9, 35);

  const tutela = [
    /tutela\s+de\s+urg[eê]ncia|tutela\s+antecipada/i,
    /tutela\s+cautelar/i,
    /competência\s+(?:do\s+)?(?:juizado|JEF|JEC)/i,
    /limite\s+de\s+40\s+(?:SM|sal[aá]rios?\s+m[íi]nimos?)|quarenta\s+sal[aá]rios?\s+m[íi]nimos?/i,
    /incompetência\s+(?:material|absoluta)/i,
    /art\.?\s*300\s+(?:do\s+)?CPC/i,
    /perigo\s+de\s+dano\s+grave|periculum\s+in\s+mora/i,
    /urgência\s+(?:da\s+)?(?:medida|tutela)/i,
  ];
  const tutelaScore = tiered4(tutela.filter((re) => re.test(draft)).length, 1, 2, 4, 6, 25);

  return [
    { key: "normas", label: "Normas dos Juizados", score: normasScore, max: 15 },
    { key: "jurisprudencia", label: "Jurisprudência TNU/TR", score: jurScore, max: 10 },
    { ...estr },
    { key: "rito_juizados", label: "Rito dos Juizados", score: ritoScore, max: 35 },
    { key: "tutela_competencia", label: "Tutela e Competência", score: tutelaScore, max: 25 },
  ];
}

// ── JEF_FEDERAL ───────────────────────────────────────────────────────────────
// Juizados federais: direito material federal (INSS/União/CEF) é primário.

function scoreJefFederal(draft: string): DomainDimension[] {
  const jefFedNorms = [
    /lei\s+(?:n[.°º]?\s*)?10\.259/i,
    /art\.?\s*3[oº°]?\s+(?:da\s+)?lei\s+(?:n[.°º]?\s*)?10\.259/i,
    /art\.?\s*17\s+(?:da\s+)?lei\s+(?:n[.°º]?\s*)?10\.259/i,
    /juizados?\s+especiais?\s+(?:cíveis?\s+e\s+)?federais?/i,
    /lei\s+dos?\s+juizados?\s+(?:especiais?\s+)?federais?/i,
  ];
  const normCount = jefFedNorms.filter((re) => re.test(draft)).length;
  const normasScore = normCount >= 3 ? 15 : normCount >= 2 ? 10 : normCount >= 1 ? 5 : 0;

  const jc = jurCount(draft);
  const jurScore = jc >= 2 ? 10 : jc >= 1 ? 5 : 0;

  const estr = sectionDim(draft, 15);

  const rito = [
    /recurso\s+inominado/i,
    /[Tt]urma\s+[Rr]ecursal\s+[Ff]ederal/i,
    /competência\s+(?:do\s+)?(?:JEF|juizado\s+federal)/i,
    /valor\s+da\s+causa/i,
    /60\s+(?:SM|sal[aá]rios?\s+m[íi]nimos?)|sessenta\s+sal[aá]rios?\s+m[íi]nimos?/i,
    /limite\s+de\s+60\s+(?:SM|sal[aá]rios?)/i,
    /art\.?\s*3[oº°]?\s+(?:da\s+)?lei\s+(?:n[.°º]?\s*)?10\.259/i,
  ];
  const ritoScore = tiered4(rito.filter((re) => re.test(draft)).length, 1, 2, 4, 6, 25);

  const material = [
    /\bINSS\b/i,
    /Uni[aã]o\s+Federal/i,
    /Fazenda\s+Nacional/i,
    /aux[íi]lio[-\s]doen[cç]a/i,
    /aposentadori[ao]\s+(?:por\s+)?(?:invalidez|por\s+idade|por\s+tempo)/i,
    /\bBPC\b|\bLOAS\b|benef[íi]cio\s+de\s+presta[cç][aã]o\s+continuada/i,
    /pens[aã]o\s+por\s+morte/i,
    /sal[aá]rio[-\s]maternidade/i,
    /aux[íi]lio[-\s]acidente/i,
    /\bCEF\b|\bCaixa\s+Econ[oô]mica\s+Federal\b/i,
    /\bFGTS\b/i,
    /servidor\s+(?:p[uú]blico\s+)?federal/i,
    /concurso\s+p[uú]blico\s+federal/i,
    /segurado\s+especial/i,
  ];
  const materialScore = tiered4(material.filter((re) => re.test(draft)).length, 1, 3, 6, 9, 35);

  return [
    { key: "normas", label: "Normas JEF Federal", score: normasScore, max: 15 },
    { key: "jurisprudencia", label: "Jurisprudência TNU/TRF", score: jurScore, max: 10 },
    { ...estr },
    { key: "rito_juizados", label: "Rito dos Juizados Federais", score: ritoScore, max: 25 },
    { key: "direito_material_federal", label: "Direito Material Federal", score: materialScore, max: 35 },
  ];
}

// ── CONSUMIDOR ────────────────────────────────────────────────────────────────
// Direito do consumidor: CDC e responsabilidade objetiva são o núcleo.

function scoreConsumidor(draft: string): DomainDimension[] {
  const cdcNorms = [
    /\bCDC\b/i,
    /lei\s+(?:n[.°º]?\s*)?8\.078/i,
    /\bLGPD\b|lei\s+(?:n[.°º]?\s*)?13\.709/i,
    /c[oó]digo\s+de\s+defesa\s+do\s+consumidor/i,
    /art\.?\s*(?:5[oº°]?|170)\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)/i,
  ];
  const cdcNormCount = cdcNorms.filter((re) => re.test(draft)).length;
  const artCount = Math.min(
    new Set((draft.match(/art(?:igo)?\.\s*\d+[\w\-º°]*/gi) ?? []).map((m) => m.toLowerCase())).size,
    4,
  );
  const normasScore = tiered4(cdcNormCount + artCount, 1, 2, 4, 7, 20);

  const jc = jurCount(draft);
  const jurScore = tiered3(jc, 1, 2, 3, 20);

  const estr = sectionDim(draft, 15);

  const cdcPrincipios = [
    /responsabilidade\s+objetiva/i,
    /dano\s+moral/i,
    /dano\s+material/i,
    /invers[aã]o\s+(?:do\s+)?[oô]nus\s+(?:da\s+)?prova/i,
    /vulnerabilidade/i,
    /hipossufici[eê]ncia/i,
    /rela[cç][aã]o\s+de\s+consumo/i,
    /fornecedor/i,
    /fato\s+(?:do\s+produto|do\s+servi[cç]o)/i,
    /v[íi]cio\s+(?:do\s+produto|do\s+servi[cç]o|redibit[oó]rio)/i,
    /repeti[cç][aã]o\s+em\s+dobro|art\.?\s*42\s+(?:do\s+)?CDC/i,
    /pr[aá]tica\s+abusiva|cobran[cç]a\s+indevida/i,
    /publicidade\s+enganosa/i,
    /defeito\s+(?:do\s+)?(?:produto|servi[cç]o)/i,
  ];
  const cdcScore = tiered4(cdcPrincipios.filter((re) => re.test(draft)).length, 1, 3, 6, 9, 30);

  return [
    { key: "normas", label: "Normas Consumeristas", score: normasScore, max: 20 },
    { key: "jurisprudencia", label: "Jurisprudência STJ/TJ", score: jurScore, max: 20 },
    { ...estr },
    { key: "cdc_principios", label: "Princípios CDC", score: cdcScore, max: 30 },
    { ...objecoesDim(draft, 15) },
  ];
}

// ── CIVEL_GERAL — modelo atual ─────────────────────────────────────────────────

function scoreCivelGeral(draft: string, isSentenca?: boolean): DomainDimension[] {
  const normCount = countNormasGeral(draft);
  const normasScore =
    normCount >= 8 ? 30 :
    normCount >= 5 ? Math.round(30 * 0.83) :
    normCount >= 3 ? Math.round(30 * 0.5) :
    normCount >= 1 ? Math.round(30 * 0.17) : 0;

  const secCount = countSections(draft);
  const secScore =
    secCount >= 6 ? 25 :
    secCount >= 4 ? Math.round(25 * 0.72) :
    secCount >= 2 ? Math.round(25 * 0.4) :
    secCount >= 1 ? Math.round(25 * 0.2) : 0;

  const jc = jurCount(draft);
  const jurScore =
    jc >= 3 ? 20 :
    jc >= 2 ? Math.round(20 * 0.6) :
    jc >= 1 ? Math.round(20 * 0.25) : 0;

  const objScore = OBJECTION_HANDLING_RE.test(draft) ? 15 : 0;

  const lower = draft.toLowerCase();
  const fundamentacaoStart = isSentenca
    ? (() => {
        const idx = lower.search(/fundamenta[cç][aã]o|motiva[cç][aã]o|an[aá]lise\s+do\s+m[eé]rito|\bfundamento\b/i);
        return idx >= 0 ? idx : lower.length;
      })()
    : 0;
  const checkText = lower.slice(fundamentacaoStart);
  const bannedInText = BANNED_EXPRESSIONS.filter((expr) => checkText.includes(expr));
  const genericScore = bannedInText.length === 0 ? 10 : bannedInText.length === 1 ? 5 : 0;

  return [
    { key: "normas", label: "Variedade Normativa", score: normasScore, max: 30 },
    { key: "estrutura", label: "Estrutura de Seções", score: secScore, max: 25 },
    { key: "jurisprudencia", label: "Variedade Jurisprudencial", score: jurScore, max: 20 },
    { key: "objecoes", label: "Enfrentamento de Objeções", score: objScore, max: 15 },
    { key: "expressoes", label: "Ausência de Expressões Genéricas", score: genericScore, max: 10 },
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

export const VALID_PROFILES: DomainProfile[] = [
  "EXECUCAO_CUMPRIMENTO",
  "RPPS",
  "RGPS",
  "JEF_ESTADUAL",
  "JEF_FEDERAL",
  "CONSUMIDOR",
  "CIVEL_GERAL",
];

export function isValidProfile(value: string): value is DomainProfile {
  return VALID_PROFILES.includes(value as DomainProfile);
}

export function scoreDomainProfile(
  profile: DomainProfile,
  draft: string,
  isSentenca?: boolean,
): { dimensions: DomainDimension[]; bannedExpressionsFound: string[] } {
  const lower = draft.toLowerCase();
  const bannedExpressionsFound = BANNED_EXPRESSIONS.filter((expr) => lower.includes(expr));

  let dimensions: DomainDimension[];
  switch (profile) {
    case "EXECUCAO_CUMPRIMENTO": dimensions = scoreExecucao(draft);               break;
    case "RPPS":                 dimensions = scoreRpps(draft);                   break;
    case "RGPS":                 dimensions = scoreRgps(draft);                   break;
    case "JEF_ESTADUAL":         dimensions = scoreJefEstadual(draft);            break;
    case "JEF_FEDERAL":          dimensions = scoreJefFederal(draft);             break;
    case "CONSUMIDOR":           dimensions = scoreConsumidor(draft);             break;
    case "CIVEL_GERAL":
    default:                     dimensions = scoreCivelGeral(draft, isSentenca); break;
  }

  return { dimensions, bannedExpressionsFound };
}
