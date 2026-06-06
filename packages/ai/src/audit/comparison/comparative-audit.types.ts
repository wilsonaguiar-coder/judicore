export interface ComparativeAlert {
  code: string;
  title?: string | undefined;
  severity?: string | undefined;
  fatal?: boolean | undefined;
}

export interface ComparativeAudit {
  previousStatus: string;
  currentStatus: string;
  previousScore?: number | undefined;
  currentScore?: number | undefined;
  scoreDelta?: number | undefined;
  removedAlerts: ComparativeAlert[];
  newAlerts: ComparativeAlert[];
  keptAlerts: ComparativeAlert[];
  improved: boolean;
  regressed: boolean;
  summary: string;
}
