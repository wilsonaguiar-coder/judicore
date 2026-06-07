"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { PieceCreationForm } from "@/components/piece-creation-form";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CounterargumentsPage() {
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
      <main className="flex-1 flex flex-col p-8 bg-slate-50/50 overflow-y-auto">
        <PieceCreationForm 
          title="Contrarrazões"
          description="Resposta ao recurso interposto pela parte contrária."
          auxiliaryText="Você pode anexar o recurso da parte contrária, a sentença, documentos probatórios e indicar os pontos que devem ser defendidos."
        />
      </main>
    </div>
  );
}
