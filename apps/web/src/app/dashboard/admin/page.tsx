"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { JobStatusBadge } from "@/components/job-status-badge";
import { TriggerIndexDialog } from "@/components/trigger-index-dialog";
import { RefreshCw, Loader2, Database, Trash2, Play, CheckCircle, XCircle, Clock } from "lucide-react";

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

interface LanceDbInfo {
  stf: string;
  stj: string;
  next_since: { stf: string; stj: string };
  stj_last_edition: number | null;
  stj_pdf_editions: number[];
}

interface LanceDbJob {
  id: string;
  sources: string[];
  since_date: string;
  year: number;
  status: "pending" | "running" | "completed" | "failed";
  last_progress: { stage: string; message: string } | null;
  progress_count: number;
  latest_dates: { stf?: string; stj?: string };
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
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
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // LanceDB state
  const [lanceInfo, setLanceInfo] = useState<LanceDbInfo | null>(null);
  const [lanceJob, setLanceJob] = useState<LanceDbJob | null>(null);
  const [lanceSources, setLanceSources] = useState<("stf" | "stj")[]>(["stf"]);
  const [lanceSinceDate, setLanceSinceDate] = useState("");
  const [lanceTriggering, setLanceTriggering] = useState(false);
  const lancePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lancePrePopulatedRef = useRef(false);

  // STJ indexing state
  const [stjIndexing, setStjIndexing] = useState(false);
  const [stjIndexLog, setStjIndexLog] = useState<{ msg: string; type: "info" | "ok" | "err" }[]>([]);
  const [stjIndexDone, setStjIndexDone] = useState<string | null>(null);

  // STJ upload manual (fallback)
  const [stjFiles, setStjFiles] = useState<FileList | null>(null);
  const [stjUploading, setStjUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [data, indexStats, lanceDbInfo] = await Promise.all([
        api.get<QueueStatus>("/admin/jobs", token),
        api.get<IndexStats>("/admin/stats", token),
        api.get<LanceDbInfo>("/admin/lancedb/info", token).catch(() => null),
      ]);
      setStatus(data);
      setStats(indexStats);
      if (lanceDbInfo) {
        setLanceInfo(lanceDbInfo);
        // Pré-preenche o campo "Desde" com o cursor da última atualização (só na 1ª carga)
        if (!lancePrePopulatedRef.current) {
          const cursor = lanceDbInfo.next_since?.stf || lanceDbInfo.next_since?.stj || "";
          if (cursor) {
            setLanceSinceDate(cursor);
            lancePrePopulatedRef.current = true;
          }
        }
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, router]);

  const pollLanceJob = useCallback(async (jobId: string) => {
    if (!token) return;
    try {
      const job = await api.get<LanceDbJob>(`/admin/lancedb/update/${jobId}`, token);
      setLanceJob(job);
      if (job.status === "completed" || job.status === "failed") {
        if (lancePollerRef.current) clearInterval(lancePollerRef.current);
        lancePollerRef.current = null;
        // atualiza as datas após conclusão
        api.get<LanceDbInfo>("/admin/lancedb/info", token).then(setLanceInfo).catch(() => {});
      }
    } catch {}
  }, [token]);

  async function handleLanceTrigger() {
    if (!token || lanceSources.length === 0) return;
    setLanceTriggering(true);
    try {
      const body: Record<string, unknown> = { sources: lanceSources };
      if (lanceSinceDate) body.since_date = lanceSinceDate;
      const res = await api.post<LanceDbJob>("/admin/lancedb/update", body, token);
      setLanceJob(res);
      if (lancePollerRef.current) clearInterval(lancePollerRef.current);
      lancePollerRef.current = setInterval(() => pollLanceJob(res.id), 4000);
    } catch (e: any) {
      alert(`Erro ao iniciar atualização LanceDB: ${e.message}`);
    } finally {
      setLanceTriggering(false);
    }
  }

  async function handleStjIndex() {
    if (!token || !lanceInfo) return;
    setStjIndexing(true);
    setStjIndexLog([]);
    setStjIndexDone(null);

    const log = (msg: string, type: "info" | "ok" | "err" = "info") =>
      setStjIndexLog((prev) => [...prev, { msg, type }]);

    const STJ_PDF_URL = "https://processo.stj.jus.br/SCON/GetPDFINFJ?edicao=";
    const start = (lanceInfo.stj_last_edition ?? 0) + 1;
    const MAX_MISSES = 3;

    log(`Buscando informativos a partir da edição ${start}...`);

    let misses = 0;
    let uploaded = 0;
    let lastUploaded = lanceInfo.stj_last_edition ?? 0;

    for (let ed = start; misses < MAX_MISSES; ed++) {
      const num = String(ed).padStart(4, "0");
      try {
        const res = await fetch(`${STJ_PDF_URL}${num}`);
        if (!res.ok) {
          log(`Edição ${num} não encontrada`, "info");
          misses++;
          continue;
        }
        const buf = await res.arrayBuffer();
        const header = new TextDecoder().decode(buf.slice(0, 4));
        if (header !== "%PDF") {
          log(`Edição ${num} — resposta não é PDF`, "err");
          misses++;
          continue;
        }
        misses = 0;
        log(`Edição ${num} baixada (${Math.round(buf.byteLength / 1024)} KB) — enviando ao servidor...`);
        const form = new FormData();
        form.append("files", new Blob([buf], { type: "application/pdf" }), `Informativo_${num}.pdf`);
        const up = await fetch("/api/admin/lancedb/stj/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (up.ok) {
          log(`Edição ${num} salva no servidor`, "ok");
          uploaded++;
          lastUploaded = ed;
        } else {
          log(`Edição ${num} — erro no upload (HTTP ${up.status})`, "err");
        }
      } catch (e: any) {
        // CORS ou falha de rede
        log(`Edição ${num} — ${e.message.includes("Failed to fetch") ? "bloqueado por CORS (use upload manual)" : e.message}`, "err");
        misses++;
      }
    }

    if (uploaded === 0) {
      log("Nenhum PDF novo encontrado. Base já está atualizada.", "info");
      setStjIndexDone("já atualizada");
      setStjIndexing(false);
      return;
    }

    log(`${uploaded} edição(ões) enviada(s). Iniciando embedding no servidor...`);
    try {
      const job = await api.post<LanceDbJob>("/admin/lancedb/update", { sources: ["stj"], skip_browser: true }, token);
      setLanceJob(job);
      if (lancePollerRef.current) clearInterval(lancePollerRef.current);
      lancePollerRef.current = setInterval(() => pollLanceJob(job.id), 4000);
      log("Indexação iniciada — acompanhe o progresso abaixo.", "ok");
      setStjIndexDone(`até edição #${lastUploaded}`);
    } catch (e: any) {
      log(`Erro ao iniciar indexação: ${e.message}`, "err");
    }

    api.get<LanceDbInfo>("/admin/lancedb/info", token).then(setLanceInfo).catch(() => {});
    setStjIndexing(false);
  }

  async function handleStjManualUpload() {
    if (!token || !stjFiles || stjFiles.length === 0) return;
    setStjUploading(true);
    try {
      const form = new FormData();
      for (const file of Array.from(stjFiles)) form.append("files", file);
      const res = await fetch("/api/admin/lancedb/stj/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      api.get<LanceDbInfo>("/admin/lancedb/info", token).then(setLanceInfo).catch(() => {});
      setStjFiles(null);
    } catch (e: any) {
      alert(`Erro ao enviar PDFs: ${e.message}`);
    } finally {
      setStjUploading(false);
    }
  }

  useEffect(() => {
    return () => { if (lancePollerRef.current) clearInterval(lancePollerRef.current); };
  }, []);

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

          {/* ── LANCEDB ── */}
          <section className="rounded-lg border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold">Base semântica (LanceDB)</h2>
                <span className="text-xs text-muted-foreground">STF + STJ · embeddings Gemini</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded text-xs font-medium border bg-primary text-primary-foreground border-primary">STF</span>
                <div className="flex flex-col">
                  <label className="text-[10px] text-muted-foreground mb-0.5">Desde (padrão: 01/01/{new Date().getFullYear()})</label>
                  <input
                    type="date"
                    value={lanceSinceDate}
                    onChange={(e) => setLanceSinceDate(e.target.value)}
                    className="px-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <button
                  onClick={handleLanceTrigger}
                  disabled={lanceTriggering || lanceSources.length === 0 || lanceJob?.status === "running" || lanceJob?.status === "pending"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {lanceTriggering || lanceJob?.status === "running" || lanceJob?.status === "pending"
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Play size={11} />}
                  Atualizar agora
                </button>
              </div>
            </div>

            {/* Datas de referência */}
            <div className="grid grid-cols-2 gap-3">
              {(["STF", "STJ"] as const).map((t) => {
                const key = t.toLowerCase() as "stf" | "stj";
                const dateStr = lanceInfo?.[key];
                const cursorStr = lanceInfo?.next_since?.[key];
                return (
                  <div key={t} className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{t} · última data indexada</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {dateStr
                        ? new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR")
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                    {cursorStr && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        próx. atualização desde{" "}
                        <span className="font-medium text-foreground">
                          {new Date(cursorStr + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* STJ — indexação automática */}
            <div className="rounded-md border border-dashed px-3 py-3 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Informativos STJ</p>
                  <p className="text-[10px] text-muted-foreground">
                    Última edição indexada:{" "}
                    <span className="font-semibold text-foreground">
                      {lanceInfo?.stj_last_edition != null ? `#${lanceInfo.stj_last_edition}` : "nenhuma"}
                    </span>
                    {lanceInfo?.stj_pdf_editions && lanceInfo.stj_pdf_editions.length > 0 && (
                      <> · {lanceInfo.stj_pdf_editions.length} PDF(s) em disco</>
                    )}
                    {stjIndexDone && (
                      <> · <span className="text-green-600 font-medium">atualizada {stjIndexDone}</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStjIndex}
                    disabled={stjIndexing || !lanceInfo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {stjIndexing ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    Indexar STJ
                  </button>
                  <div className="h-4 w-px bg-border" />
                  <label className="cursor-pointer px-2.5 py-1.5 rounded border text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Upload manual
                    <input type="file" accept=".pdf" multiple className="hidden"
                      onChange={(e) => setStjFiles(e.target.files)} />
                  </label>
                  {stjFiles && stjFiles.length > 0 && (
                    <button
                      onClick={handleStjManualUpload}
                      disabled={stjUploading}
                      className="flex items-center gap-1 px-2 py-1.5 rounded border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                      {stjUploading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      Enviar ({stjFiles.length})
                    </button>
                  )}
                </div>
              </div>

              {stjIndexLog.length > 0 && (
                <div className="rounded bg-muted/40 px-2 py-1.5 max-h-28 overflow-y-auto space-y-0.5">
                  {stjIndexLog.map((entry, i) => (
                    <p key={i} className={`text-[10px] font-mono ${
                      entry.type === "err" ? "text-destructive" :
                      entry.type === "ok"  ? "text-green-600" :
                      "text-muted-foreground"
                    }`}>{entry.msg}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Status do job em andamento */}
            {lanceJob && (
              <div className={`rounded-md border px-3 py-2.5 text-xs space-y-1 ${
                lanceJob.status === "failed" ? "border-destructive/40 bg-destructive/5" :
                lanceJob.status === "completed" ? "border-green-500/30 bg-green-500/5" :
                "border-blue-500/30 bg-blue-500/5"
              }`}>
                <div className="flex items-center gap-2">
                  {lanceJob.status === "completed" && <CheckCircle size={12} className="text-green-500" />}
                  {lanceJob.status === "failed"    && <XCircle size={12} className="text-destructive" />}
                  {(lanceJob.status === "running" || lanceJob.status === "pending") && <Loader2 size={12} className="animate-spin text-blue-500" />}
                  <span className="font-medium">
                    {lanceJob.status === "pending"   && "Aguardando início..."}
                    {lanceJob.status === "running"   && `Processando... (${lanceJob.progress_count} etapas)`}
                    {lanceJob.status === "completed" && "Atualização concluída"}
                    {lanceJob.status === "failed"    && "Falha na atualização"}
                  </span>
                  <span className="text-muted-foreground ml-auto">job #{lanceJob.id}</span>
                </div>
                {lanceJob.last_progress && (
                  <p className="text-muted-foreground truncate">{lanceJob.last_progress.message}</p>
                )}
                {lanceJob.status === "completed" && lanceJob.latest_dates && (
                  <div className="flex gap-4 pt-1">
                    {lanceJob.latest_dates.stf && (
                      <span>STF até <strong>{new Date(lanceJob.latest_dates.stf + "T12:00:00").toLocaleDateString("pt-BR")}</strong></span>
                    )}
                    {lanceJob.latest_dates.stj && (
                      <span>STJ até <strong>{new Date(lanceJob.latest_dates.stj + "T12:00:00").toLocaleDateString("pt-BR")}</strong></span>
                    )}
                  </div>
                )}
                {lanceJob.error && <p className="text-destructive">{lanceJob.error}</p>}
              </div>
            )}
          </section>

          {/* ── INDEXAÇÃO ES ── */}
          {<>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Indexação Elasticsearch</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fila BullMQ · TST, DataJud e demais tribunais
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

        </div>
      </main>
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
