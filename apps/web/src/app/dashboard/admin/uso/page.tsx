"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Loader2, Cpu } from "lucide-react";

interface UsageData {
  period: number;
  totals: { openaiInput: number; openaiOutput: number; geminiInput: number };
  byDay: { date: string; openaiInput: number; openaiOutput: number; geminiInput: number }[];
  byDocType: Record<string, { input: number; output: number; count: number }>;
}


const DOC_LABELS: Record<string, string> = {
  PETICAO_INICIAL: "Petição Inicial",
  RECURSO: "Recurso",
  SENTENCA: "Sentença",
  DECISAO: "Decisão",
  DESPACHO: "Despacho",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function UsagePage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<UsageData>("/admin/usage", token);
      setUsage(data);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    load();
  }, [token, user, router, load]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      </div>
    );
  }

  const totals = usage?.totals ?? { openaiInput: 0, openaiOutput: 0, geminiInput: 0 };
  const byDay = usage?.byDay ?? [];
  const byDocType = usage?.byDocType ?? {};

  // GPT-4o pricing: $2.50/M input, $10.00/M output
  const openaiCostInput  = (totals.openaiInput  / 1_000_000) * 2.50;
  const openaiCostOutput = (totals.openaiOutput / 1_000_000) * 10.00;
  const totalOpenaiCost  = openaiCostInput + openaiCostOutput;

  // Gemini text-embedding-004: $0.025/M tokens (≤128k), free tier for small usage
  const geminiCost = (totals.geminiInput / 1_000_000) * 0.025;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">

          <div>
            <h1 className="text-xl font-semibold">Uso de IA</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Consumo de tokens nos últimos {usage?.period ?? 30} dias
            </p>
          </div>

          {/* Card OpenAI */}
          <div className="rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu size={14} className="text-muted-foreground" />
              OpenAI — Geração de documentos (GPT-4o)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Input</p>
                <p className="text-2xl font-semibold">{fmt(totals.openaiInput)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">US$ {openaiCostInput.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Output</p>
                <p className="text-2xl font-semibold">{fmt(totals.openaiOutput)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">US$ {openaiCostOutput.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo estimado total</p>
                <p className="text-2xl font-semibold">US$ {totalOpenaiCost.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">$2.50/M in · $10.00/M out</p>
              </div>
            </div>
          </div>

          {/* Card Gemini */}
          <div className="rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu size={14} className="text-muted-foreground" />
              Gemini — Embeddings de busca (text-embedding-004)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Input (tokens estimados)</p>
                <p className="text-2xl font-semibold">{fmt(totals.geminiInput)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo estimado</p>
                <p className="text-2xl font-semibold">US$ {geminiCost.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">$0.025/M tokens</p>
              </div>
            </div>
            {totals.geminiInput === 0 && (
              <p className="text-xs text-amber-500">
                ⚠ Nenhum uso registrado. O serviço de busca pode não estar enviando logs para a API — verifique INTERNAL_SECRET e API_URL no servidor.
              </p>
            )}
          </div>

          {/* Por tipo de peça */}
          {Object.keys(byDocType).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Uso por tipo de peça</h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                      <th className="px-4 py-2.5 text-right font-medium">Gerações</th>
                      <th className="px-4 py-2.5 text-right font-medium">Input</th>
                      <th className="px-4 py-2.5 text-right font-medium">Output</th>
                      <th className="px-4 py-2.5 text-right font-medium">Custo est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(byDocType).map(([type, d]) => {
                      const cost = (d.input / 1_000_000) * 2.50 + (d.output / 1_000_000) * 10.00;
                      return (
                        <tr key={type} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{DOC_LABELS[type] ?? type}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{d.count}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(d.input)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(d.output)}</td>
                          <td className="px-4 py-2.5 text-right">US$ {cost.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Histórico diário */}
          {byDay.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold mb-3">Histórico diário</h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Data</th>
                      <th className="px-4 py-2.5 text-right font-medium">OpenAI Input</th>
                      <th className="px-4 py-2.5 text-right font-medium">OpenAI Output</th>
                      <th className="px-4 py-2.5 text-right font-medium">Gemini Input</th>
                      <th className="px-4 py-2.5 text-right font-medium">Custo OpenAI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...byDay].reverse().map((d) => {
                      const cost = (d.openaiInput / 1_000_000) * 2.50 + (d.openaiOutput / 1_000_000) * 10.00;
                      return (
                        <tr key={d.date} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-2.5 text-right">{fmt(d.openaiInput)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(d.openaiOutput)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(d.geminiInput)}</td>
                          <td className="px-4 py-2.5 text-right">US$ {cost.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum registro ainda. Os dados aparecem após a primeira geração de documento ou busca.
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
