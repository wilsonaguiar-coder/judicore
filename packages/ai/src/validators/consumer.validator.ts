// ConsumerValidator — regras específicas de Direito do Consumidor (CDC).
//
// Roda quando o draft menciona relação de consumo ou CDC explicitamente.
//
// Regras verificadas:
//   1. Sentença consumerista: deve justificar aplicação do CDC (Lei 8.078/90)
//   2. Inversão do ônus da prova: deve citar art. 6º, VIII, CDC
//   3. Dano moral: não deve ser concedido como presumido sem análise do caso concreto
//   4. Repetição em dobro: exige cobrança indevida + má-fé (art. 42 parágrafo único CDC)

import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";

const CDC_CONTEXT_RE = /c\.?\s*d\.?\s*c\.|lei\s+8\.078|código\s+de\s+defesa\s+do\s+consumidor|rela[cç][aã]o\s+de\s+consumo|consumidor\s+(vulnerável|hipossuficiente)/i;
const CDC_JUSTIFICATION_RE = /rela[cç][aã]o\s+de\s+consumo|lei\s+8\.078|art\.?\s*\d+[^.]{0,30}cdc|aplicac[aã]o\s+(do\s+)?cdc|incid[eê]ncia\s+(do\s+)?cdc/i;
const INVERSAO_ONUS_RE = /invers[aã]o\s+(do\s+)?[oô]nus\s+da\s+prova|[oô]nus\s+da\s+prova.*inver/i;
const ART6_VIII_RE = /art\.?\s*6[°º,.]\s*(inc\.?\s*|inciso\s*)?viii|art\.?\s*6[°º,.]\s*8\b/i;
const VEROSSIMILHANCA_RE = /verossimilhan[cç]a|hipossufici[eê]ncia|vulnerabilidade|dificuldade\s+(do\s+)?consumidor\s+de\s+obter\s+prova/i;

const DANO_MORAL_RE = /dano\s+moral/i;
const DANO_MORAL_CONCEDIDO_RE = /condeno.*dano\s+moral|dano\s+moral.*procedente|fixo.*indeniza[cç][aã]o.*moral|indeniza[cç][aã]o\s+por\s+dano\s+moral/i;
const DANO_PRESUMIDO_RE = /in\s+re\s+ipsa|dano\s+presumido|presume[\s-]se\s+o\s+dano|dano\s+autom[aá]tico/i;
const ANALISE_CONCRETA_RE = /caso\s+concreto|circunst[aâ]ncias\s+do\s+caso|an[aá]lise.*caso|gravidade\s+(do\s+)?ato|extensão\s+do\s+dano|proporcionalidade/i;

const REPETICAO_DOBRO_RE = /repeti[cç][aã]o\s+em\s+dobro|cobrado\s+em\s+dobro|devolu[cç][aã]o\s+em\s+dobro|art\.?\s*42\s*(do\s+)?cdc/i;
const MAE_FE_RE = /m[aá][\s-]f[eé]|cobran[cç]a\s+indevida|sem\s+justa\s+causa|abusiv[ao]\s+(cobran[cç]a|pr[aá]tica)|enriquecimento\s+ilícito/i;

export class ConsumerValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    // Roda apenas quando há contexto consumerista
    const hasCDCContext =
      CDC_CONTEXT_RE.test(draft) ||
      /consumidor/i.test(classification.assunto_principal);

    if (!hasCDCContext) return { valid: true, errors: [] };

    const errors: ValidationError[] = [];

    // ── 1. Sentença consumerista: justificativa da aplicação do CDC ───────────
    if (classification.tipo_peca === "SENTENCA" && !CDC_JUSTIFICATION_RE.test(draft)) {
      errors.push({
        rule: "CDC_APPLICATION_MISSING",
        message: "Sentença consumerista deve identificar a relação de consumo e justificar a aplicação do CDC (Lei 8.078/90) ao caso concreto",
        fatal: false,
      });
    }

    // ── 2. Inversão do ônus da prova: exige art. 6º VIII CDC + fundamentação ─
    if (INVERSAO_ONUS_RE.test(draft)) {
      if (!ART6_VIII_RE.test(draft)) {
        errors.push({
          rule: "INVERSAO_ONUS_SEM_FUNDAMENTO",
          message: "Inversão do ônus da prova no CDC deve ser fundamentada no art. 6º, VIII, do CDC, com demonstração da verossimilhança das alegações ou hipossuficiência do consumidor",
          fatal: false,
        });
      } else if (!VEROSSIMILHANCA_RE.test(draft)) {
        errors.push({
          rule: "INVERSAO_ONUS_SEM_FUNDAMENTO",
          message: "Inversão do ônus da prova (art. 6º, VIII, CDC) exige demonstração da verossimilhança das alegações OU hipossuficiência/vulnerabilidade do consumidor — não pode ser automática",
          fatal: false,
        });
      }
    }

    // ── 3. Dano moral: não deve ser concedido como meramente presumido ────────
    if (DANO_MORAL_CONCEDIDO_RE.test(draft) && DANO_PRESUMIDO_RE.test(draft)) {
      if (!ANALISE_CONCRETA_RE.test(draft)) {
        errors.push({
          rule: "DANO_MORAL_SEM_ANALISE_CONCRETA",
          message: "Dano moral não pode ser concedido como mero presumido (in re ipsa) sem análise das circunstâncias do caso concreto — gravidade, extensão e proporcionalidade devem ser examinados",
          fatal: false,
        });
      }
    }

    // ── 4. Repetição em dobro: exige cobrança indevida + má-fé ───────────────
    if (REPETICAO_DOBRO_RE.test(draft) && !MAE_FE_RE.test(draft)) {
      errors.push({
        rule: "REPETICAO_DOBRO_SEM_MAE_FE",
        message: "Repetição em dobro (art. 42, parágrafo único, CDC) exige demonstração de cobrança indevida E má-fé do fornecedor — ambos os elementos devem estar presentes",
        fatal: false,
      });
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }
}
