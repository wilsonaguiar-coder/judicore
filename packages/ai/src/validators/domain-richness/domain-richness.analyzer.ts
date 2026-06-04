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

    // Regime jurídico resolve RPPS e RGPS diretamente
    if (regimeJuridico === "RPPS") return "RPPS";
    if (regimeJuridico === "RGPS") return "RGPS";

    // Detecção textual para JEF, execução e consumidor
    if (assunto) {
      if (/lei\s+10\.259|JEF\s+[Ff]ederal|Turma\s+Recursal\s+Federal|TRF\d?|INSS|Uni[aã]o\s+Federal/i.test(assunto)) {
        return "JEF_FEDERAL";
      }
      if (/JEF|JEC|juizado\s+especial\s+(?:cível|criminal)|lei\s+9\.099/i.test(assunto)) {
        return "JEF_ESTADUAL";
      }
      if (/execu[cç][aã]o|cumprimento\s+de\s+senten[cç]a|penhora|SISBAJUD/i.test(assunto)) {
        return "EXECUCAO_CUMPRIMENTO";
      }
      if (/consumidor|CDC|rela[cç][aã]o\s+de\s+consumo|c[oó]digo\s+de\s+defesa/i.test(assunto)) {
        return "CONSUMIDOR";
      }
    }

    return "CIVEL_GERAL";
  }
}
