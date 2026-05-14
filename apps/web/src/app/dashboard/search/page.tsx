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

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b px-6 py-4 flex-shrink-0">
          <h1 className="text-sm font-semibold">Busca livre</h1>
          <p className="text-xs text-muted-foreground">Pesquise jurisprudência sem criar um caso</p>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r flex flex-col overflow-auto">
            <SearchPanel
              caseId=""
              token={token!}
              onResults={setResults}
            />
          </div>

          <div className="flex-1 border-r overflow-auto">
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
          </div>

          <div className="w-96 overflow-auto">
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
          </div>
        </div>
      </main>
    </div>
  );
}
