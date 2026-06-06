import type { ComparativeAudit, ComparativeAlert } from "./comparative-audit.types.js";
import type { IntegratedAuditResponse } from "../audit.service.js";
import type { AuditReport, AuditItem } from "../../audit-report/audit-report.types.js";
import { RULE_TITLES } from "../../audit-report/audit-report.engine.js";

type AuditInput = IntegratedAuditResponse | AuditReport;

export class ComparativeAuditService {
  public compareAudits(previous: AuditInput, current: AuditInput): ComparativeAudit {
    const prevData = this.extractData(previous);
    const currData = this.extractData(current);

    const prevAlertsMap = new Map<string, ComparativeAlert>();
    const currAlertsMap = new Map<string, ComparativeAlert>();

    for (const alert of prevData.alerts) {
      prevAlertsMap.set(alert.code, alert);
    }
    for (const alert of currData.alerts) {
      currAlertsMap.set(alert.code, alert);
    }

    const removedAlerts: ComparativeAlert[] = [];
    const newAlerts: ComparativeAlert[] = [];
    const keptAlerts: ComparativeAlert[] = [];

    // Removed or Kept
    for (const [code, prevAlert] of prevAlertsMap.entries()) {
      if (currAlertsMap.has(code)) {
        keptAlerts.push(prevAlert);
      } else {
        removedAlerts.push(prevAlert);
      }
    }

    // New
    for (const [code, currAlert] of currAlertsMap.entries()) {
      if (!prevAlertsMap.has(code)) {
        newAlerts.push(currAlert);
      }
    }

    let scoreDelta: number | undefined = undefined;
    if (prevData.score !== undefined && currData.score !== undefined) {
      scoreDelta = currData.score - prevData.score;
    }

    let improved = false;
    let regressed = false;

    if ((scoreDelta !== undefined && scoreDelta > 0) || (removedAlerts.length > newAlerts.length)) {
      improved = true;
    }

    if ((scoreDelta !== undefined && scoreDelta < 0) || (newAlerts.length > removedAlerts.length)) {
      regressed = true;
    }

    // Se n\u00E3o melhorou nem piorou, ou se ambos deram true por conta de um empate l\u00F3gico 
    // (ex: score subiu mas newAlerts > removedAlerts, o que \u00E9 raro), ajustamos:
    if (improved && regressed) {
      // Prioridade para a pontua\u00E7\u00E3o se os dois entrarem em conflito.
      if (scoreDelta !== undefined) {
        if (scoreDelta > 0) regressed = false;
        else if (scoreDelta < 0) improved = false;
        else { improved = false; regressed = false; }
      } else {
        improved = false;
        regressed = false;
      }
    }

    let summary = "A nova vers\u00E3o manteve resultado semelhante ao anterior.";
    if (improved) {
      summary = "A nova vers\u00E3o reduziu alertas e/ou aumentou o score da auditoria.";
    } else if (regressed) {
      summary = "A nova vers\u00E3o introduziu novos alertas ou reduziu o score da auditoria.";
    }

    return {
      previousStatus: prevData.status,
      currentStatus: currData.status,
      previousScore: prevData.score,
      currentScore: currData.score,
      scoreDelta,
      removedAlerts,
      newAlerts,
      keptAlerts,
      improved,
      regressed,
      summary,
    };
  }

  private extractData(input: AuditInput): { status: string; score?: number; alerts: ComparativeAlert[] } {
    let status = "DESCONHECIDO";
    let score: number | undefined = undefined;
    const alerts: ComparativeAlert[] = [];

    const isIntegrated = this.isIntegratedAuditResponse(input);

    if (isIntegrated) {
      status = input.audit.status;
      score = input.audit.score;

      const pushAlerts = (sourceList: any[], isFatal: boolean) => {
        if (!sourceList) return;
        for (const item of sourceList) {
          const code = item.code ?? item.regra ?? "UNKNOWN_CODE";
          const title = item.titulo ?? RULE_TITLES[code] ?? code;
          alerts.push({
            code,
            title,
            fatal: isFatal,
            severity: isFatal ? "FATAL" : "WARNING",
          });
        }
      };

      pushAlerts(input.audit.fatalErrors, true);
      pushAlerts(input.audit.nonFatalErrors, false);

      // Tenta recuperar do rawReport caso os codes n\u00E3o estejam dispon\u00EDveis
      if (alerts.every(a => a.code === "UNKNOWN_CODE") && input.audit.rawReport) {
        // Limpa e usa o rawReport
        alerts.length = 0;
        this.extractAlertsFromAuditReport(input.audit.rawReport, alerts);
      }

    } else {
      status = input.classificacaoFinal;
      score = input.qualidadeTecnica;
      this.extractAlertsFromAuditReport(input, alerts);
    }

    return { status, score, alerts };
  }

  private extractAlertsFromAuditReport(report: AuditReport, alerts: ComparativeAlert[]): void {
    const pushAuditItems = (sourceList: AuditItem[], isFatal: boolean) => {
      for (const item of sourceList) {
        const code = item.regra ?? "UNKNOWN_CODE";
        const title = RULE_TITLES[code] ?? item.titulo;
        alerts.push({
          code,
          title,
          fatal: isFatal,
          severity: item.severidade ?? (isFatal ? "FATAL" : "WARNING"),
        });
      }
    };

    pushAuditItems(report.problemasFatais, true);
    pushAuditItems(report.problemasNaoFatais, false);
  }

  private isIntegratedAuditResponse(input: any): input is IntegratedAuditResponse {
    return input !== null && typeof input === "object" && "audit" in input;
  }
}
