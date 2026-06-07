"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { CaseCard } from "@/components/case-card";
import { NewCaseDialog } from "@/components/new-case-dialog";
import { Sidebar } from "@/components/sidebar";
import { JurisprudenciaStats } from "@/components/jurisprudencia-stats";
import { Search, FolderPlus, Newspaper, ExternalLink } from "lucide-react";
import type { Case } from "@/types";

function AdminDashboard() {
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

function CommonDashboard() {
  const { user } = useAuthStore();
  
  const news = [
    {
      id: 1,
      title: "STF define tese sobre modulação de efeitos em matéria tributária",
      description: "A Suprema Corte decidiu novos parâmetros para a modulação de efeitos em casos de inconstitucionalidade de tributos...",
      source: "Supremo Tribunal Federal",
      date: "07 Jun 2026",
      category: "Justiça Brasileira"
    },
    {
      id: 2,
      title: "STJ unifica entendimento sobre prescrição intercorrente",
      description: "Nova decisão afeta milhares de processos de execução fiscal em andamento e consolida o prazo aplicável...",
      source: "Superior Tribunal de Justiça",
      date: "06 Jun 2026",
      category: "Tribunais"
    },
    {
      id: 3,
      title: "Uso de Inteligência Artificial na redação de peças é regulamentado pela OAB",
      description: "Conselho Federal edita provimento sobre os limites éticos do uso de IA generativa por advogados e escritórios...",
      source: "Conselho Federal da OAB",
      date: "05 Jun 2026",
      category: "Advocacia"
    },
    {
      id: 4,
      title: "Novas regras para o BPC entram em vigor no próximo mês",
      description: "INSS publica portaria detalhando os novos critérios de aferição de renda para o Benefício de Prestação Continuada...",
      source: "Diário Oficial da União",
      date: "04 Jun 2026",
      category: "Direito Previdenciário"
    },
    {
      id: 5,
      title: "TRFs concluem implantação do sistema unificado de custas",
      description: "Sistema promete simplificar o recolhimento de custas processuais em todas as regiões da Justiça Federal...",
      source: "Conselho da Justiça Federal",
      date: "02 Jun 2026",
      category: "Poder Judiciário"
    },
    {
      id: 6,
      title: "Judicore lança nova suíte de ferramentas preditivas",
      description: "Plataforma passa a oferecer análise preditiva de decisões com base em 1 milhão de acórdãos indexados...",
      source: "Tecnologia Jurídica",
      date: "01 Jun 2026",
      category: "Tecnologia Jurídica"
    }
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Bem-vindo, {user?.name?.split(' ')[0]}</h1>
            <p className="text-sm text-slate-500 mt-1">Acompanhe as últimas atualizações e notícias do mundo jurídico.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {news.map((item) => (
              <div key={item.id} className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Newspaper size={14} className="text-violet-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">{item.category}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-slate-800">{item.source}</span>
                      <span className="text-[10px] text-slate-500">{item.date}</span>
                    </div>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  
  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  return <CommonDashboard />;
}
