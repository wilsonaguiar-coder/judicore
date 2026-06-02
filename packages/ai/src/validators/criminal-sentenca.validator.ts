// CriminalSentenceValidator — regras específicas para sentenças criminais.
//
// Aciona quando:
//   tipo_peca === "SENTENCA" E
//   (tipo_justica === "CRIMINAL" OU regime_juridico === "CRIMINAL")
//
// Distingue três subcategorias:
//   - HC (habeas corpus): exige "concedo a ordem" ou "denego a ordem"
//   - Decisão incidental (liberdade provisória, revogação de preventiva, progressão):
//     exige DEFIRO / INDEFIRO / REVOGO / MANTENHO
//   - Ação penal (sentença de mérito): exige ABSOLVO ou CONDENO + dosimetria se condenatória

import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";

const HC_DISPOSITIVO_RE = /(concedo\s+(parcialmente\s+)?a?\s*ordem|denego\s+a?\s*ordem)/i;
const HC_WRONG_DISPOSITIVO_RE = /(julgo\s+(procedente|improcedente|parcialmente\s+procedente)|julgo\s+extinto|condeno\s+o\s+paciente|absolvo\s+o\s+paciente)/i;

// Dispositivos válidos em sentença penal de mérito:
//   CONDENO / ABSOLVO — ação penal de mérito (ambos os gêneros: "o réu" e "a ré")
//   DECLARO EXTINTA A PUNIBILIDADE — prescrição, decadência, etc. (art. 107 CP)
//   DESCLASSIFICO — reclassificação para tipo penal menos grave
const CRIMINAL_DISPOSITIVO_RE =
  /(absolvo|condeno)\s+[ao]s?\s+(r[eé][u]?s?|acusad[ao]s?|denunciad[ao]s?)|declaro\s+extinta?\s+a\s+punibilidade|desclassifico\s+(a\s+(?:conduta|infra[cç][aã]o)|o\s+crime|para\s+o)/i;

// Proibido em sentença penal: linguagem dispositiva civil
const CRIMINAL_WRONG_CIVIL_RE = /julgo\s+(procedente|improcedente|parcialmente\s+procedente)/i;

// Proibido em processo penal: art. 85 CPC ou honorários sucumbenciais
// (não existe sucumbência de honorários em ação penal — nem condenação, nem absolvição)
const HONORARIOS_PENAIS_RE =
  /art\.?\s*85\s*(do\s+)?cpc|art\.?\s*85\s*c[oó]digo\s+de\s+processo\s+civil|honor[aá]rios\s+sucumbenci[aá]is/i;
// Inclui agravo em execução (art. 197 LEP) — recurso correto para decisões de execução penal
const APELACAO_CRIMINAL_RE = /apela[cç][aã]o\s+criminal|art\.?\s*593\s+cpp|recurso\s+em\s+sentido\s+estrito|art\.?\s*581\s+cpp|agravo\s+em\s+execu[cç][aã]o|art\.?\s*197\s+(da\s+)?lep/i;
const APELACAO_CIVEL_RE = /apela[cç][aã]o\s+c[ií]vel|recurso\s+ordin[aá]rio\s+trabalhista|recurso\s+inominado/i;
const ABSOLVICAO_RE = /absolvo/i;
const CONDENACAO_RE = /condeno/i;
const PRESCRICAO_RE = /declaro\s+extinta?\s+a\s+punibilidade/i;
const DESCLASSIFICACAO_RE = /desclassifico/i;

// Prescrição deve citar art. 107 (extinção) e/ou art. 109 CP (prazos)
const PRESCRICAO_ART_RE = /art\.?\s*10[79]\s*(do\s+)?cp/i;
// Desclassificação deve indicar o novo tipo penal
const NOVO_TIPO_PENAL_RE = /art\.?\s*\d+[^\n]{0,60}c\.?\s*p\.|para\s+o\s+(crime\s+de|art\.?\s*\d+)|para\s+(furto|lesão|estelionato|uso\s+pessoal|receptação|porte)/i;

// Dosimetria em 3 fases — cada fase verificada separadamente para mensagem específica
const DOSIMETRIA_FASE1_RE = /(pena[\s-]*base|art\.\s*59\s*(do\s+)?cp|primeira\s+fase|1[ªa]\s+fase\b)/i;
const DOSIMETRIA_FASE2_RE = /(segunda\s+fase|2[ªa]\s+fase\b|atenuante|agravante|art\.\s*65\s*(do\s+)?cp|art\.\s*61\s*(do\s+)?cp)/i;
const DOSIMETRIA_FASE3_RE = /(terceira\s+fase|3[ªa]\s+fase\b|causa[s]?\s+de\s+(aumento|diminui[cç][aã]o)|art\.\s*68\s*(do\s+)?cp)/i;

// Regime inicial de cumprimento da pena (art. 33 CP)
const REGIME_CUMPRIMENTO_RE = /(regime\s+(inicial\s+)?(fechado|semiaberto|aberto)|art\.?\s*33\s*(do\s+)?cp|regime\s+de\s+cumprimento)/i;

// Inciso do art. 386 CPP em absolvição
const ART_386_RE = /art\.?\s*386\s*(do\s+)?cpp/i;

// HC detection — ampliado para cobrir mais indicadores
const HC_KEYWORDS_RE = /habeas\s+corpus|\bhc\b|paciente|impetrante|coator|constrangimento\s+ilegal|\bwrit\b/i;

// Decisões incidentais criminais: liberdade provisória, revogação de preventiva,
// progressão de regime — NÃO são ação penal; verbos corretos: DEFIRO/INDEFIRO/REVOGO/MANTENHO
const INCIDENTAL_KEYWORDS_RE = /liberdade\s+provis[oó]ria|progress[aã]o\s+(para\s+o\s+)?regime|execu[cç][aã]o\s+penal|revoga[cç][aã]o\s+(da\s+)?pris[aã]o|excesso\s+de\s+prazo/i;
const INCIDENTAL_DISPOSITIVO_RE = /\b(defiro|indefiro|concedo|denego|revogo|mantenho)\b/i;

export class CriminalSentenceValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    if (classification.tipo_peca !== "SENTENCA") return { valid: true, errors: [] };
    const isCriminal =
      classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL";
    if (!isCriminal) return { valid: true, errors: [] };

    const errors: ValidationError[] = [];
    const draftHead = draft.slice(0, 800);

    const isHC =
      HC_KEYWORDS_RE.test(classification.assunto_principal) ||
      HC_KEYWORDS_RE.test(draftHead);

    // Decisão incidental: liberdade provisória, revogação de preventiva, progressão de regime
    const isIncidental =
      !isHC && (
        INCIDENTAL_KEYWORDS_RE.test(classification.assunto_principal) ||
        INCIDENTAL_KEYWORDS_RE.test(draftHead)
      );

    if (isHC) {
      // ── HC (habeas corpus) ──────────────────────────────────────────────────
      if (!HC_DISPOSITIVO_RE.test(draft)) {
        errors.push({
          rule: "HC_MISSING_ORDER_VERB",
          message: 'Sentença em HC deve usar "concedo a ordem" ou "denego a ordem"',
          fatal: true,
        });
      }
      if (HC_WRONG_DISPOSITIVO_RE.test(draft)) {
        errors.push({
          rule: "HC_WRONG_DISPOSITIVO",
          message: 'HC NÃO usa "julgo procedente/improcedente" nem "condeno/absolvo o paciente" — use "concedo/denego a ordem"',
          fatal: true,
        });
      }
    } else if (isIncidental) {
      // ── Decisão incidental criminal ─────────────────────────────────────────
      // Verbos corretos: DEFIRO, INDEFIRO, REVOGO, MANTENHO, CONCEDO, DENEGO
      if (!INCIDENTAL_DISPOSITIVO_RE.test(draft) && !CRIMINAL_DISPOSITIVO_RE.test(draft)) {
        errors.push({
          rule: "CRIMINAL_MISSING_DISPOSITIVO",
          message: "Decisão criminal incidental deve conter verbo dispositivo adequado: DEFIRO, INDEFIRO, REVOGO, MANTENHO, CONCEDO ou DENEGO",
          fatal: true,
        });
      }
    } else {
      // ── Sentença criminal (ação penal de mérito) ────────────────────────────
      // Dispositivos válidos: ABSOLVO, CONDENO, DECLARO EXTINTA A PUNIBILIDADE, DESCLASSIFICO
      if (!CRIMINAL_DISPOSITIVO_RE.test(draft)) {
        errors.push({
          rule: "CRIMINAL_MISSING_DISPOSITIVO",
          message:
            'Sentença penal de mérito deve conter dispositivo criminal: ' +
            '"CONDENO o réu", "ABSOLVO o réu", "DECLARO EXTINTA A PUNIBILIDADE" ou "DESCLASSIFICO"',
          fatal: true,
        });
      }

      // "julgo procedente/improcedente" é linguagem cível — proibida em ação penal
      // Não dispara quando há verbo penal correto (CONDENO/ABSOLVO/DESCLASSIFICO/DECLARO EXTINTA)
      if (
        CRIMINAL_WRONG_CIVIL_RE.test(draft) &&
        !ABSOLVICAO_RE.test(draft) &&
        !CONDENACAO_RE.test(draft) &&
        !PRESCRICAO_RE.test(draft) &&
        !DESCLASSIFICACAO_RE.test(draft)
      ) {
        errors.push({
          rule: "CRIMINAL_WRONG_CIVIL_VERB",
          message: 'Sentença penal NÃO usa "julgo procedente/improcedente" — use CONDENO, ABSOLVO, DECLARO EXTINTA A PUNIBILIDADE ou DESCLASSIFICO',
          fatal: true,
        });
      }

      // Absolvição: deve citar o inciso do art. 386 CPP
      if (ABSOLVICAO_RE.test(draft) && !ART_386_RE.test(draft)) {
        errors.push({
          rule: "CRIMINAL_ABSOLVICAO_MISSING_ART386",
          message: "Sentença absolutória deve indicar o inciso específico do art. 386 CPP (ex: art. 386, VII, CPP — insuficiência de provas)",
          fatal: false,
        });
      }

      // Prescrição: DECLARO EXTINTA A PUNIBILIDADE deve citar art. 107 e/ou art. 109 CP
      if (PRESCRICAO_RE.test(draft) && !PRESCRICAO_ART_RE.test(draft)) {
        errors.push({
          rule: "CRIMINAL_PRESCRICAO_MISSING_ART",
          message: "Extinção da punibilidade por prescrição deve citar art. 107, IV c/c art. 109 CP (prazo prescricional aplicável)",
          fatal: false,
        });
      }

      // Desclassificação: DESCLASSIFICO deve indicar o novo tipo penal
      if (DESCLASSIFICACAO_RE.test(draft) && !NOVO_TIPO_PENAL_RE.test(draft)) {
        errors.push({
          rule: "CRIMINAL_DESCLASSIFICACAO_MISSING_TIPO",
          message: "Desclassificação deve indicar o novo tipo penal (ex: DESCLASSIFICO para o art. 155, caput, CP — furto simples)",
          fatal: false,
        });
      }

      // Condenatória: dosimetria completa (3 fases) + regime de cumprimento
      if (CONDENACAO_RE.test(draft)) {
        const fasesFaltantes: string[] = [];
        if (!DOSIMETRIA_FASE1_RE.test(draft)) fasesFaltantes.push("1ª fase — pena-base (art. 59 CP)");
        if (!DOSIMETRIA_FASE2_RE.test(draft)) fasesFaltantes.push("2ª fase — atenuantes/agravantes (arts. 61/65 CP)");
        if (!DOSIMETRIA_FASE3_RE.test(draft)) fasesFaltantes.push("3ª fase — causas de aumento/diminuição (art. 68 CP)");
        if (fasesFaltantes.length > 0) {
          errors.push({
            rule: "CRIMINAL_MISSING_DOSIMETRIA",
            message: `Dosimetria incompleta — ${fasesFaltantes.length === 3 ? "nenhuma fase encontrada" : "fases ausentes: " + fasesFaltantes.join("; ")}. Sentença condenatória exige dosimetria em 3 fases (art. 68 CP).`,
            fatal: false,
          });
        }
        if (!REGIME_CUMPRIMENTO_RE.test(draft)) {
          errors.push({
            rule: "CRIMINAL_MISSING_REGIME",
            message: "Sentença condenatória deve fixar o regime inicial de cumprimento da pena (art. 33 CP — fechado, semiaberto ou aberto)",
            fatal: false,
          });
        }
      }
    }

    // Honorários sucumbenciais e art. 85 CPC — proibidos em qualquer sentença penal
    // (não existe condenação em honorários de sucumbência em processo criminal)
    if (HONORARIOS_PENAIS_RE.test(draft)) {
      errors.push({
        rule: "CRIMINAL_ARTICLE_85_CPC",
        message:
          "Processo penal não admite honorários sucumbenciais (art. 85 CPC não se aplica) — " +
          "remova qualquer referência a honorários de sucumbência ou art. 85 CPC",
        fatal: true,
      });
    }

    // Recurso cabível — apelação criminal, RSE ou agravo em execução (LEP)
    if (APELACAO_CIVEL_RE.test(draft)) {
      errors.push({
        rule: "CRIMINAL_WRONG_APPEAL",
        message: 'Sentença criminal usa Apelação Criminal (art. 593 CPP) ou RSE (art. 581 CPP) — não "apelação cível" nem recurso trabalhista',
        fatal: true,
      });
    }
    if (!isHC && !APELACAO_CRIMINAL_RE.test(draft)) {
      errors.push({
        rule: "CRIMINAL_MISSING_APPEAL_REF",
        message: "Sentença criminal deve indicar recurso cabível (Apelação Criminal — art. 593 CPP, ou Agravo em Execução — art. 197 LEP)",
        fatal: false,
      });
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }
}
