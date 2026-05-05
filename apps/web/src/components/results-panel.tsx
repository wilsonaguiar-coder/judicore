"use client";

import { ExternalLink, CheckSquare, Square } from "lucide-react";
import type { Jurisprudencia } from "@/types";

interface Props {
  results: Jurisprudencia[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function ResultsPanel({ results, selected, onToggle }: Props) {
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8 text-center">
        Use o painel de busca para encontrar jurisprudência relevante ao caso.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resultados ({results.length})
        </h2>
        <span className="text-xs text-muted-foreground">{selected.size} selecionados</span>
      </div>

      {results.map((j) => {
        const isSelected = selected.has(j.id);
        return (
          <div
            key={j.id}
            className={`rounded-lg border p-3.5 cursor-pointer transition-colors ${
              isSelected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
            }`}
            onClick={() => onToggle(j.id)}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex-shrink-0 text-muted-foreground">
                {isSelected
                  ? <CheckSquare size={14} className="text-primary" />
                  : <Square size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary">{j.tribunal}</span>
                  <span className="text-xs text-muted-foreground">{j.numero}</span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3 text-foreground/80">{j.ementa}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {j.relator} · {j.dataJulgamento}
                  </span>
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Ver original <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
