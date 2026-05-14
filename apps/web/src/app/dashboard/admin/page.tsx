"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Loader2, Database, Play, CheckCircle, XCircle } from "lucide-react";

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

interface TrfIngestJob {
  id: string;
  tribunal: string;
  status: "running" | "completed" | "failed";
  lines: string[];
  indexed: number;
  startedAt: string;
  finishedAt: string | null;
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


export default function AdminPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);

  // LanceDB state
  const [lanceInfo, setLanceInfo] = useState<LanceDbInfo | null>(null);
  const [lanceJob, setLanceJob] = useState<LanceDbJob | null>(null);
  const [lanceSources, setLanceSources] = useState<("stf" | "stj")[]>(["stf"]);
  const [lanceSinceDate, setLanceSinceDate] = useState("");
  const [lanceTriggering, setLanceTriggering] = useState(false);
  const lancePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lancePrePopulatedRef = useRef(false);

  // TRF ingestion state
  const [trfTribunal, setTrfTribunal] = useState<string>("TRF1");
  const [trfFiles, setTrfFiles] = useState<FileList | null>(null);
  const [trfJob, setTrfJob] = useState<TrfIngestJob | null>(null);
  const trfPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const [indexStats, lanceDbInfo] = await Promise.all([
        api.get<IndexStats>("/admin/stats", token),
        api.get<LanceDbInfo>("/admin/lancedb/info", token).catch(() => null),
      ]);
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
    const pdfsOnDisk = lanceInfo.stj_pdf_editions ?? [];
    const lastIndexed = lanceInfo.stj_last_edition ?? 0;
    const pending = pdfsOnDisk.filter((ed) => ed > lastIndexed);

    setStjIndexing(true);
    setStjIndexLog([
      pending.length > 0
        ? { msg: `${pending.length} edição(ões) em disco aguardando embedding: ${pending.join(", ")}`, type: "info" as const }
        : { msg: "Verificando dados obsoletos no servidor...", type: "info" as const },
    ]);
    setStjIndexDone(null);

    const log = (msg: string, type: "info" | "ok" | "err" = "info") =>
      setStjIndexLog((prev) => [...prev, { msg, type }]);

    try {
      const job = await api.post<LanceDbJob>("/admin/lancedb/update", { sources: ["stj"], skip_browser: true }, token);
      setLanceJob(job);
      if (lancePollerRef.current) clearInterval(lancePollerRef.current);
      lancePollerRef.current = setInterval(() => pollLanceJob(job.id), 4000);
      log("Embedding iniciado — acompanhe o progresso abaixo.", "ok");
      setStjIndexDone(pending.length > 0 ? `até edição #${Math.max(...pending)}` : "dados atualizados");
    } catch (e: any) {
      log(`Erro ao iniciar indexação: ${e.message}`, "err");
    }

    api.get<LanceDbInfo>("/admin/lancedb/info", token).then(setLanceInfo).catch(() => {});
    setStjIndexing(false);
  }

  function handleStjBulkDownload() {
    if (!lanceInfo) return;
    const start = (lanceInfo.stj_last_edition ?? 0) + 1;
    const STJ_PDF_BASE = "https://processo.stj.jus.br/SCON/GetPDFINFJ?edicao=";
    for (let ed = start; ed < start + 10; ed++) {
      const num = String(ed).padStart(4, "0");
      window.open(`${STJ_PDF_BASE}${num}`, `stj_${num}`);
    }
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

  async function handleTrfUpload() {
    if (!token || !trfFiles || trfFiles.length === 0) return;
    setTrfJob(null);
    if (trfPollerRef.current) clearInterval(trfPollerRef.current);

    // Divide em lotes de no máximo 80 MB para não estourar limites de rede
    const MAX_BATCH_BYTES = 80 * 1024 * 1024;
    const allFiles = Array.from(trfFiles);
    const batches: File[][] = [];
    let cur: File[] = [], curSize = 0;
    for (const file of allFiles) {
      if (curSize + file.size > MAX_BATCH_BYTES && cur.length > 0) {
        batches.push(cur); cur = []; curSize = 0;
      }
      cur.push(file); curSize += file.size;
    }
    if (cur.length > 0) batches.push(cur);

    const waitForJob = (jobId: string): Promise<TrfIngestJob> =>
      new Promise((resolve, reject) => {
        const iv = setInterval(async () => {
          try {
            const job = await api.get<TrfIngestJob>(`/admin/trf/job/${jobId}`, token!);
            setTrfJob(job);
            if (job.status === "completed" || job.status === "failed") {
              clearInterval(iv);
              job.status === "completed" ? resolve(job) : reject(new Error(`Lote falhou: ${job.lines.slice(-1)[0] ?? ""}`));
            }
          } catch { clearInterval(iv); reject(new Error("Polling falhou")); }
        }, 3000);
        trfPollerRef.current = iv;
      });

    try {
      let totalIndexed = 0;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchMB = (batch.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(0);
        setTrfJob((prev) => ({
          ...(prev ?? { id: "", tribunal: trfTribunal, status: "running" as const, indexed: 0, startedAt: new Date().toISOString(), finishedAt: null }),
          status: "running",
          lines: [...(prev?.lines ?? []), `Lote ${i + 1}/${batches.length} — ${batch.length} PDF(s) (${batchMB} MB)…`],
        }));

        const form = new FormData();
        for (const file of batch) form.append("files", file);
        const res = await fetch(`/api/admin/trf/upload?tribunal=${trfTribunal}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error ?? `HTTP ${res.status}`);
        }
        const { jobId } = await res.json() as { jobId: string };
        const finished = await waitForJob(jobId);
        totalIndexed += finished.indexed;
      }

      setTrfFiles(null);
      setTrfJob((prev) => prev ? { ...prev, status: "completed", indexed: totalIndexed, finishedAt: new Date().toISOString() } : prev);
      api.get<IndexStats>("/admin/stats", token!).then(setStats).catch(() => {});
    } catch (e: any) {
      setTrfJob((prev) => prev ? { ...prev, status: "failed", finishedAt: new Date().toISOString(), lines: [...(prev.lines ?? []), `Erro: ${e.message}`] } : prev);
    }
  }

  useEffect(() => {
    return () => {
      if (lancePollerRef.current) clearInterval(lancePollerRef.current);
      if (trfPollerRef.current) clearInterval(trfPollerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
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

            {/* STJ — indexação */}
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
                      <> · {lanceInfo.stj_pdf_editions.filter(e => e > (lanceInfo.stj_last_edition ?? 0)).length} PDF(s) aguardando embedding</>
                    )}
                    {stjIndexDone && (
                      <> · <span className="text-green-600 font-medium">atualizada {stjIndexDone}</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Passo 2: selecionar PDFs baixados e enviar */}
                  <label className="cursor-pointer px-2.5 py-1.5 rounded border text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {stjFiles && stjFiles.length > 0 ? `${stjFiles.length} PDF(s) selecionado(s)` : "Selecionar PDFs"}
                    <input type="file" accept=".pdf" multiple className="hidden"
                      onChange={(e) => { setStjFiles(e.target.files); setStjIndexLog([]); }} />
                  </label>
                  {stjFiles && stjFiles.length > 0 && (
                    <button
                      onClick={handleStjManualUpload}
                      disabled={stjUploading}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium text-primary border-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                    >
                      {stjUploading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      Enviar ao servidor
                    </button>
                  )}
                  <div className="h-4 w-px bg-border" />
                  {/* Passo 3: disparar embedding */}
                  <button
                    onClick={handleStjIndex}
                    disabled={stjIndexing || !lanceInfo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {stjIndexing ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    Indexar STJ
                  </button>
                </div>
              </div>

              {/* Passo 1: abrir PDFs para salvar */}
              {lanceInfo && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleStjBulkDownload}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Play size={11} />
                      Abrir próximas 10 edições
                    </button>
                    <p className="text-[10px] text-muted-foreground">
                      Abre as edições #{(lanceInfo.stj_last_edition ?? 0) + 1}–#{(lanceInfo.stj_last_edition ?? 0) + 10} em abas novas.
                      As que existirem mostrarão o PDF — salve cada uma com <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Ctrl+S</kbd> na pasta Downloads.
                      As que não existirem mostrarão erro e podem ser fechadas.
                    </p>
                  </div>
                </div>
              )}

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

          {/* ── TRFs ── */}
          <section className="rounded-lg border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">TRFs — Boletins de jurisprudência</h2>
              <span className="text-xs text-muted-foreground">Elasticsearch · ingestão mensal por PDF</span>
            </div>

            {/* Contagem por TRF */}
            {stats && (
              <div className="grid grid-cols-6 gap-2">
                {(["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"] as const).map((trf) => {
                  const count = stats.porTribunal.find((t) => t.tribunal === trf)?.count ?? 0;
                  return (
                    <div key={trf} className="rounded-md bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{trf}</p>
                      <p className="text-sm font-semibold mt-0.5">{count.toLocaleString("pt-BR")}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload */}
            <div className="rounded-md border border-dashed px-3 py-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={trfTribunal}
                  onChange={(e) => { setTrfTribunal(e.target.value); setTrfJob(null); setTrfFiles(null); }}
                  className="px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <label className="cursor-pointer px-2.5 py-1.5 rounded border text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {trfFiles && trfFiles.length > 0 ? `${trfFiles.length} PDF(s) selecionado(s)` : "Selecionar boletim(ns)"}
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => { setTrfFiles(e.target.files); setTrfJob(null); }}
                  />
                </label>

                {trfFiles && trfFiles.length > 0 && (
                  <button
                    onClick={handleTrfUpload}
                    disabled={trfJob?.status === "running"}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium text-primary border-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                  >
                    {trfJob?.status === "running"
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Play size={11} />}
                    Enviar ao servidor
                  </button>
                )}
              </div>

              {/* Status do job */}
              {trfJob && (
                <div className={`rounded-md border px-3 py-2.5 text-xs space-y-1.5 ${
                  trfJob.status === "failed"    ? "border-destructive/40 bg-destructive/5" :
                  trfJob.status === "completed" ? "border-green-500/30 bg-green-500/5" :
                  "border-blue-500/30 bg-blue-500/5"
                }`}>
                  <div className="flex items-center gap-2">
                    {trfJob.status === "completed" && <CheckCircle size={12} className="text-green-500" />}
                    {trfJob.status === "failed"    && <XCircle size={12} className="text-destructive" />}
                    {trfJob.status === "running"   && <Loader2 size={12} className="animate-spin text-blue-500" />}
                    <span className="font-medium">
                      {trfJob.status === "running"   && `Processando ${trfJob.tribunal}…`}
                      {trfJob.status === "completed" && `Concluído — ${trfJob.indexed.toLocaleString("pt-BR")} decisões indexadas`}
                      {trfJob.status === "failed"    && `Falha na ingestão ${trfJob.tribunal}`}
                    </span>
                  </div>
                  <div className="rounded bg-muted/40 px-2 py-1.5 max-h-36 overflow-y-auto">
                    {trfJob.lines.slice(-30).map((line, i) => (
                      <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── ESTATÍSTICAS ES ── */}
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

        </div>
      </main>
    </div>
  );
}



