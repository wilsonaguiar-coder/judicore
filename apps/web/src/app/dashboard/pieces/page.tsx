"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { FileText } from "lucide-react";

export default function PiecesPage() {
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
        <div className="flex flex-col items-center max-w-md text-center">
          <div className="w-16 h-16 bg-violet-600/10 text-violet-600 flex items-center justify-center rounded-2xl mb-6">
            <FileText size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Peças Jurídicas</h1>
          <p className="text-slate-600">
            Área destinada à geração, edição e exportação de peças jurídicas. Esta funcionalidade será configurada nas próximas etapas do MVP.
          </p>
        </div>
      </main>
    </div>
  );
}
