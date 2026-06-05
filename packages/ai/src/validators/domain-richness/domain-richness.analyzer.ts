import type { DomainProfile, DomainScoreDetail } from "./domain-richness.types.js";
import { isValidProfile, scoreDomainProfile } from "./richness-profiles.js";

// ── DomainRichnessAnalyzer ────────────────────────────────────────────────────
// Seleciona o perfil de riqueza baseado no domínio jurídico da peça e pontua
// cada dimensão específica do domínio (0-100 total).

export class DomainRichnessAnalyzer {
  analyze(
    draft: string,
    area?: string | null,
    regimeJuridico?: string | null,
    assuntoPrincipal?: string | null,
    tipoPeca?: string | null,
  ): DomainScoreDetail {
    const profile = this.selectProfile(area, regimeJuridico, assuntoPrincipal);
    const isSentenca = tipoPeca === "SENTENCA";
    const { dimensions, bannedExpressionsFound } = scoreDomainProfile(profile, draft, isSentenca);
    const total = Math.min(100, dimensions.reduce((s, d) => s + d.score, 0));

    // Score normalizado: desconta dimensão jur quando score=0, evitando penalização
    // por característica ausente em determinados ritos (execução, JEF, RPPS sem precedentes).
    const jurDim = dimensions.find((d) => d.key === "jurisprudencia");
    const missedJur = jurDim && jurDim.score === 0 ? jurDim.max : 0;
    const practicalMax = 100 - missedJur;
    const normalizedScore = missedJur > 0
      ? Math.min(100, Math.round((total / practicalMax) * 100))
      : total;

    return { profile, total, normalizedScore, dimensions, bannedExpressionsFound };
  }

  private selectProfile(
    area?: string | null,
    regimeJuridico?: string | null,
    assunto?: string | null,
  ): DomainProfile {
    // Área explícita tem prioridade — permite override preciso
    if (area && isValidProfile(area)) return area;

    // Regime jurídico resolve RPPS, RGPS e CLT diretamente
    if (regimeJuridico === "RPPS") return "RPPS";
    if (regimeJuridico === "RGPS") return "RGPS";
    if (regimeJuridico === "CLT")  return "TRABALHISTA";
    if (regimeJuridico === "CRIMINAL") return "CRIMINAL";

    // Detecção por assunto (da mais específica para a mais genérica)
    if (assunto) {
      // JEF (alta especificidade — antes de tributário/criminal)
      if (/lei\s+10\.259|JEF\s+[Ff]ederal|Turma\s+Recursal\s+Federal|TRF\d?|INSS|Uni[aã]o\s+Federal/i.test(assunto)) {
        return "JEF_FEDERAL";
      }
      if (/JEF|JEC|juizado\s+especial\s+(?:c[íi]vel|criminal)|lei\s+9\.099/i.test(assunto)) {
        return "JEF_ESTADUAL";
      }

      // Ambiental
      if (/ambiental|IBAMA|ICMBio|licenciamento\s+ambiental|APP\b|reserva\s+legal|dano\s+ambiental|pol[uú]i[cç][aã]o\s+ambiental/i.test(assunto)) {
        return "AMBIENTAL";
      }

      // Criminal
      if (/criminal|penal|crime|deli[tc]o|habeas\s+corpus|flagrante|inquérito\s+policial|CPP\b/i.test(assunto)) {
        return "CRIMINAL";
      }

      // Tributário (antes de execução — CDA é tributário mesmo em execução fiscal)
      if (/tribut[aá]rio|tribut|CTN\b|ICMS\b|ISS\b|IPTU\b|IPVA\b|IRPF\b|IRPJ\b|PIS\b|COFINS\b|execução\s+fiscal|CDA\b|dívida\s+ativa|lançamento\s+(?:fiscal|tributário)|repetição\s+de\s+indébito/i.test(assunto)) {
        return "TRIBUTARIO";
      }

      // Execução/cumprimento cível (não fiscal)
      if (/execu[cç][aã]o\s+(?!fiscal)|cumprimento\s+de\s+senten[cç]a|penhora|SISBAJUD/i.test(assunto)) {
        return "EXECUCAO_CUMPRIMENTO";
      }

      // Família
      if (/alimentos?|guarda\s+(?:d[ae]|compartilhada|unilateral)|divórcio|uni[aã]o\s+estável|parti[lh]a\s+de\s+bens|interdição|curatela|adoção|famil(?:ia|iar)|filhos?\s+menores?/i.test(assunto)) {
        return "FAMILIA";
      }

      // Fazenda pública / direito administrativo
      if (/servidor\s+público|concurso\s+público|ato\s+administrativo|fazenda\s+p[úu]blica|responsabilidade\s+(?:civil\s+)?do\s+Estado|improbidade\s+administrativa|mandado\s+de\s+segurança/i.test(assunto)) {
        return "FAZENDA_PUBLICA";
      }

      // Consumidor
      if (/consumidor|CDC\b|rela[cç][aã]o\s+de\s+consumo|c[oó]digo\s+de\s+defesa/i.test(assunto)) {
        return "CONSUMIDOR";
      }
    }

    return "CIVEL_GERAL";
  }
}
