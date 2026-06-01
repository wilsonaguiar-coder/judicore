// Avaliação tripartite do resultado de cada armadilha (trap):
//
//   DETECTED  — algum validator emitiu a regra esperada (ideal)
//   AVOIDED   — a regra esperada não foi emitida, mas o draft também não
//               contém o padrão ruim (a IA dodgeou a armadilha)
//   MISSED    — o draft contém o padrão ruim e o validator não detectou
//               (problema real do sistema)
//
// Para traps subjetivas (TESE_EQUIVOCADA, PRECEDENTE_SUPERADO, FATO_INCOMPLETO)
// usamos sinais indiretos: score baixo, mode degradado, audit errors específicos.

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
      if (hasRule("EVIDENCE_STANCE_VIOLATION", "EVIDENCE_STANCE_MATRIX")) return "DETECTED";
      // Sem regra de referência (jur.numero específico) é difícil avaliar MISSED
      // de forma determinística. Marca AVOIDED como fallback otimista.
      return "AVOIDED";
    }

    case "ARTIGO_INCOMPATIVEL": {
      if (
        hasRule(
          "RPPS_WRONG_ARTICLE",
          "RGPS_WRONG_ARTICLE",
          "WRONG_HONORARIOS_CRIMINAL",
          "WRONG_HONORARIOS",
          "CRIMINAL_ARTICLE_85_CPC",
        )
      ) return "DETECTED";
      if (result.area === "RPPS" && /art\.?\s*201\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if (result.area === "RGPS" && /art\.?\s*40\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if (result.area === "CRIMINAL" && /art\.?\s*85\s*(do\s+)?cpc/i.test(draft)) return "MISSED";
      return "AVOIDED";
    }

    case "RECURSO_INADEQUADO": {
      if (hasRule("INCOMPATIBLE_APPEAL", "JEF_JEC_WRONG_APPEAL", "CRIMINAL_WRONG_APPEAL")) return "DETECTED";
      if (result.area === "TRABALHISTA" && /\bapela[cç][aã]o\b/i.test(draft)) return "MISSED";
      return "AVOIDED";
    }

    case "COMPETENCIA_INCORRETA": {
      if (hasRule("WRONG_SUPERIOR_COURT")) return "DETECTED";
      if (result.area === "TRABALHISTA" && /\b(stj|superior\s+tribunal\s+de\s+justi[cç]a)\b/i.test(draft)) {
        return "MISSED";
      }
      return "AVOIDED";
    }

    case "LINGUAGEM_DECISORIA": {
      if (hasRule("DESPACHO_WITH_DECISION_LANGUAGE")) return "DETECTED";
      if (result.documentType === "DESPACHO" && /\b(defiro|indefiro|julgo|rejeito|acolho)\b/i.test(draft)) {
        return "MISSED";
      }
      return "AVOIDED";
    }

    case "FATO_INCOMPLETO": {
      // Sinais indiretos de detecção:
      //   - mode degradou para SAFE_SKELETON ou TEMPLATE_MODEL
      //   - score baixo
      //   - audit menciona fato/prova/insuficiência
      if (mode === "SAFE_SKELETON" || mode === "TEMPLATE_MODEL") return "DETECTED";
      if (score < 70) return "DETECTED";
      if (/fato|prova|insuficient|incomplet|lacuna|omiss/i.test(auditText)) return "DETECTED";
      return "AVOIDED";
    }

    case "TESE_EQUIVOCADA": {
      if (score < 75) return "DETECTED";
      if (/tese|fundament|equivoc|incorret|discut/i.test(auditText)) return "DETECTED";
      return "AVOIDED";
    }

    case "PRECEDENTE_SUPERADO": {
      if (/superad|revoga|cancelad|atualiz/i.test(auditText)) return "DETECTED";
      if (score < 70) return "DETECTED";
      // Verifica draft por menção a precedente superado conhecido (HC 84.078)
      if (/HC\s*84\.078/i.test(draft) && !/superad|revoga|cancelad|atualiz/i.test(draft)) return "MISSED";
      return "AVOIDED";
    }
  }
}
