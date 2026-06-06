import { AuditService } from "../audit.service.js";
import type { ReAuditRequest, ReAuditResult, ReAuditMetrics } from "./re-audit.types.js";

export class ReAuditService {
  constructor(private readonly auditService: AuditService = new AuditService()) {}

  public runReAudit(request: ReAuditRequest): ReAuditResult {
    const originalAudit = this.auditService.auditGeneratedDocument(
      "original-draft",
      request.originalDraft,
      request.classification
    );

    const rewrittenAudit = this.auditService.auditGeneratedDocument(
      "rewritten-draft",
      request.rewrittenDraft,
      request.classification
    );

    const metrics: ReAuditMetrics = {
      scoreBefore: originalAudit.audit.score,
      scoreAfter: rewrittenAudit.audit.score,
      scoreDelta: rewrittenAudit.audit.score - originalAudit.audit.score,
      
      fatalBefore: originalAudit.audit.fatalErrors.length,
      fatalAfter: rewrittenAudit.audit.fatalErrors.length,
      fatalDelta: rewrittenAudit.audit.fatalErrors.length - originalAudit.audit.fatalErrors.length,
      
      warningsBefore: originalAudit.audit.nonFatalErrors.length,
      warningsAfter: rewrittenAudit.audit.nonFatalErrors.length,
      warningsDelta: rewrittenAudit.audit.nonFatalErrors.length - originalAudit.audit.nonFatalErrors.length,
    };

    let improved = false;
    let regressed = false;

    // improved = scoreAfter > scoreBefore OU fatalAfter < fatalBefore OU warningsAfter < warningsBefore
    if (
      metrics.scoreAfter > metrics.scoreBefore ||
      metrics.fatalAfter < metrics.fatalBefore ||
      metrics.warningsAfter < metrics.warningsBefore
    ) {
      improved = true;
    }

    // regressed = scoreAfter < scoreBefore OU fatalAfter > fatalBefore OU warningsAfter > warningsBefore
    if (
      metrics.scoreAfter < metrics.scoreBefore ||
      metrics.fatalAfter > metrics.fatalBefore ||
      metrics.warningsAfter > metrics.warningsBefore
    ) {
      regressed = true;
    }

    // Se n\u00E3o houve mudan\u00E7as absolutas, ou se de alguma forma um crit\u00E9rio melhorou e o outro piorou (amarrando os dois como true),
    // o empate t\u00E9cnico (tudo igual) gera improved = false e regressed = false.
    if (
      metrics.scoreAfter === metrics.scoreBefore &&
      metrics.fatalAfter === metrics.fatalBefore &&
      metrics.warningsAfter === metrics.warningsBefore
    ) {
      improved = false;
      regressed = false;
    } else if (improved && regressed) {
      // Regra de neg\u00F3cio: Se algo melhorou E algo piorou simultaneamente, podemos considerar n\u00E3o \u00E9 uma "melhora l\u00EDquida" perfeita, 
      // mas vamos manter as duas flags ativas pois a pe\u00E7a de fato tem um aspecto que melhorou e outro que regrediu.
      // Ou talvez anular. A especifica\u00E7\u00E3o s\u00F3 diz: "Empate: improved = false, regressed = false". O empate significa deltas iguais a zero.
    }

    return {
      originalAudit,
      rewrittenAudit,
      metrics,
      improved,
      regressed,
      generatedAt: new Date().toISOString()
    };
  }
}
