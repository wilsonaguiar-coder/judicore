"use client";

import { useState } from "react";
import { LEGAL_AREAS } from "@/types";
import type { Case } from "@/types";
import { FileText, Search, Trash2, X, Check } from "lucide-react";

interface Props {
  caseData: Case;
  onClick: () => void;
  onDelete?: () => void;
}

export function CaseCard({ caseData, onClick, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirming(true);
  }

  function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete?.();
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full text-left px-5 py-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
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

      {/* Botão excluir — aparece no hover */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {confirming ? (
          <div className="flex items-center gap-1 bg-background border rounded-md shadow-sm px-2 py-1">
            <span className="text-xs text-destructive mr-1">Excluir?</span>
            <button
              onClick={handleConfirm}
              className="p-0.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
              title="Confirmar exclusão"
            >
              <Check size={13} />
            </button>
            <button
              onClick={handleCancel}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground transition-colors"
              title="Cancelar"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeleteClick}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Excluir caso"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
