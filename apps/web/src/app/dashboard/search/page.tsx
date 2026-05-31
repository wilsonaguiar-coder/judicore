"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import { SearchPanel } from "@/components/search-panel";
import { ResultsPanel } from "@/components/results-panel";
import { DocumentPanel } from "@/components/document-panel";
import { Sidebar } from "@/components/sidebar";
import type { Jurisprudencia } from "@/types";

export default function SearchPage() {
  const { token, user } = useAuthStore();
  const [results, setResults] = useState<Jurisprudencia[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Larguras redimensionáveis
  const [searchWidth, setSearchWidth] = useState(272);
  const [docWidth, setDocWidth] = useState(420);

  const selectedJurisprudencias = results.filter((r) => selected.has(r.id));

  const startResizeSearch = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = searchWidth;
    const onMove = (ev: MouseEvent) => {
      setSearchWidth(Math.max(200, Math.min(480, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [searchWidth]);

  const startResizeDoc = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = docWidth;
    const onMove = (ev: MouseEvent) => {
      setDocWidth(Math.max(300, Math.min(640, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [docWidth]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={user} />

      <main className="flex-1 flex overflow-hidden min-w-0">

        {/* Painel de filtros */}
        <aside
          style={{ width: searchWidth }}
          className="shrink-0 overflow-y-auto bg-slate-50 border-r border-slate-200 relative"
        >
          <SearchPanel caseId="" token={token!} onResults={setResults} />
          {/* Handle de resize */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group"
            onMouseDown={startResizeSearch}
          >
            <div className="absolute right-0 top-0 bottom-0 w-px bg-slate-200 group-hover:bg-primary/50 transition-colors" />
          </div>
        </aside>

        {/* Resultados */}
        <section className="flex-1 min-w-0 overflow-y-auto bg-white">
          <ResultsPanel
            results={results}
            selected={selected}
            onToggle={(jid) =>
              setSelected((prev) => {
                const next = new Set(prev);
                next.has(jid) ? next.delete(jid) : next.add(jid);
                return next;
              })
            }
          />
        </section>

        {/* Handle de resize do painel direito */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize group border-l border-slate-200 bg-slate-50 hover:bg-primary/10 transition-colors"
          onMouseDown={startResizeDoc}
        />

        {/* Painel de geração */}
        <aside
          style={{ width: docWidth }}
          className="shrink-0 overflow-y-auto bg-white border-l border-slate-200"
        >
          <DocumentPanel
            caseId=""
            token={token!}
            userRole={user?.role ?? "COMUM"}
            jurisprudencias={selectedJurisprudencias}
            activeDoc={activeDoc}
            activeDocId={activeDocId}
            onDocGenerated={(content, docId) => {
              setActiveDoc(content);
              if (docId) setActiveDocId(docId);
            }}
          />
        </aside>

      </main>
    </div>
  );
}
