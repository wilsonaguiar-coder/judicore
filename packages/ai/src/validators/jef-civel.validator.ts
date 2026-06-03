// JefCivelValidator — validações específicas para o Juizado Especial Cível (Lei 9.099/95).
//
// Ativado automaticamente quando o draft ou classificação contém contexto de JEF.
//
// Regras fatais (3):   incompetência, valor excedente, recurso errado
// Regras não-fatais (3): perícia complexa, tutela sem fumus, tutela sem periculum

import type { ValidationError, LegalClassification } from "../pipeline/types.js";

// ── Detector de contexto JEF ──────────────────────────────────────────────────

const JEF_CONTEXT_RE =
  /\b(juizado\s+especial\s+c[íi]vel|juizado\s+especial\b|jec\b|lei\s+(?:n[°º\.]\s*)?9\.099|rito\s+sumar[íi]ssimo|recurso\s+inominado|art\.\s*41\s+(?:da\s+)?lei\s+9\.099|competência\s+do\s+juizado)\b/i;

// ── Regras fatais ─────────────────────────────────────────────────────────────

const FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string) => boolean;
}> = [
  {
    rule: "JEF_COMPETENCIA",
    description:
      "Causa aparentemente incompatível com o Juizado Especial Cível — matérias excluídas da competência do JEF " +
      "(art. 3º §2º Lei 9.099/95): imóvel, estado das pessoas, falência, acidente de trabalho, " +
      "mandado de segurança, insolvência e causas de natureza fiscal.",
    detect: (draft) => {
      // Verificar se há contexto JEF explícito
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      // Matérias excluídas do JEF (art. 3º §2º Lei 9.099/95)
      const materiaExcluida =
        /\b(im[oó]vel\s+(?:r[úu]stico|urbano)|usucapi[aã]o|divórcio|separa[cç][aã]o\s+judicial|invent[aá]rio|fal[eê]ncia|insolvência|acidente\s+de\s+trabalho|mandado\s+de\s+seguran[cç]a|a[cç][aã]o\s+popular|a[cç][aã]o\s+civil\s+p[úu]blica|execu[cç][aã]o\s+fiscal)\b/i.test(draft);
      if (!materiaExcluida) return false;
      // Só dispara se a peça não reconhece a incompetência
      const reconheceIncompetencia =
        /incompet[eê]ncia|declino\s+da\s+competência|incompetente|remetam-se\s+os\s+autos|remessa\s+(?:dos\s+autos\s+)?(?:ao|para)\s+(?:a\s+)?vara/i.test(draft);
      return !reconheceIncompetencia;
    },
  },
  {
    rule: "JEF_VALOR_EXCEDENTE",
    description:
      "Valor da causa excede o limite de 40 salários mínimos do JEF (art. 3º, caput, Lei 9.099/95) " +
      "sem que conste renúncia expressa ao excedente — ausência de renúncia invalida a competência.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      // Detectar valores altos em R$ (acima de ~R$ 48.000 = 40 SM × R$ 1.200)
      const temValorAlto = /r\$\s*(?:\d{1,3}\.)*(?:[5-9]\d{4}|\d{6,})/i.test(draft) ||
        /\b(?:4[1-9]|[5-9]\d|\d{3,})\s+sal[aá]rios?\s+m[íi]nimos?\b/i.test(draft) ||
        /acima\s+de\s+40\s+sal[aá]rios?\s+m[íi]nimos?/i.test(draft);
      if (!temValorAlto) return false;
      // Verificar se há renúncia ao excedente
      const temRenuncia =
        /renunci[ao]\s+ao\s+excedente|renúncia\s+ao\s+valor\s+excedente|renuncia\s+ao\s+que\s+exceder|renuncia\s+expressamente\s+ao\s+excedente/i.test(draft);
      return !temRenuncia;
    },
  },
  {
    rule: "JEF_RECURSO_ERRADO",
    description:
      "Recurso de apelação utilizado em sede de Juizado Especial Cível — o recurso cabível é o " +
      "recurso inominado (art. 41 Lei 9.099/95), não a apelação (art. 1.009 CPC).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temApelacao = /\bapela[cç][aã]o\b/i.test(draft) &&
        !/recurso\s+inominado/i.test(draft);
      // Só dispara em peças que realmente interpõem o recurso errado
      const eRecurso = /apelante|razões\s+de\s+apela[cç][aã]o|interpõe\s+(?:a\s+presente\s+)?apela[cç][aã]o|recorre\s+por\s+meio\s+de\s+apela[cç][aã]o/i.test(draft);
      return temApelacao && eRecurso;
    },
  },
];

// ── Regras não-fatais ─────────────────────────────────────────────────────────

const NON_FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string) => boolean;
}> = [
  {
    rule: "JEF_PERICIA_COMPLEXA",
    description:
      "Pedido ou deferimento de perícia técnica complexa em sede de Juizado Especial Cível — " +
      "o rito sumaríssimo da Lei 9.099/95 é incompatível com perícias demoradas (art. 35); " +
      "cause de alta complexidade probatória deve ser remetida à justiça comum.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temPericiaComplexa =
        /per[íi]cia\s+(m[eé]dica\s+(?:extensa|detalhada|aprofundada)|cont[aá]bil\s+(?:complex|detalhada?)|de\s+engenharia|de\s+avalia[cç][aã]o\s+de\s+im[oó]vel|grafotécnica|forense|multidisciplinar)/i.test(draft) ||
        /laudo\s+pericial\s+(?:m[eé]dico|cont[aá]bil|de\s+engenharia)/i.test(draft);
      if (!temPericiaComplexa) return false;
      // Não dispara se a peça já sinaliza possível incompetência por complexidade
      const reconheceComplexidade =
        /complexidade|incompetência|declino|supera\s+o\s+rito|incompatível\s+com\s+o\s+juizado/i.test(draft);
      return !reconheceComplexidade;
    },
  },
  {
    rule: "JEF_TUTELA_SEM_FUMUS",
    description:
      "Tutela de urgência concedida ou requerida sem análise da probabilidade do direito " +
      "(fumus boni iuris — art. 300 CPC c/c art. 4º Lei 9.099/95).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temTutela =
        /defiro\s+(?:a\s+)?(?:tutela|liminar)|concedo\s+(?:a\s+)?(?:tutela|liminar)|requer\s+tutela\s+de\s+urgência|pedido\s+de\s+tutela\s+de\s+urgência/i.test(draft);
      if (!temTutela) return false;
      const temFumus =
        /fumus\s+boni\s+iuris|probabilidade\s+do\s+direito|verossimilhan[cç]a\s+(?:das?\s+)?alegações?|art\.\s*300\s+(?:do\s+)?cpc/i.test(draft);
      return !temFumus;
    },
  },
  {
    rule: "JEF_TUTELA_SEM_PERICULUM",
    description:
      "Tutela de urgência concedida ou requerida sem demonstração de perigo de dano ou risco ao " +
      "resultado útil do processo (periculum in mora — art. 300 CPC c/c art. 4º Lei 9.099/95).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temTutela =
        /defiro\s+(?:a\s+)?(?:tutela|liminar)|concedo\s+(?:a\s+)?(?:tutela|liminar)|requer\s+tutela\s+de\s+urgência|pedido\s+de\s+tutela\s+de\s+urgência/i.test(draft);
      if (!temTutela) return false;
      const temPericulum =
        /periculum\s+in\s+mora|perigo\s+de\s+dano|risco\s+(?:ao|de)\s+(?:resultado\s+[úu]til|dano\s+irrepará)|urg[eê]ncia\s+(?:comprova|demonstra|evidente)|dano\s+irrepará|dano\s+de\s+difícil\s+repara[cç][aã]o/i.test(draft);
      return !temPericulum;
    },
  },
];

// ── JefCivelValidator ─────────────────────────────────────────────────────────

export class JefCivelValidator {
  validate(
    draft: string,
    classification: LegalClassification,
  ): { errors: ValidationError[] } {
    if (!this.isJefContext(draft, classification)) {
      return { errors: [] };
    }

    const errors: ValidationError[] = [];

    for (const rule of FATAL_RULES) {
      if (rule.detect(draft)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: true });
      }
    }

    for (const rule of NON_FATAL_RULES) {
      if (rule.detect(draft)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: false });
      }
    }

    return { errors };
  }

  private isJefContext(draft: string, classification: LegalClassification): boolean {
    return (
      JEF_CONTEXT_RE.test(classification.assunto_principal ?? "") ||
      JEF_CONTEXT_RE.test(draft)
    );
  }
}
