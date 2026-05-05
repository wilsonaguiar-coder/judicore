"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { SearchPanel } from "@/components/search-panel";
import { ResultsPanel } from "@/components/results-panel";
import { DocumentPanel } from "@/components/document-panel";
import { Sidebar } from "@/components/sidebar";
import { ArrowLeft } from "lucide-react";
import type { Case, Jurisprudencia } from "@/types";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const router = useRouter();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [results, setResults] = useState<Jurisprudencia[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    api.get<Case>(`/cases/${id}`, token).then(setCaseData);
  }, [id, token, router]);

  const selectedJurisprudencias = results.filter((r) => selected.has(r.id));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold">{caseData?.title ?? "Carregando..."}</h1>
            <p className="text-xs text-muted-foreground">{caseData?.area?.toLowerCase().replace("_", " ")}</p>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Coluna 1: Busca */}
          <div className="w-72 border-r flex flex-col overflow-auto">
            <SearchPanel
              caseId={id}
              token={token!}
              {...(caseData?.area ? { defaultArea: caseData.area } : {})}
              onResults={setResults}
            />
          </div>

          {/* Coluna 2: Resultados */}
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

          {/* Coluna 3: Geração de documentos */}
          <div className="w-96 overflow-auto">
            <DocumentPanel
              caseId={id}
              token={token!}
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
