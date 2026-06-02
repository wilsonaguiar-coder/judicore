// Regras específicas de Direito Penal e Processual Penal

export const CRIMINAL_BLOCKED_TERMS = [
  "art. 85 cpc",
  "art. 85 §2º cpc",
  // "honorários advocatícios" — removido: o prompt proíbe qualquer menção (inclusive negação),
  // então não há draft correto que contenha essa string; bloquear causava falsos positivos
  // quando o AI escrevia "não há honorários" (linguagem correta que virou errada pelo prompt).
  "julgo procedente",
  "julgo improcedente",
  "julgo parcialmente procedente",
  "vara cível",
  "ação declaratória",
  "ação ordinária",
  "art. 927 cc",
  "art. 186 cc",
];

export const CRIMINAL_PIECE_RULES: Record<string, string[]> = {
  HABEAS_CORPUS: [
    'Usar "concedo/denego a ordem", nunca "julgo procedente/improcedente"',
    "Verificar: art. 5º LXVIII CF/88 como fundamento constitucional",
    "Verificar: arts. 647-667 CPP (habeas corpus)",
    "Nunca usar linguagem de ação ordinária cível",
  ],
  SENTENCA_CRIMINAL: [
    "Usar: ABSOLVO / CONDENO",
    "Nunca usar: julgo procedente / julgo improcedente",
    "Dosimetria da pena: arts. 59-76 CP",
    "Honorários: não há em processo criminal",
    "Custas: art. 804 CPP",
  ],
  RECURSO_CRIMINAL: [
    "Apelação criminal: art. 593 CPP, prazo 5 dias",
    "RESE (Recurso em Sentido Estrito): art. 581 CPP, prazo 5 dias",
    "Não usar 'apelação cível' ou 'art. 1.009 CPC'",
  ],
};

export const CRIMINAL_KEY_ARTICLES = [
  "art. 5º XI CF/88 — inviolabilidade do domicílio",
  "art. 5º LV CF/88 — contraditório e ampla defesa",
  "art. 5º LXVIII CF/88 — habeas corpus",
  "art. 312 CPP — requisitos da prisão preventiva",
  "art. 316 CPP — revogação da prisão preventiva",
  "art. 317 CPP — prisão domiciliar",
  "art. 302 CPP — flagrante delito",
  "art. 306 CPP — comunicação da prisão em flagrante",
  "art. 593 CPP — apelação criminal",
  "art. 581 CPP — recurso em sentido estrito",
  "art. 59 CP — critérios para fixação da pena",
];

export const CRIMINAL_HONORARIOS_RULE =
  "Em matéria criminal, não há condenação em honorários advocatícios. Não citar art. 85 CPC.";

export const FLAGRANTE_LEGALITY_CHECKLIST = [
  "Verificar: houve consentimento do morador para entrada na residência?",
  "Verificar: havia situação de flagrante delito que autorizasse o ingresso sem mandado?",
  "Verificar: a prisão em flagrante foi convertida em preventiva? Se sim, o vício do flagrante pode estar superado.",
  "Verificar: requisitos do art. 312 CPP para preventiva (garantia da ordem pública, conveniência da instrução, aplicação da lei penal)",
  "Verificar: art. 5º XI CF/88 — exceções à inviolabilidade do domicílio",
];
