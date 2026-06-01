import type { JurisprudenciaInput, LegalClassification, ValidationError } from "../pipeline/types.js";

export class JurisprudenceValidator {
  validateDraftJurisprudence(
    draft: string,
    jurisprudencias: JurisprudenciaInput[],
    classification: LegalClassification,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Bloquear [JUR-N] no texto final
    if (/\[JUR-\d+\]/i.test(draft)) {
      errors.push({
        rule: "JUR_MARKER_IN_DRAFT",
        message: 'Marcadores "[JUR-N]" encontrados no texto final — substituir pelos dados reais da decisão',
        fatal: true,
      });
    }

    // Bloquear menção de decisão sem dados identificadores
    const genericJurPatterns = [
      /decisão do\s+(stj|stf|tst|trf|tjsp)\s+que\s+(entende|decidiu|pacificou)/gi,
      /segundo\s+jurisprud[eê]ncia\s+(dominante|pac[íi]fica)\s+do\s+\w+/gi,
    ];
    for (const pattern of genericJurPatterns) {
      if (pattern.test(draft)) {
        errors.push({
          rule: "GENERIC_JURISPRUDENCE",
          message: "Referência genérica a jurisprudência sem número de processo, tribunal e relator",
          fatal: false,
        });
        break;
      }
    }

    // Verificar tribunal incompatível com a jurisdição
    const validTribunals = getValidTribunals(classification.tipo_justica);
    for (const jur of jurisprudencias) {
      const isCompatible = validTribunals.some((t) =>
        jur.tribunal.toUpperCase().includes(t)
      );
      if (!isCompatible) {
        // Só avisa, não bloqueia — a IA pode citar por analogia
        errors.push({
          rule: "TRIBUNAL_MISMATCH",
          message: `Jurisprudência de ${jur.tribunal} pode ser incompatível com ${classification.tipo_justica}`,
          fatal: false,
        });
      }
    }

    return errors;
  }

  validateJurisprudenciaRelevance(
    jurTema: string,
    classificationAssunto: string,
  ): boolean {
    const tema = jurTema.toLowerCase();
    const assunto = classificationAssunto.toLowerCase();
    const keywords = assunto.split(/\s+/).filter((w) => w.length > 4);
    return keywords.some((kw) => tema.includes(kw));
  }
}

function getValidTribunals(tipoJustica: string): string[] {
  const map: Record<string, string[]> = {
    TRABALHO: ["TRT", "TST"],
    FEDERAL: ["TRF", "STJ", "STF"],
    ESTADUAL: ["TJSP", "TJRJ", "TJMG", "TJRS", "TJBA", "TJCE", "TJ", "STJ", "STF"],
    JEF: ["TRF", "TNU", "STJ", "STF"],
    JEC: ["TJ", "STJ"],
    CRIMINAL: ["TJSP", "TJ", "TRF", "STJ", "STF"],
    EXECUCAO_FISCAL: ["TRF", "TJ", "STJ", "STF"],
    INDETERMINADA: ["TRT", "TRF", "TJ", "STJ", "STF", "TST"],
  };
  return map[tipoJustica] ?? [];
}
