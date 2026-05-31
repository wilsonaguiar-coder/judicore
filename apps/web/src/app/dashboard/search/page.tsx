"use client";

import { useState } from "react";
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

  const selectedJurisprudencias = results.filter((r) => selected.has(r.id));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 flex overflow-hidden min-w-0">

        {/* Painel de filtros */}
        <aside className="w-68 shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
          <SearchPanel
            caseId=""
            token={token!}
            onResults={setResults}
          />
        </aside>

        {/* Resultados */}
        <section className="flex-1 min-w-0 overflow-y-auto border-r border-slate-200 bg-white">
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

        {/* Geração de documento */}
        <aside className="w-[27rem] shrink-0 overflow-y-auto bg-white">
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
