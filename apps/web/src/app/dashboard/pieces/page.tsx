"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { QuotaCard } from "@/components/quota-card";
import { FileText, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PiecesPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Redirecionar Admin
  useEffect(() => {
    if (user?.role === "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user?.role === "ADMIN") return null;

  const comumCards = [
    { title: "Petição Inicial", desc: "Elaboração de petições iniciais para ajuizamento de ações.", path: "/dashboard/pieces/initial-petition" },
    { title: "Contestação", desc: "Resposta do réu aos pedidos formulados na petição inicial.", path: "/dashboard/pieces/contestation" },
    { title: "Réplica", desc: "Manifestação do autor sobre a contestação apresentada.", path: "/dashboard/pieces/reply" },
    { title: "Impugnação", desc: "Impugnação de documentos, cálculos, laudos ou manifestações.", path: "/dashboard/pieces/objection" },
    { title: "Recurso", desc: "Interposição de recursos contra decisões judiciais.", path: "/dashboard/pieces/appeal" },
    { title: "Contrarrazões", desc: "Resposta ao recurso interposto pela parte contrária.", path: "/dashboard/pieces/counterarguments" },
    { title: "Embargos de Declaração", desc: "Pedido de esclarecimento, integração ou correção da decisão.", path: "/dashboard/pieces/embargos" },
  ];

  const servidorCards = [
    { title: "Sentença", desc: "Minuta de sentença judicial.", path: "/dashboard/pieces/sentence" },
    { title: "Decisão", desc: "Minuta de decisão interlocutória.", path: "/dashboard/pieces/decision" },
    { title: "Despacho", desc: "Minuta de despacho ordinatório ou de impulso processual.", path: "/dashboard/pieces/order" },
  ];

  const cards = user?.role === "SERVIDOR" ? servidorCards : comumCards;

  // Mocking quotas for MVP view
  const quotaUsed = user?.piecesUsedCurrentCycle ?? 23;
  const quotaTotal = user?.monthlyPieceLimit ?? 50;
  const daysToRenew = 12;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Peças Jurídicas</h1>
              <p className="text-sm text-slate-500 mt-1">Selecione o tipo de documento que deseja elaborar.</p>
            </div>
            
            <div className="w-full md:w-72 shrink-0">
              <QuotaCard used={quotaUsed} total={quotaTotal} daysToRenew={daysToRenew} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((item) => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="flex flex-col text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-violet-500/50 hover:shadow-md transition-all group"
              >
                <div className="p-5 flex-1 flex flex-col w-full">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/10 text-violet-600 flex items-center justify-center mb-4 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                    <FileText size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">{item.desc}</p>
                  <div className="flex items-center justify-end mt-auto pt-4 border-t border-slate-100 text-violet-600 font-medium text-sm">
                    Elaborar <ArrowRight size={14} className="ml-1.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
