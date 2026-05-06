"use client";

import { useState } from "react";
import { ExternalLink, CheckSquare, Square, FileText, X } from "lucide-react";
import type { Jurisprudencia } from "@/types";

interface Props {
  results: Jurisprudencia[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function TextoIntegralModal({ j, onClose }: { j: Jurisprudencia; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">{j.tribunal}</span>
              {j.tipo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {j.tipo.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{j.numero} · {j.relator}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
            {j.textoIntegral || j.ementa}
          </p>
        </div>
        {j.url && (
          <div className="p-3 border-t flex-shrink-0">
            <a
              href={j.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Ver no site do tribunal <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultsPanel({ results, selected, onToggle }: Props) {
  const [viewing, setViewing] = useState<Jurisprudencia | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8 text-center">
        Use o painel de busca para encontrar jurisprudência relevante ao caso.
      </div>
    );
  }

  return (
    <>
      {viewing && <TextoIntegralModal j={viewing} onClose={() => setViewing(null)} />}

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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-primary">{j.tribunal}</span>
                    {j.tipo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
                        {j.tipo.replace(/_/g, " ")}
                      </span>
                    )}
                    {j.autoridade && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">
                        {j.autoridade}
                      </span>
                    )}
                    {j.score != null && j.score > 0 && (
                      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                        {j.score.toFixed(4)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 mb-1 block">{j.numero}</span>
                  <p className="text-xs leading-relaxed line-clamp-3 text-foreground/80">{j.ementa}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {j.relator} · {j.dataJulgamento}
                    </span>
                    <div className="flex items-center gap-2">
                      {(j.textoIntegral || j.ementa) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewing(j); }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          <FileText size={10} /> Ler
                        </button>
                      )}
                      {j.url ? (
                        <a
                          href={j.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Ver original <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">sem link</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
