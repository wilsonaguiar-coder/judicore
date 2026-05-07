"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { JobStatusBadge } from "@/components/job-status-badge";
import { TriggerIndexDialog } from "@/components/trigger-index-dialog";
import { RefreshCw, Loader2, Database, Trash2, Cpu, Zap } from "lucide-react";

interface RepeatableJob {
  key: string;
  name: string;
  cron: string;
  next: string | null;
}

interface JobSummary {
  id: string;
  name: string;
  data: { area: string; sources: string[]; triggeredBy: string };
  progress: unknown;
  returnvalue: { indexed: number; failed: number; durationMs: number; completedAt: string } | null;
  failedReason: string | null;
  attemptsMade: number;
  processedOn: string | null;
  finishedOn: string | null;
}

interface IndexStats {
  total: number;
  porArea: { area: string; count: number }[];
  porTribunal: { tribunal: string; count: number }[];
}

interface UsageData {
  period: number;
  totals: { groqInput: number; groqOutput: number; geminiInput: number };
  byDay: { date: string; groqInput: number; groqOutput: number; geminiInput: number }[];
  byDocType: Record<string, { input: number; output: number; count: number }>;
}

interface QueueStatus {
  counts: { active: number; waiting: number; delayed: number };
  active: JobSummary[];
  waiting: JobSummary[];
  recentCompleted: JobSummary[];
  recentFailed: JobSummary[];
  scheduled: RepeatableJob[];
}

export default function AdminPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<"indexacao" | "uso">("indexacao");
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [data, indexStats, usageData] = await Promise.all([
        api.get<QueueStatus>("/admin/jobs", token),
        api.get<IndexStats>("/admin/stats", token),
        api.get<UsageData>("/admin/usage", token),
      ]);
      setStatus(data);
      setStats(indexStats);
      setUsage(usageData);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [token, user, router, load]);

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleClean() {
    if (!token) return;
    setCleaning(true);
    try {
      await api.post("/admin/jobs/clean", {}, token);
      await load();
    } finally {
      setCleaning(false);
    }
  }

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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10 space-y-8">

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b">
            {(["indexacao", "uso"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "indexacao" ? "Indexação" : "Uso de IA"}
              </button>
            ))}
          </div>

          {/* ── TAB: INDEXAÇÃO ── */}
          {tab === "indexacao" && <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Indexação</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Status da fila e agendamento de indexação de jurisprudência
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                Atualizar
              </button>
              <button
                onClick={handleClean}
                disabled={cleaning}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} className={cleaning ? "animate-pulse" : ""} />
                Limpar histórico
              </button>
              <TriggerIndexDialog token={token!} onTriggered={load} />
            </div>
          </div>

          {/* Estatísticas do índice */}
          {stats && (
            <section className="rounded-lg border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold">Índice de jurisprudência</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  {stats.total.toLocaleString("pt-BR")} documentos no total
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stats.porArea.map((a) => (
                  <div key={a.area} className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{a.area}</p>
                    <p className="text-sm font-semibold mt-0.5">{a.count.toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Ativos", value: status?.counts.active ?? 0, color: "text-blue-500" },
              { label: "Aguardando", value: status?.counts.waiting ?? 0, color: "text-yellow-500" },
              { label: "Agendados", value: status?.scheduled.length ?? 0, color: "text-green-500" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Jobs agendados */}
          <section>
            <h2 className="text-sm font-semibold mb-3">Agendamentos recorrentes</h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Área</th>
                    <th className="px-4 py-2.5 text-left font-medium">Cron</th>
                    <th className="px-4 py-2.5 text-left font-medium">Próxima execução</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {status?.scheduled.map((j) => (
                    <tr key={j.key} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{j.name.replace("indexing:", "")}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{j.cron}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {j.next ? new Date(j.next).toLocaleString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Jobs ativos */}
          {(status?.active.length ?? 0) > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Em execução</h2>
              <div className="space-y-2">
                {status!.active.map((j) => <JobRow key={j.id} job={j} variant="active" />)}
              </div>
            </section>
          )}

          {/* Concluídos recentes */}
          {(status?.recentCompleted.length ?? 0) > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Concluídos recentes</h2>
              <div className="space-y-2">
                {status!.recentCompleted.map((j) => <JobRow key={j.id} job={j} variant="completed" />)}
              </div>
            </section>
          )}

          {/* Falhos recentes */}
          {(status?.recentFailed.length ?? 0) > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Falhos recentes</h2>
              <div className="space-y-2">
                {status!.recentFailed.map((j) => <JobRow key={j.id} job={j} variant="failed" />)}
              </div>
            </section>
          )}
          </>}

          {/* ── TAB: USO DE IA ── */}
          {tab === "uso" && usage && <UsageTab usage={usage} />}

        </div>
      </main>
    </div>
  );
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

function UsageTab({ usage }: { usage: UsageData }) {
  const { totals, byDay, byDocType } = usage;
  const groqCostInput  = (totals.groqInput  / 1_000_000) * 0.05;
  const groqCostOutput = (totals.groqOutput / 1_000_000) * 0.08;
  const geminiCost     = (totals.geminiInput / 1_000)    * 0.00002;
  const totalCost      = groqCostInput + groqCostOutput + geminiCost;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Uso de IA</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Consumo de tokens nos últimos {usage.period} dias</p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Cpu size={14} className="text-muted-foreground" />
            Groq — Geração de documentos
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Input</p>
              <p className="text-xl font-semibold">{fmt(totals.groqInput)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Output</p>
              <p className="text-xl font-semibold">{fmt(totals.groqOutput)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-2">
            Custo estimado: <span className="font-medium text-foreground">US$ {(groqCostInput + groqCostOutput).toFixed(4)}</span>
          </p>
        </div>

        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap size={14} className="text-muted-foreground" />
            Gemini — Embeddings de busca
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tokens estimados</p>
            <p className="text-xl font-semibold">{fmt(totals.geminiInput)}</p>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-2">
            Custo estimado: <span className="font-medium text-foreground">US$ {geminiCost.toFixed(4)}</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border px-5 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Custo total estimado no período</span>
        <span className="text-lg font-semibold">US$ {totalCost.toFixed(4)}</span>
      </div>

      {/* Por tipo de documento */}
      {Object.keys(byDocType).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Uso por tipo de peça (Groq)</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Gerações</th>
                  <th className="px-4 py-2.5 text-right font-medium">Input</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(byDocType).map(([type, d]) => (
                  <tr key={type} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{DOC_LABELS[type] ?? type}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{d.count}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(d.input)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(d.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Por dia */}
      {byDay.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Histórico diário</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-right font-medium">Groq Input</th>
                  <th className="px-4 py-2.5 text-right font-medium">Groq Output</th>
                  <th className="px-4 py-2.5 text-right font-medium">Gemini Embeds</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...byDay].reverse().map((d) => (
                  <tr key={d.date} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(d.groqInput)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(d.groqOutput)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(d.geminiInput)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {byDay.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum registro de uso ainda. Os dados aparecerão após a primeira geração de documento ou busca.
        </div>
      )}
    </div>
  );
}

function JobRow({ job, variant }: { job: JobSummary; variant: "active" | "completed" | "failed" }) {
  const result = job.returnvalue;
  return (
    <div className="rounded-lg border px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <JobStatusBadge variant={variant} />
          <span className="text-xs font-medium">{job.name}</span>
          <span className="text-xs text-muted-foreground">#{job.id?.slice(0, 8)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Fontes: {job.data.sources?.join(", ")} · {job.data.triggeredBy}
        </p>
        {job.failedReason && (
          <p className="text-xs text-destructive mt-1 truncate">{job.failedReason}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {result && (
          <>
            <p className="text-xs font-medium text-green-600">+{result.indexed} indexados</p>
            {result.failed > 0 && (
              <p className="text-xs text-destructive">{result.failed} falhos</p>
            )}
            <p className="text-xs text-muted-foreground">
              {Math.round(result.durationMs / 1000)}s
            </p>
          </>
        )}
        {variant === "active" && (
          <p className="text-xs text-blue-500">Rodando...</p>
        )}
        {job.finishedOn && (
          <p className="text-xs text-muted-foreground">
            {new Date(job.finishedOn).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  );
}
