"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { PieceCreationForm } from "@/components/piece-creation-form";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InitialPetitionPage() {
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
          title="Petição Inicial"
          description="Elaboração de petições iniciais para ajuizamento de ações."
          auxiliaryText="Você pode anexar documentos pessoais, comprovante de endereço, procuração, documentos médicos, CNIS, PPP, carta de indeferimento ou outros documentos que ajudem na qualificação e fundamentação."
        />
      </main>
    </div>
  );
}
