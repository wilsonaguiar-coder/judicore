"use client";

import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/sidebar";
import { PieceCreationForm } from "@/components/piece-creation-form";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SentencePage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "ADMIN" || (user && user.role !== "SERVIDOR")) {
      router.push("/dashboard/pieces");
    }
  }, [user, router]);

  if (!user || user.role !== "SERVIDOR") return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col p-8 bg-slate-50/50 overflow-y-auto">
        <PieceCreationForm 
          title="Sentença"
          description="Minuta de sentença judicial."
          auxiliaryText="Você pode anexar petição inicial, contestação, réplica, provas e manifestações para auxiliar na elaboração da minuta."
        />
      </main>
    </div>
  );
}
