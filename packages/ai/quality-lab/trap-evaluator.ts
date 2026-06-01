// Avaliação tripartite do resultado de cada armadilha (trap):
//
//   DETECTED  — algum validator emitiu a regra esperada (ideal)
//   AVOIDED   — a regra esperada não foi emitida E o draft não contém
//               o padrão ruim (a IA dodgeou a armadilha)
//   MISSED    — o draft contém o padrão ruim E o validator não detectou
//               (problema real do sistema)
//
// Critério de MISSED para traps determinísticas: verificação direta de
// padrão no draft (ex: art. 201 CF em RPPS, art. 85 CPC em criminal).
//
// Critério de MISSED para traps subjetivas: combinação de score baixo,
// modo degradado e análise de padrões no texto do audit/draft.

import type { CaseResult, TrapKind } from "./case-types.js";

export type TrapOutcome = "DETECTED" | "AVOIDED" | "MISSED";

export function evaluateTrap(trap: TrapKind, result: CaseResult): TrapOutcome {
  const rules = result.validationErrors.map((e) => e.rule);
  const draft = result.draft ?? "";
  const score = result.score ?? 100;
  const mode = result.mode;
  const auditText = result.auditErrors.join(" ").toLowerCase();

  const hasRule = (...names: string[]): boolean => names.some((n) => rules.includes(n));

  switch (trap) {
    case "JURISPRUDENCIA_CONTRARIA": {
      // DETECTED: validator de postura probatória disparou
      if (hasRule("EVIDENCE_STANCE_VIOLATION", "EVIDENCE_STANCE_MATRIX")) return "DETECTED";

      // MISSED: jurisprudência contrária conhecida citada sem distinguishing ou negação
      // Refs de jurs contrárias injetadas nos templates
      const contraJurIds = /\b(RE[\s.]?590[\s.]?260|HC[\s.]?84[\s.]?078|paridade.*(?:após|pos).*ec\s*41|ec\s*41.*paridade)\b/i;
      // Linguagem que nega ou distingue a jur (uso correto)
      const distinguishingOrRejection = /\b(distinguishing|não\s+(?:se\s+)?aplic|inaplicáv|afastar?|sem\s+direito|não\s+tem\s+direito|improcedente|não\s+merece\s+acolhida|indevid)\b/i;

      if (contraJurIds.test(draft) && !distinguishingOrRejection.test(draft)) return "MISSED";

      // MISSED secundário: score degradado indica jur mal aplicada (< 78)
      if (score < 78) return "MISSED";

      return "AVOIDED";
    }

    case "ARTIGO_INCOMPATIVEL": {
      // DETECTED: validator emitiu regra de artigo incompatível
      if (
        hasRule(
          "RPPS_WRONG_ARTICLE",
          "RGPS_WRONG_ARTICLE",
          "WRONG_HONORARIOS_CRIMINAL",
          "WRONG_HONORARIOS",
          "CRIMINAL_ARTICLE_85_CPC",
        )
      ) return "DETECTED";

      // MISSED: padrões diretos no draft
      if (result.area === "RPPS" && /art\.?\s*201\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if (result.area === "RGPS" && /art\.?\s*40\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if (result.area === "CRIMINAL" && /art\.?\s*85\s*(do\s+)?cpc/i.test(draft)) return "MISSED";
      // Trabalhista com art. 85 CPC em vez de art. 791-A CLT
      if (
        result.area === "TRABALHISTA" &&
        /art\.?\s*85\s*(do\s+)?cpc/i.test(draft) &&
        !/art\.?\s*791[-\s]?[aA]/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "RECURSO_INADEQUADO": {
      // DETECTED: validator emitiu regra de recurso incompatível
      if (hasRule("INCOMPATIBLE_APPEAL", "JEF_JEC_WRONG_APPEAL", "CRIMINAL_WRONG_APPEAL")) return "DETECTED";

      // MISSED: padrões por área
      // Trabalhista: usa apelação em vez de Recurso Ordinário
      if (result.area === "TRABALHISTA" && /\bapela[cç][aã]o\b/i.test(draft) && !/recurso\s+ordin[aá]rio/i.test(draft)) return "MISSED";
      // Criminal: usa apelação cível em vez de apelação criminal
      if (result.area === "CRIMINAL" && /apela[cç][aã]o\s+c[ií]vel/i.test(draft)) return "MISSED";
      // Previdenciário: usa recurso trabalhista
      if (
        (result.area === "RPPS" || result.area === "RGPS") &&
        /recurso\s+ordin[aá]rio\s+trabalhista|recurso\s+de\s+revista|art\.?\s*895\s+(da\s+)?clt/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "COMPETENCIA_INCORRETA": {
      // DETECTED: validator emitiu regra de tribunal errado
      if (hasRule("WRONG_SUPERIOR_COURT")) return "DETECTED";

      // MISSED: tribunal incompetente citado em cada área
      // Trabalhista → STJ não é competente (é TST)
      if (result.area === "TRABALHISTA" && /\b(stj|superior\s+tribunal\s+de\s+justi[cç]a)\b/i.test(draft)) return "MISSED";
      // Criminal → TST não tem competência
      if (result.area === "CRIMINAL" && /\b(tst|tribunal\s+superior\s+do\s+trabalho)\b/i.test(draft)) return "MISSED";
      // Previdenciário → TST não tem competência
      if (
        (result.area === "RPPS" || result.area === "RGPS") &&
        /\b(tst|tribunal\s+superior\s+do\s+trabalho)\b/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "LINGUAGEM_DECISORIA": {
      // DETECTED: validator de estrutura disparou
      if (hasRule("DESPACHO_WITH_DECISION_LANGUAGE")) return "DETECTED";

      // MISSED: despacho com verbo decisório
      if (result.documentType === "DESPACHO" && /\b(defiro|indefiro|julgo|rejeito|acolho|concedo|denego)\b/i.test(draft)) {
        return "MISSED";
      }

      return "AVOIDED";
    }

    case "FATO_INCOMPLETO": {
      // DETECTED: sinais de degradação de modo ou qualidade
      if (mode === "SAFE_SKELETON" || mode === "TEMPLATE_MODEL") return "DETECTED";
      if (score < 70) return "DETECTED";
      if (/fato|prova|insuficient|incomplet|lacuna|omiss/i.test(auditText)) return "DETECTED";

      // MISSED para SENTENCA: relatório muito curto indica omissão fática
      if (result.documentType === "SENTENCA") {
        const relatorioIdx = draft.search(/relat[oó]rio/i);
        const fundIdx = draft.search(/fundamenta[cç][aã]o/i);
        if (relatorioIdx >= 0 && fundIdx > relatorioIdx) {
          const relatorio = draft.slice(relatorioIdx, fundIdx);
          if (relatorio.length < 400) return "MISSED";
        }
        // Draft total muito curto para uma sentença completa
        if (draft.length < 1500) return "MISSED";
      }

      return "AVOIDED";
    }

    case "TESE_EQUIVOCADA": {
      // Limiar ajustado de 75 → 78 para maior sensibilidade
      if (score < 78) return "DETECTED";
      if (/tese|fundament|equivoc|incorret|discut|dubios|controv|inconsist|equivocad/i.test(auditText)) return "DETECTED";
      return "AVOIDED";
    }

    case "PRECEDENTE_SUPERADO": {
      // DETECTED: audit menciona superação
      if (/superad|revoga|cancelad|atualiz|superven|entendimento\s+anterior/i.test(auditText)) return "DETECTED";
      if (score < 72) return "DETECTED";

      // MISSED: precedente superado citado no draft sem nota de superação
      const superadoRefs = /\b(HC[\s.]?84[\s.]?078|S[úu]mula\s+V[ée]ncer|HC[\s.]?152[\s.]?752)\b/i;
      const superadoNote = /\b(superad|revogad|cancelad|não\s+mais\s+prevalece|entendimento\s+anterior|posterior)\b/i;
      if (superadoRefs.test(draft) && !superadoNote.test(draft)) return "MISSED";

      // Verificação específica do HC 84.078 (execução provisória da pena)
      if (/HC\s*84[\s.]?078/i.test(draft) && !/superad|revoga|cancelad|atualiz/i.test(draft)) return "MISSED";

      return "AVOIDED";
    }
  }
}
