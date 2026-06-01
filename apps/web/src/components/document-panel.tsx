"use client";

import { useState, useRef } from "react";
import {
  FileText, Loader2, Copy, Check, Square, CheckSquare,
  Download, Upload, X, Sparkles, Zap,
  CheckCircle2, XCircle, AlertCircle, RotateCcw,
} from "lucide-react";
import { DOCUMENT_TYPES, DOC_TYPES_BY_ROLE } from "@/types";
import type { DocumentType, Jurisprudencia, UserRole } from "@/types";

interface Props {
  caseId: string;
  token: string;
  userRole: UserRole;
  jurisprudencias: Jurisprudencia[];
  activeDoc: string | null;
  activeDocId: string | null;
  onDocGenerated: (content: string, docId?: string) => void;
}

interface AuditError {
  tipo: string;
  trecho: string;
  correcao: string;
  severidade: "CRITICO" | "IMPORTANTE" | "SUGESTAO";
}

interface AuditResult {
  aprovada: boolean;
  score: number;
  erros: AuditError[];
  resumo: string;
}

const PHASE_LABELS: Record<string, string> = {
  classifying:     "Classificando caso",
  extracting:      "Extraindo informações",
  building_matrix: "Construindo argumentação",
  drafting:        "Redigindo peça",
  auditing:        "Auditando qualidade",
};
const PHASES_ORDER = ["classifying", "extracting", "building_matrix", "drafting", "auditing"] as const;

function toJurPipeline(j: Jurisprudencia) {
  return {
    id: j.id,
    tribunal: j.tribunal,
    numero: j.numero,
    tema: j.tipo ?? j.ementa.slice(0, 150),
    ementa: j.ementa,
    tese: j.ementa,
    relator: j.relator,
    dataJulgamento: j.dataJulgamento,
    url: j.url,
  };
}

function PhaseProgress({ currentPhase, completedPhases }: {
  currentPhase: string | null;
  completedPhases: Set<string>;
}) {
  return (
    <div className="space-y-1.5 py-1">
      {PHASES_ORDER.map((phase) => {
        const done = completedPhases.has(phase);
        const active = currentPhase === phase;
        return (
          <div
            key={phase}
            className={`flex items-center gap-2 text-xs transition-colors ${
              done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground/40"
            }`}
          >
            {done   ? <CheckCircle2 size={12} className="flex-shrink-0" />
            : active ? <Loader2 size={12} className="animate-spin flex-shrink-0" />
            :           <div className="w-3 h-3 rounded-full border border-current flex-shrink-0" />}
            <span>{PHASE_LABELS[phase]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AuditBadge({ audit }: { audit: AuditResult }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${
      audit.aprovada
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      <div className="flex items-center gap-1.5 font-medium mb-0.5">
        {audit.aprovada
          ? <CheckCircle2 size={12} />
          : <XCircle size={12} />}
        {audit.aprovada ? "Aprovada" : "Reprovada"} — Score: {audit.score}/100
      </div>
      <p className="text-[11px] opacity-80">{audit.resumo}</p>
    </div>
  );
}

function AuditErrors({ erros }: { erros: AuditError[] }) {
  if (erros.length === 0) return null;
  const criticos   = erros.filter((e) => e.severidade === "CRITICO");
  const importantes = erros.filter((e) => e.severidade === "IMPORTANTE");
  const sugestoes  = erros.filter((e) => e.severidade === "SUGESTAO");

  function ErrorGroup({ items, label, color }: { items: AuditError[]; label: string; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${color}`}>{label}</p>
        {items.map((e, i) => (
          <div key={i} className="mb-1.5 rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground line-clamp-1 italic">"{e.trecho}"</p>
            <p className="text-[11px] text-foreground mt-0.5">→ {e.correcao}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      <ErrorGroup items={criticos}    label="Críticos"    color="text-red-600" />
      <ErrorGroup items={importantes} label="Importantes" color="text-amber-600" />
      <ErrorGroup items={sugestoes}   label="Sugestões"   color="text-blue-600" />
    </div>
  );
}

export function DocumentPanel({ caseId, token, userRole, jurisprudencias, activeDoc, activeDocId, onDocGenerated }: Props) {
  const allowedTypes = DOC_TYPES_BY_ROLE[userRole] ?? DOC_TYPES_BY_ROLE["COMUM"];
  const [mode, setMode]           = useState<"pipeline" | "padrao" | "premium">("pipeline");
  const [docType, setDocType]     = useState<DocumentType>(allowedTypes[0]!);
  const [instruction, setInstruction] = useState("");
  const [pdfFiles, setPdfFiles]   = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [copied, setCopied]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError]         = useState("");
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  // Pipeline state
  const [pipelinePhase, setPipelinePhase]       = useState<string | null>(null);
  const [completedPhases, setCompletedPhases]   = useState<Set<string>>(new Set());
  const [pipelineGenerationId, setPipelineGenerationId] = useState<string | null>(null);
  const [audit, setAudit]         = useState<AuditResult | null>(null);
  const [retrying, setRetrying]   = useState(false);

  function resetPipelineState() {
    setPipelinePhase(null);
    setCompletedPhases(new Set());
    setPipelineGenerationId(null);
    setAudit(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter(
      (f) => f.type === "application/pdf" && f.size <= 5 * 1024 * 1024,
    );
    setPdfFiles((prev) => [...prev, ...incoming].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Pipeline SSE consumer ────────────────────────────────────────────────
  async function consumePipelineStream(res: Response, isRetry = false) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error ?? `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Stream não disponível");
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(line.slice(6)) as Record<string, unknown>; } catch { continue; }

        const evt = parsed["event"] as string | undefined;

        if (evt === "phase") {
          const data = parsed["data"] as { phase: string; generationId: string };
          const prevPhase = pipelinePhase;
          if (prevPhase) {
            setCompletedPhases((prev) => new Set([...prev, prevPhase]));
          }
          setPipelinePhase(data.phase);
          if (!isRetry) setPipelineGenerationId(data.generationId);
        } else if (evt === "chunk") {
          accumulated += parsed["data"] as string;
          onDocGenerated(accumulated);
        } else if (evt === "audit") {
          const data = parsed["data"] as AuditResult;
          setAudit(data);
          setCompletedPhases((prev) => new Set([...prev, "auditing"]));
          setPipelinePhase(null);
        } else if (evt === "error") {
          const data = parsed["data"] as { message: string; fatal: boolean };
          throw new Error(data.message);
        } else if ("generationId" in parsed) {
          // done event
          const docId = parsed["documentId"] as string | undefined;
          onDocGenerated(accumulated, docId);
          if (docId && !isRetry) setPipelineGenerationId(parsed["generationId"] as string);
        }
      }
    }
  }

  // ── Standard SSE consumer (padrão / premium) ─────────────────────────────
  async function consumeStream(res: Response) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error ?? `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Stream não disponível");
    const decoder = new TextDecoder();
    let accumulated = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        let parsed: { chunk?: string; done?: boolean; error?: string; status?: string; documentId?: string };
        try { parsed = JSON.parse(line.slice(6)); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.status) setStatusMsg(parsed.status);
        if (parsed.chunk) { accumulated += parsed.chunk; onDocGenerated(accumulated); }
        if (parsed.done) onDocGenerated(accumulated, parsed.documentId);
      }
    }
  }

  // ── Generate handlers ────────────────────────────────────────────────────
  async function handleGenerate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setError("");
    setStatusMsg("");
    onDocGenerated("");
    resetPipelineState();

    try {
      if (mode === "pipeline") {
        if (jurisprudencias.length === 0) { setStreaming(false); return; }
        const res = await fetch("/api/pipeline/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            caseId: caseId || undefined,
            type: docType,
            jurisprudencias: jurisprudencias.map(toJurPipeline),
            instruction: instruction.trim() || undefined,
          }),
          signal: controller.signal,
        });
        await consumePipelineStream(res);
      } else if (mode === "premium") {
        if (pdfFiles.length === 0) { setError("Adicione pelo menos um PDF."); setStreaming(false); return; }
        const form = new FormData();
        form.append("type", docType);
        form.append("caseId", caseId);
        form.append("jurisprudencias", JSON.stringify(jurisprudencias));
        form.append("instruction", instruction.trim());
        pdfFiles.forEach((f) => form.append("files", f));
        const res = await fetch("/api/stream/generate-premium", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: controller.signal,
        });
        await consumeStream(res);
      } else {
        if (jurisprudencias.length === 0) { setStreaming(false); return; }
        const res = await fetch("/api/stream/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ caseId, type: docType, jurisprudencias, instruction: instruction.trim() || undefined }),
          signal: controller.signal,
        });
        await consumeStream(res);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Erro ao gerar documento.");
    } finally {
      setStreaming(false);
      setStatusMsg("");
    }
  }

  async function handleRetry() {
    if (!pipelineGenerationId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRetrying(true);
    setAudit(null);
    setCompletedPhases((prev) => {
      const next = new Set(prev);
      next.delete("drafting");
      next.delete("auditing");
      return next;
    });
    setError("");
    onDocGenerated("");

    try {
      const res = await fetch(`/api/pipeline/${pipelineGenerationId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      await consumePipelineStream(res, true);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Erro ao regenerar.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleCopy() {
    if (!activeDoc) return;
    await navigator.clipboard.writeText(activeDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!activeDoc || streaming) return;
    setDownloading(true);
    try {
      const res = activeDocId
        ? await fetch(`/api/export/${activeDocId}`, { headers: { Authorization: `Bearer ${token}` } })
        : await fetch("/api/export/raw", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: docType, content: activeDoc }),
          });
      if (!res.ok) throw new Error("Falha ao baixar documento");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `judicore_${docType.toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? "Erro ao baixar documento.");
    } finally {
      setDownloading(false);
    }
  }

  const isGenerating = streaming || retrying;
  const canGenerate  = mode === "premium" ? pdfFiles.length > 0 : jurisprudencias.length > 0;
  const showPipeline = mode === "pipeline";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controles */}
      <div className="flex-shrink-0 overflow-y-auto p-4 border-b max-h-[55%]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Gerar documento
        </h2>

        {/* Seletor de modo — 3 tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-muted mb-3">
          {([
            ["pipeline", <Zap size={10} />,      "Pipeline"],
            ["padrao",   <FileText size={10} />,  "Padrão"],
            ["premium",  <Sparkles size={10} />,  "Avançado"],
          ] as const).map(([m, icon, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={isGenerating}
              className={`py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                mode === m
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          {/* Seletor de tipo */}
          <div className={`grid gap-1.5 p-1 rounded-lg bg-muted ${allowedTypes.length <= 3 ? "grid-cols-3" : "grid-cols-5"}`}>
            {allowedTypes.map((k) => (
              <button
                key={k}
                onClick={() => setDocType(k)}
                disabled={isGenerating}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                  docType === k
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                }`}
              >
                {DOCUMENT_TYPES[k]}
              </button>
            ))}
          </div>

          {/* Instrução */}
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isGenerating}
            placeholder="Orientação para a IA (opcional): entendimento a aplicar, artigos relevantes..."
            rows={3}
            className="w-full text-xs rounded-lg border bg-muted/30 px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />

          {/* Upload PDFs (premium) */}
          {mode === "premium" && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating || pdfFiles.length >= 5}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
              >
                <Upload size={13} />
                {pdfFiles.length === 0
                  ? "Clique para adicionar PDFs (máx. 5 × 5 MB)"
                  : pdfFiles.length >= 5
                    ? "Limite de 5 arquivos atingido"
                    : `Adicionar mais PDFs (${pdfFiles.length}/5)`}
              </button>
              {pdfFiles.length > 0 && (
                <div className="space-y-1">
                  {pdfFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-xs">
                      <FileText size={11} className="text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate text-muted-foreground">{f.name}</span>
                      <span className="text-muted-foreground/60 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setPdfFiles((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/60">
                A IA lê os documentos, busca a legislação mencionada na fonte oficial (Planalto) e gera a peça fundamentada. Os PDFs não são salvos no servidor.
              </p>
            </div>
          )}

          {/* Progresso do pipeline durante geração */}
          {showPipeline && isGenerating && (
            <PhaseProgress currentPhase={pipelinePhase} completedPhases={completedPhases} />
          )}

          {/* Contador de jurisprudências */}
          {mode !== "premium" && (
            <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${jurisprudencias.length === 0 ? "text-muted-foreground bg-muted/50" : "text-foreground"}`}>
              {jurisprudencias.length === 0 ? <Square size={12} /> : <CheckSquare size={12} className="text-primary" />}
              {jurisprudencias.length === 0
                ? "Nenhuma decisão selecionada"
                : `${jurisprudencias.length} ${jurisprudencias.length > 1 ? "decisões selecionadas" : "decisão selecionada"}`}
            </div>
          )}
          {mode === "premium" && jurisprudencias.length > 0 && (
            <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 text-foreground">
              <CheckSquare size={12} className="text-primary" />
              {jurisprudencias.length} {jurisprudencias.length > 1 ? "decisões" : "decisão"} como base
            </div>
          )}

          {statusMsg && <p className="text-xs text-primary animate-pulse">{statusMsg}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Botões de ação */}
          {isGenerating ? (
            <button
              onClick={() => { abortRef.current?.abort(); setStreaming(false); setRetrying(false); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              <Loader2 size={13} className="animate-spin" />
              Parar geração
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {mode === "pipeline" ? <Zap size={13} /> : mode === "premium" ? <Sparkles size={13} /> : <FileText size={13} />}
                {`Gerar ${DOCUMENT_TYPES[docType]!.toLowerCase()}`}
              </button>

              {/* Corrigir e regerar — aparece quando pipeline reprova */}
              {showPipeline && audit && !audit.aprovada && pipelineGenerationId && (
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  <RotateCcw size={13} />
                  Corrigir e regerar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Área do documento */}
      {activeDoc ? (
        <div className="flex-1 flex flex-col min-h-0 p-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {mode === "premium" && <Sparkles size={10} className="text-primary" />}
              {mode === "pipeline" && <Zap size={10} className="text-primary" />}
              Documento gerado
              {isGenerating && <Loader2 size={10} className="animate-spin text-primary" />}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={isGenerating}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={handleDownload}
                disabled={isGenerating || !activeDoc || downloading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                .docx
              </button>
            </div>
          </div>

          {/* Resultado da auditoria (pipeline mode) */}
          {showPipeline && audit && !isGenerating && (
            <div className="mb-3 space-y-2">
              <AuditBadge audit={audit} />
              {!audit.aprovada && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <AlertCircle size={11} />
                    {audit.erros.length} {audit.erros.length === 1 ? "problema encontrado" : "problemas encontrados"}
                    <span className="ml-1 group-open:hidden">▸ ver</span>
                    <span className="ml-1 hidden group-open:inline">▾ ocultar</span>
                  </summary>
                  <AuditErrors erros={audit.erros} />
                </details>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-3">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
              {activeDoc}
              {isGenerating && <span className="inline-block w-1.5 h-3 bg-primary animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground text-center p-4">
          {/* Progresso visível na área vazia enquanto está nas primeiras fases */}
          {showPipeline && isGenerating && (pipelinePhase === "classifying" || pipelinePhase === "extracting" || pipelinePhase === "building_matrix") ? (
            <div className="w-full max-w-48">
              <PhaseProgress currentPhase={pipelinePhase} completedPhases={completedPhases} />
            </div>
          ) : (
            <span>
              {mode === "premium"
                ? "Adicione os PDFs do processo, selecione decisões e clique em gerar."
                : mode === "pipeline"
                  ? "Selecione decisões e clique em gerar. O pipeline classifica, argumenta e audita automaticamente."
                  : "Selecione decisões relevantes e clique em gerar para criar a peça."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
