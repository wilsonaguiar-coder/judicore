"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { FileText, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PlaceholderPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "ADMIN" || (user && user.role !== "COMUM")) {
      router.push("/dashboard/pieces");
    }
  }, [user, router]);

  if (!user || user.role !== "COMUM") return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
        <div className="flex flex-col items-center max-w-md text-center bg-white p-10 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-violet-600/10 text-violet-600 flex items-center justify-center rounded-2xl mb-6">
            <FileText size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Contrarrazões</h1>
          <p className="text-sm font-medium text-slate-500 mb-6">Resposta ao recurso interposto pela parte contrária.</p>
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-8">
            Funcionalidade em desenvolvimento. A geração assistida por IA será disponibilizada em etapa futura do MVP.
          </div>
          
          <button 
            onClick={() => router.push("/dashboard/pieces")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar para Peças Jurídicas
          </button>
        </div>
      </main>
    </div>
  );
}
