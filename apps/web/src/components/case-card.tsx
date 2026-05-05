import { LEGAL_AREAS } from "@/types";
import type { Case } from "@/types";
import { FileText, Search } from "lucide-react";

interface Props {
  caseData: Case;
  onClick: () => void;
}

export function CaseCard({ caseData, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {caseData.title}
          </p>
          {caseData.processNum && (
            <p className="text-xs text-muted-foreground mt-0.5">Processo {caseData.processNum}</p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          {LEGAL_AREAS[caseData.area]}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Search size={11} />
          {caseData._count?.searches ?? 0} buscas
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText size={11} />
          {caseData._count?.documents ?? 0} documentos
        </span>
      </div>
    </button>
  );
}
