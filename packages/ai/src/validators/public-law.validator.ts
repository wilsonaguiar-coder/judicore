// PublicLawValidator — Especificação técnica completa.
//
// STATUS: NÃO INTEGRADO AO PIPELINE (Fase 2 — planejamento estratégico).
// Objetivo: validar automaticamente peças de Fazenda Pública quanto às
// regras constitucionais e infraconstitucionais específicas do direito público.
//
// Para integrar: instanciar em final.validator.ts e pipeline/validator.ts,
// condicionado a classification.area === "FAZENDA_PUBLICA" ou
// keywords da descrição indicando direito público.

import type { ValidationError, ValidationResult } from "../pipeline/types.js";

// ── Tipos internos ────────────────────────────────────────────────────────────

interface PublicLawRule {
  id: string;
  description: string;
  fatal: boolean;
  scoreImpact: number;          // pontos deduzidos do score (0-100) quando disparada
  area: PublicLawArea[];        // áreas em que a regra é relevante
  pattern?: RegExp;             // padrão opcional para detecção determinística
  example: {
    error: string;
    correction: string;
  };
}

type PublicLawArea =
  | "SAUDE"         // direito à saúde — medicamentos, cirurgias, SUS
  | "CONCURSO"      // concursos públicos — nomeação, posse, eliminação
  | "SERVIDOR"      // servidores públicos — progressão, verbas, regime
  | "LICITACAO"     // licitações e contratos administrativos
  | "RESPONSABILIDADE" // responsabilidade civil do Estado
  | "GERAL";        // aplicável a qualquer matéria de Fazenda Pública

// ── Score esperado por tipo de peça ──────────────────────────────────────────

export const FP_EXPECTED_SCORES: Record<string, { min: number; ideal: number }> = {
  PETICAO_INICIAL: { min: 70, ideal: 85 },
  DECISAO:        { min: 72, ideal: 88 },
  SENTENCA:       { min: 75, ideal: 90 },
  RECURSO:        { min: 68, ideal: 83 },
};

// ── Catálogo de regras ────────────────────────────────────────────────────────

export const PUBLIC_LAW_RULES: PublicLawRule[] = [

  // ── DIREITO À SAÚDE ───────────────────────────────────────────────────────

  {
    id: "FP_SAUDE_SOLIDARIEDADE_FALTANDO",
    description: "Demanda de saúde sem mencionar a responsabilidade solidária dos entes (Tema STF 793 — RE 855.178)",
    fatal: false,
    scoreImpact: 8,
    area: ["SAUDE"],
    pattern: /art\.\s*196\s*cf/i,  // cita saúde mas não cita solidariedade/tema 793
    example: {
      error: "Condenar apenas o Município a fornecer o medicamento sem mencionar a solidariedade da União e do Estado.",
      correction: "Mencionar o Tema STF 793 (RE 855.178): União, Estado e Município respondem solidariamente; o julgador pode direcionar o cumprimento ao ente processado.",
    },
  },

  {
    id: "FP_SAUDE_RESERVA_POSSIVEL_SEM_MINIMO_EXISTENCIAL",
    description: "Reserva do possível aplicada sem análise do mínimo existencial — argumento insuficiente",
    fatal: true,
    scoreImpact: 15,
    area: ["SAUDE"],
    example: {
      error: "Negar o medicamento invocando apenas a reserva do possível sem verificar se a negativa viola o mínimo existencial do paciente.",
      correction: "A reserva do possível só prevalece quando não viola o mínimo existencial (art. 1º, III, CF/88). Analisar: há alternativa terapêutica? O tratamento negado é imprescindível à sobrevivência digna?",
    },
  },

  {
    id: "FP_SAUDE_SEPARACAO_PODERES_ABSOLUTA",
    description: "Separação dos poderes usada como óbice absoluto ao direito à saúde sem ponderação",
    fatal: true,
    scoreImpact: 12,
    area: ["SAUDE", "GERAL"],
    example: {
      error: "Negar medicamento alegando que o Judiciário não pode interferir em políticas públicas de saúde — sem qualquer ponderação.",
      correction: "A separação dos poderes é ELEMENTO de ponderação, não veto absoluto. O Judiciário intervém quando a omissão estatal viola o mínimo existencial ou direitos fundamentais (STF, ADPF 45).",
    },
  },

  {
    id: "FP_SAUDE_MEDICAMENTO_SEM_LAUDO",
    description: "Peça de saúde não menciona ou dispensa o laudo médico como prova da necessidade",
    fatal: false,
    scoreImpact: 6,
    area: ["SAUDE"],
    example: {
      error: "Pedir fornecimento de medicamento de alto custo sem mencionar a necessidade do laudo médico de especialista.",
      correction: "O laudo médico é condição sine qua non: demonstra a necessidade terapêutica, a gravidade da condição e a ausência de alternativa equivalente no SUS.",
    },
  },

  {
    id: "FP_SAUDE_TUTELA_SEM_URGENCIA_MEDICA",
    description: "Tutela de urgência em demanda de saúde sem documentar o periculum in mora médico",
    fatal: false,
    scoreImpact: 7,
    area: ["SAUDE"],
    example: {
      error: "Requerer tutela de urgência para fornecimento de medicamento sem mencionar prazo de agravamento ou risco à vida.",
      correction: "O periculum in mora médico deve ser específico: indicar em quantos dias haverá agravamento irreversível caso o tratamento não seja iniciado imediatamente.",
    },
  },

  // ── CONCURSO PÚBLICO ──────────────────────────────────────────────────────

  {
    id: "FP_CONCURSO_TEMA784_FALTANDO",
    description: "Ação de nomeação em concurso público sem aplicar o Tema STF 784 (RE 837.311)",
    fatal: true,
    scoreImpact: 15,
    area: ["CONCURSO"],
    example: {
      error: "Pedir nomeação por aprovação dentro das vagas sem citar o Tema STF 784 nem seus requisitos.",
      correction: "Aplicar o Tema STF 784: candidato aprovado dentro das vagas tem DIREITO SUBJETIVO (não mera expectativa) à nomeação, vinculando a Administração quando há necessidade real (temporários ou novo concurso).",
    },
  },

  {
    id: "FP_CONCURSO_CADASTRO_RESERVA_DIREITO_SUBJETIVO",
    description: "Tratamento de candidato em cadastro de reserva (fora das vagas) como titular de direito subjetivo à nomeação",
    fatal: true,
    scoreImpact: 12,
    area: ["CONCURSO"],
    example: {
      error: "Afirmar que candidato na 50ª colocação (fora das 20 vagas) tem direito subjetivo à nomeação.",
      correction: "Fora das vagas previstas no edital, o candidato tem MERA EXPECTATIVA de direito — não direito subjetivo. O Tema STF 784 só protege aprovados dentro do número de vagas.",
    },
  },

  {
    id: "FP_CONCURSO_PRAZO_VALIDADE_IGNORADO",
    description: "Pedido de nomeação sem verificar se o concurso ainda estava no prazo de validade",
    fatal: false,
    scoreImpact: 8,
    area: ["CONCURSO"],
    example: {
      error: "Pedir nomeação sem mencionar se o prazo de validade do concurso estava vigente na época da omissão.",
      correction: "O Tema STF 784 pressupõe que o concurso esteja no prazo de validade. Após o vencimento sem prorrogação, a Administração não é obrigada a nomear.",
    },
  },

  {
    id: "FP_CONCURSO_EDITAL_SEM_VERIFICACAO",
    description: "Impugnação de ato de eliminação em concurso sem verificar se o critério consta no edital",
    fatal: false,
    scoreImpact: 6,
    area: ["CONCURSO"],
    example: {
      error: "Pedir suspensão de eliminação sem verificar/citar o edital como parâmetro de legalidade.",
      correction: "O edital é lei entre as partes (Súmula 684 STF). A impugnação deve demonstrar que o critério aplicado NÃO consta no edital — base da ilegalidade.",
    },
  },

  // ── SERVIDOR PÚBLICO ──────────────────────────────────────────────────────

  {
    id: "FP_SERVIDOR_PRESCRICAO_QUINQUENAL_IGNORADA",
    description: "Cobrança de verbas funcionais de servidor sem considerar a prescrição quinquenal do DL 4.597/42",
    fatal: true,
    scoreImpact: 15,
    area: ["SERVIDOR"],
    pattern: /adicional|gratifica[cç][aã]o|vencimento|salário/i,
    example: {
      error: "Pedir pagamento de adicional de insalubridade de 8 anos atrás como se o prazo prescricional fosse o geral do CC (10 anos).",
      correction: "Para servidores públicos, aplicar o DL 4.597/42: prescrição quinquenal. Pela Súmula 85 STJ, a prescrição não atinge o fundo de direito — apenas as parcelas anteriores ao quinquênio precedente ao ajuizamento.",
    },
  },

  {
    id: "FP_SERVIDOR_PROGRESSAO_ATO_VINCULADO",
    description: "Progressão funcional tratada como ato discricionário quando é ato vinculado",
    fatal: false,
    scoreImpact: 8,
    area: ["SERVIDOR"],
    example: {
      error: "Aceitar a alegação da Administração de 'conveniência e oportunidade' para negar progressão após o cumprimento dos requisitos objetivos.",
      correction: "A progressão funcional é ato VINCULADO — preenchidos os requisitos legais (avaliação satisfatória + interstício), a Administração é obrigada a concedê-la. Não há discricionariedade.",
    },
  },

  {
    id: "FP_SERVIDOR_RESTRICAO_ORCAMENTARIA_GENERICA",
    description: "Restrição orçamentária genérica aceita como fundamento suficiente para negar ato vinculado",
    fatal: false,
    scoreImpact: 6,
    area: ["SERVIDOR", "GERAL"],
    example: {
      error: "Acolher a restrição orçamentária como fundamento para negar progressão funcional sem exigir demonstração de impacto concreto.",
      correction: "A restrição orçamentária genérica não é fundamento suficiente para negar ato vinculado. Exige-se demonstração de situação fiscal excepcional comprovada (STF, RE 592.111).",
    },
  },

  // ── PRESCRIÇÃO E PRAZO ────────────────────────────────────────────────────

  {
    id: "FP_PRAZO_APELACAO_FAZENDA_INCORRETO",
    description: "Prazo de apelação da Fazenda Pública citado como 15 dias (prazo comum) em vez de 30 dias",
    fatal: true,
    scoreImpact: 10,
    area: ["GERAL"],
    pattern: /\b15\s*dias?\b.*apela[cç][aã]o|apela[cç][aã]o.*\b15\s*dias?\b/i,
    example: {
      error: "Indicar prazo de apelação da Fazenda de 15 dias.",
      correction: "A Fazenda Pública tem prazo em QUÁDRUPLO para contestar e EM DOBRO para recorrer — art. 183 CPC: prazo de 30 dias para apelação.",
    },
  },

  {
    id: "FP_REMESSA_NECESSARIA_OMITIDA",
    description: "Sentença contra a Fazenda Pública sem mencionar a remessa necessária (art. 496 CPC)",
    fatal: false,
    scoreImpact: 8,
    area: ["GERAL"],
    example: {
      error: "Sentença procedente contra município sem mencionar o reexame necessário.",
      correction: "Sentenças contra a Fazenda Pública sujeitam-se à remessa necessária (art. 496 CPC), salvo as exceções do §3º. Incluir: 'Sujeita-se ao reexame necessário, nos termos do art. 496 do CPC.'",
    },
  },

  // ── LEGITIMIDADE E COMPETÊNCIA ────────────────────────────────────────────

  {
    id: "FP_LEGITIMIDADE_PASSIVA_ENTE_ERRADO",
    description: "Ação de saúde ajuizada exclusivamente contra um ente, ignorando a solidariedade constitucional",
    fatal: false,
    scoreImpact: 7,
    area: ["SAUDE", "GERAL"],
    example: {
      error: "Ajuizar ação apenas contra o Município, sem incluir Estado e União, em demanda de medicamento de alto custo.",
      correction: "Pelo Tema STF 793, os três entes são SOLIDARIAMENTE responsáveis. Embora seja possível acionar apenas um (solidariedade passiva), é estrategicamente recomendado incluir todos para garantir o cumprimento.",
    },
  },

  {
    id: "FP_COMPETENCIA_JEF_VS_ESTADUAL",
    description: "Confusão entre competência federal (JEF) e estadual em demandas de saúde",
    fatal: true,
    scoreImpact: 10,
    area: ["SAUDE", "GERAL"],
    example: {
      error: "Ajuizar ação de fornecimento de medicamento contra a União na Justiça Estadual.",
      correction: "Ações contra a União são de competência da Justiça Federal (art. 109, I, CF/88). Ações só contra Estado ou Município são da Justiça Estadual. Se houver litisconsórcio com a União, atrai a competência federal.",
    },
  },

  // ── TUTELA DE URGÊNCIA ────────────────────────────────────────────────────

  {
    id: "FP_TUTELA_SUSPENSAO_LIMINAR_LEI9494",
    description: "Tutela de urgência em face da Fazenda sem considerar a possibilidade de suspensão (Lei 9.494/97)",
    fatal: false,
    scoreImpact: 5,
    area: ["GERAL"],
    example: {
      error: "Requerer tutela para pagamento imediato de verbas a servidor sem mencionar o art. 1º da Lei 9.494/97.",
      correction: "A tutela antecipada em face da Fazenda Pública pode ser suspensa quando há impacto em despesas orçamentárias (Lei 9.494/97). Contornar o argumento: demonstrar que se trata de mínimo existencial (saúde/vida) ou direito constitucional inalienável.",
    },
  },

  // ── HONORÁRIOS ────────────────────────────────────────────────────────────

  {
    id: "FP_HONORARIOS_ADVOCATICIOS_AUSENTES",
    description: "Sentença contra Fazenda Pública sem fixar honorários advocatícios (art. 85 CPC)",
    fatal: false,
    scoreImpact: 5,
    area: ["GERAL"],
    example: {
      error: "Sentença procedente contra Município em ação de saúde sem condenar em honorários.",
      correction: "Art. 85 CPC: a parte vencida (inclusive a Fazenda) deve ser condenada em honorários advocatícios. Exceção: beneficiário da gratuidade (art. 98 §3º CPC).",
    },
  },
];

// ── PublicLawValidator ────────────────────────────────────────────────────────

export class PublicLawValidator {
  /**
   * Valida uma peça de Fazenda Pública contra as regras do catálogo.
   * Retorna erros determinísticos (baseados em padrões) + avisos heurísticos.
   *
   * Uso futuro (após integração):
   *   const result = new PublicLawValidator().validate(draft, "SENTENCA", "SAUDE");
   */
  validate(draft: string, tipoPeca: string, area: PublicLawArea): ValidationResult {
    const errors: ValidationError[] = [];
    const lowerDraft = draft.toLowerCase();

    for (const rule of PUBLIC_LAW_RULES) {
      if (!rule.area.includes(area) && !rule.area.includes("GERAL")) continue;

      // Detecção por padrão regexp (onde disponível)
      if (rule.pattern && rule.pattern.test(lowerDraft)) {
        errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        continue;
      }

      // Verificações heurísticas específicas
      if (rule.id === "FP_SAUDE_SOLIDARIEDADE_FALTANDO") {
        const mentionsSaude = /art\.\s*196\s*cf|lei\s+8\.080/i.test(draft);
        const mentionsSolidariedade = /solidari|tema\s+793|re\s+855\.178|entes\s+federati/i.test(draft);
        if (mentionsSaude && !mentionsSolidariedade && tipoPeca === "SENTENCA") {
          errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        }
      }

      if (rule.id === "FP_SAUDE_RESERVA_POSSIVEL_SEM_MINIMO_EXISTENCIAL") {
        const mentionsReserva = /reserva\s+do\s+poss[ií]vel/i.test(draft);
        const mentionsMinimoExist = /m[ií]nimo\s+existencial|dignidade\s+da\s+pessoa/i.test(draft);
        if (mentionsReserva && !mentionsMinimoExist) {
          errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        }
      }

      if (rule.id === "FP_CONCURSO_TEMA784_FALTANDO") {
        const mentionsConcurso = /concurso\s+p[uú]blico|nomea[cç][aã]o|vaga/i.test(draft);
        const mentionsTema784 = /tema\s+784|re\s+837\.(311|31)|direito\s+subjetivo.*nomea/i.test(draft);
        if (mentionsConcurso && !mentionsTema784 && tipoPeca === "SENTENCA") {
          errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        }
      }

      if (rule.id === "FP_SERVIDOR_PRESCRICAO_QUINQUENAL_IGNORADA") {
        const mentionsVerba = /adicional|gratifica[cç][aã]o|salário|vencimento/i.test(draft);
        const mentionsPrescricao = /dl\s+4\.597|prescri[cç][aã]o\s+quinquenal|s[uú]mula\s+85/i.test(draft);
        const mentionsLongPeriod = /\b[6-9]\s+anos?\b|\b1[0-9]\s+anos?\b/i.test(draft);
        if (mentionsVerba && !mentionsPrescricao && mentionsLongPeriod && tipoPeca !== "RECURSO") {
          errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        }
      }

      if (rule.id === "FP_REMESSA_NECESSARIA_OMITIDA") {
        const hasProcedente = /julgo\s+procedente|condeno\s+o\s+r[eé]u/i.test(draft);
        const mentionsRemessa = /remessa\s+necess[aá]ria|reexame\s+necess[aá]rio|art\.\s*496/i.test(draft);
        if (hasProcedente && !mentionsRemessa && tipoPeca === "SENTENCA") {
          errors.push({ rule: rule.id, message: rule.description, fatal: rule.fatal });
        }
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }

  /** Retorna o impacto total no score dado um conjunto de erros. */
  scoreImpact(errors: ValidationError[]): number {
    return errors.reduce((acc, e) => {
      const rule = PUBLIC_LAW_RULES.find((r) => r.id === e.rule);
      return acc + (rule?.scoreImpact ?? 3);
    }, 0);
  }
}

// ── Resumo da especificação ───────────────────────────────────────────────────
//
// REGRAS FATAIS (bloqueiam aprovação — score cai abaixo do limiar):
//   FP_SAUDE_RESERVA_POSSIVEL_SEM_MINIMO_EXISTENCIAL  (-15 pts)
//   FP_SAUDE_SEPARACAO_PODERES_ABSOLUTA               (-12 pts)
//   FP_CONCURSO_TEMA784_FALTANDO                      (-15 pts)
//   FP_CONCURSO_CADASTRO_RESERVA_DIREITO_SUBJETIVO    (-12 pts)
//   FP_SERVIDOR_PRESCRICAO_QUINQUENAL_IGNORADA        (-15 pts)
//   FP_PRAZO_APELACAO_FAZENDA_INCORRETO               (-10 pts)
//   FP_COMPETENCIA_JEF_VS_ESTADUAL                    (-10 pts)
//
// REGRAS NÃO-FATAIS (reduzem score mas não bloqueiam):
//   FP_SAUDE_SOLIDARIEDADE_FALTANDO        (-8 pts)
//   FP_SAUDE_MEDICAMENTO_SEM_LAUDO         (-6 pts)
//   FP_SAUDE_TUTELA_SEM_URGENCIA_MEDICA    (-7 pts)
//   FP_CONCURSO_PRAZO_VALIDADE_IGNORADO    (-8 pts)
//   FP_CONCURSO_EDITAL_SEM_VERIFICACAO     (-6 pts)
//   FP_SERVIDOR_PROGRESSAO_ATO_VINCULADO   (-8 pts)
//   FP_SERVIDOR_RESTRICAO_ORCAMENTARIA     (-6 pts)
//   FP_REMESSA_NECESSARIA_OMITIDA          (-8 pts)
//   FP_LEGITIMIDADE_PASSIVA_ENTE_ERRADO    (-7 pts)
//   FP_TUTELA_SUSPENSAO_LIMINAR_LEI9494    (-5 pts)
//   FP_HONORARIOS_ADVOCATICIOS_AUSENTES    (-5 pts)
//
// INTEGRAÇÃO (quando pronto):
//   1. Adicionar "PublicLawValidator" ao tipo ValidatorComponent em case-types.ts
//   2. Instanciar em pipeline/validator.ts condicionado a area === "FAZENDA_PUBLICA"
//   3. Adicionar mapRuleToValidator entries para regras FP_*
//   4. Ajustar limiares de score em final.validator.ts para área FP
