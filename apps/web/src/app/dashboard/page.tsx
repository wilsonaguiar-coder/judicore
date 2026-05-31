"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { CaseCard } from "@/components/case-card";
import { NewCaseDialog } from "@/components/new-case-dialog";
import { Sidebar } from "@/components/sidebar";
import { JurisprudenciaStats } from "@/components/jurisprudencia-stats";
import { Search, FolderPlus } from "lucide-react";
import type { Case } from "@/types";

export default function DashboardPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.get<Case[]>("/cases", token).then(setCases).finally(() => setLoading(false));
  }, [token]);

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return;
    await api.delete(`/cases/${id}`, token);
    setCases((prev) => prev.filter((c) => c.id !== id));
  }, [token]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">

          <div className="mb-8">
            <JurisprudenciaStats token={token!} inline />
          </div>

          {/* Opções principais */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <button
              onClick={() => router.push("/dashboard/search")}
              className="flex flex-col items-start gap-3 p-6 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
                <Search size={18} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Busca livre</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pesquise jurisprudência sem criar um caso
                </p>
              </div>
            </button>

            <NewCaseDialog
              token={token!}
              onCreated={(c) => { setCases((prev) => [c, ...prev]); router.push(`/dashboard/case/${c.id}`); }}
              trigger={
                <div className="flex flex-col items-start gap-3 p-6 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
                    <FolderPlus size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Novo caso</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Crie e salve um caso para suas pesquisas
                    </p>
                  </div>
                </div>
              }
            />
          </div>

          {/* Casos salvos */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Casos salvos
            </h2>

            {loading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border rounded-xl">
                <p className="text-sm">Nenhum caso salvo ainda.</p>
                <p className="text-sm">Crie um caso para organizar suas pesquisas.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    caseData={c}
                    onClick={() => router.push(`/dashboard/case/${c.id}`)}
                    onDelete={() => handleDelete(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
