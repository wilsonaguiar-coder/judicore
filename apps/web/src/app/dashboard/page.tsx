"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { CaseCard } from "@/components/case-card";
import { NewCaseDialog } from "@/components/new-case-dialog";
import { Sidebar } from "@/components/sidebar";
import type { Case } from "@/types";

export default function DashboardPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    api.get<Case[]>("/cases", token).then(setCases).finally(() => setLoading(false));
  }, [token, router]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold">Casos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {cases.length} caso{cases.length !== 1 ? "s" : ""} em andamento
              </p>
            </div>
            <NewCaseDialog token={token!} onCreated={(c) => setCases((prev) => [c, ...prev])} />
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-sm">Nenhum caso ainda.</p>
              <p className="text-sm">Clique em "Novo caso" para começar.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {cases.map((c) => (
                <CaseCard key={c.id} caseData={c} onClick={() => router.push(`/dashboard/case/${c.id}`)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
