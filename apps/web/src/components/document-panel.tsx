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
  caseDescription?: string | undefined;
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
  status_minuta?: "MINUTA APROVADA" | "APROVADA COM RESSALVAS" | "REPROVADA" | undefined;
  blocked?: boolean | undefined;
  ressalvas?: string[] | undefined;
}

const PHASE_LABELS: Record<string, string> = {
  classifying:        "Classificando caso",
  extracting:         "Extraindo informações",
  analyzing_evidence: "Analisando precedentes",
  building_matrix:    "Construindo argumentação",
  drafting:           "Redigindo peça",
  auditing:           "Auditando qualidade",
};
const PHASES_ORDER = ["classifying", "extracting", "analyzing_evidence", "building_matrix", "drafting", "auditing"] as const;

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
            :          <div className="w-3 h-3 rounded-full border border-current flex-shrink-0" />}
            <span>{PHASE_LABELS[phase]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AuditBadge({ audit }: { audit: AuditResult }) {
  const status = audit.status_minuta ?? (audit.aprovada ? "MINUTA APROVADA" : "REPROVADA");
  const isApproved  = status === "MINUTA APROVADA";
  const isRessalvas = status === "APROVADA COM RESSALVAS";
  const colorClass = isApproved
    ? "bg-green-50 border-green-200 text-green-700"
    : isRessalvas
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : "bg-red-50 border-red-200 text-red-700";
  const icon = isApproved
    ? <CheckCircle2 size={12} />
    : isRessalvas
      ? <AlertCircle size={12} />
      : <XCircle size={12} />;
  const label = isApproved ? "Aprovada" : isRessalvas ? "Aprovada com ressalvas" : "Reprovada";

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${colorClass}`}>
      <div className="flex items-center gap-1.5 font-medium mb-0.5">
        {icon}{label} — Score: {audit.score}/100
      </div>
      <p className="text-[11px] opacity-80 line-clamp-2">{audit.resumo}</p>
    </div>
  );
}

function AuditErrors({ erros }: { erros: AuditError[] }) {
  if (erros.length === 0) return null;
  const criticos    = erros.filter((e) => e.severidade === "CRITICO");
  const importantes = erros.filter((e) => e.severidade === "IMPORTANTE");
  const sugestoes   = erros.filter((e) => e.severidade === "SUGESTAO");

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

// ── Modal do documento gerado ───────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  isStreaming: boolean;
  pipelinePhase: string | null;
  completedPhases: Set<string>;
  audit: AuditResult | null;
  showPipeline: boolean;
  copied: boolean;
  onCopy: () => void;
  downloading: boolean;
  onDownload: () => void;
  mode: "pipeline" | "padrao" | "premium";
}

function DocumentModal({
  isOpen, onClose, content, isStreaming,
  pipelinePhase, completedPhases,
  audit, showPipeline,
  copied, onCopy, downloading, onDownload,
  mode,
}: ModalProps) {
  if (!isOpen) return null;

  const showProgress = isStreaming && !content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col bg-background rounded-xl shadow-2xl border w-full max-w-5xl" style={{ height: "88vh" }}>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            {mode === "pipeline" && <Zap size={13} className="text-primary" />}
            {mode === "premium"  && <Sparkles size={13} className="text-primary" />}
            {mode === "padrao"   && <FileText size={13} className="text-muted-foreground" />}
            Documento gerado
            {isStreaming && <Loader2 size={12} className="animate-spin text-primary ml-1" />}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onCopy}
              disabled={!content}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              onClick={onDownload}
              disabled={isStreaming || !content || downloading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              .docx
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-auto">
          {showProgress ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <p className="text-sm text-muted-foreground">Aguarde, preparando o documento...</p>
              <div className="w-56">
                <PhaseProgress currentPhase={pipelinePhase} completedPhases={completedPhases} />
              </div>
            </div>
          ) : (
            <div className="p-8 max-w-4xl mx-auto">
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle" />
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Rodapé — auditoria */}
        {showPipeline && audit && !isStreaming && (
          <div className="flex-shrink-0 border-t px-5 py-3 space-y-2 bg-muted/20">
            <AuditBadge audit={audit} />
            {audit.status_minuta !== "MINUTA APROVADA" && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <AlertCircle size={11} />
                  {audit.erros.length} {audit.erros.length === 1 ? "problema encontrado" : "problemas encontrados"}
                  <span className="ml-1 group-open:hidden">▸ ver</span>
                  <span className="ml-1 hidden group-open:inline">▾ ocultar</span>
                </summary>
                {(audit.ressalvas ?? []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(audit.ressalvas ?? []).map((r, i) => (
                      <p key={i} className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">• {r}</p>
                    ))}
                  </div>
                )}
                <AuditErrors erros={audit.erros} />
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Painel principal ────────────────────────────────────────────────────────

export function DocumentPanel({ caseId, token, userRole, jurisprudencias, caseDescription, activeDoc, activeDocId, onDocGenerated }: Props) {
  const allowedTypes = DOC_TYPES_BY_ROLE[userRole] ?? DOC_TYPES_BY_ROLE["COMUM"];
  const [mode, setMode]               = useState<"pipeline" | "padrao" | "premium">("pipeline");
  const [docType, setDocType]         = useState<DocumentType>(allowedTypes[0]!);
  const [caseDescEdit, setCaseDescEdit] = useState(caseDescription ?? "");
  const [instruction, setInstruction] = useState("");
  const [pdfFiles, setPdfFiles]       = useState<File[]>([]);
  const [streaming, setStreaming]     = useState(false);
  const [statusMsg, setStatusMsg]     = useState("");
  const [copied, setCopied]           = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError]             = useState("");
  const [modalOpen, setModalOpen]     = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                      = useRef<AbortController | null>(null);

  // Pipeline state
  const [pipelinePhase, setPipelinePhase]             = useState<string | null>(null);
  const [completedPhases, setCompletedPhases]         = useState<Set<string>>(new Set());
  const [pipelineGenerationId, setPipelineGenerationId] = useState<string | null>(null);
  const [audit, setAudit]             = useState<AuditResult | null>(null);
  const [retrying, setRetrying]       = useState(false);

  function resetPipelineState() {
    setPipelinePhase(null);
    setCompletedPhases(new Set());
    setPipelineGenerationId(null);
    setAudit(null);
    setModalOpen(false);
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
          if (prevPhase) setCompletedPhases((prev) => new Set([...prev, prevPhase]));
          setPipelinePhase(data.phase);
          if (data.phase === "drafting") setModalOpen(true);
          if (!isRetry) setPipelineGenerationId(data.generationId);
        } else if (evt === "chunk") {
          accumulated += parsed["data"] as string;
          onDocGenerated(accumulated);
          setModalOpen(true);
        } else if (evt === "audit") {
          const data = parsed["data"] as AuditResult;
          setAudit(data);
          setCompletedPhases((prev) => new Set([...prev, "auditing"]));
          setPipelinePhase(null);
        } else if (evt === "evidence") {
          // noop — classificação de precedentes registrada no backend
        } else if (evt === "error") {
          const data = parsed["data"] as { message: string; fatal: boolean };
          if (data.fatal) throw new Error(data.message);
        } else if ("generationId" in parsed) {
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
        if (parsed.chunk) {
          accumulated += parsed.chunk;
          onDocGenerated(accumulated);
          setModalOpen(true);
        }
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
            caseDescription: caseDescEdit.trim() || undefined,
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
    setModalOpen(true);

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
  const canGenerate  = mode === "pipeline"
    ? jurisprudencias.length > 0 && caseDescEdit.trim().length > 0
    : mode === "premium"
      ? pdfFiles.length > 0
      : jurisprudencias.length > 0;
  const showPipeline = mode === "pipeline";

  return (
    <>
      <div className="flex flex-col h-full min-h-0">

        {/* ── Controles (scrollável) ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Gerar documento
          </h2>

          {/* Seletor de modo */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-muted mb-3">
            {([
              ["pipeline", <Zap size={10} />,     "Pipeline"],
              ["padrao",   <FileText size={10} />, "Padrão"],
              ["premium",  <Sparkles size={10} />, "Avançado"],
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

          <div className="space-y-3">
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

            {/* Descrição do caso (pipeline only) */}
            {mode === "pipeline" && (
              <textarea
                value={caseDescEdit}
                onChange={(e) => setCaseDescEdit(e.target.value)}
                disabled={isGenerating}
                placeholder="Descreva o caso: partes, fatos relevantes, pedido pretendido..."
                rows={4}
                className={`w-full text-xs rounded-lg border px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 ${
                  caseDescEdit.trim().length === 0 ? "bg-destructive/5 border-destructive/40" : "bg-muted/30"
                }`}
              />
            )}

            {/* Instrução */}
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isGenerating}
              placeholder="Orientação para a IA (opcional): entendimento a aplicar, artigos relevantes..."
              rows={2}
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
                  A IA lê os documentos, busca a legislação e gera a peça fundamentada. Os PDFs não são salvos no servidor.
                </p>
              </div>
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
            {error    && <p className="text-xs text-destructive">{error}</p>}

            {/* Botão gerar / parar */}
            {isGenerating ? (
              <button
                onClick={() => { abortRef.current?.abort(); setStreaming(false); setRetrying(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                <Loader2 size={13} className="animate-spin" />
                Parar geração
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {mode === "pipeline" ? <Zap size={13} /> : mode === "premium" ? <Sparkles size={13} /> : <FileText size={13} />}
                {`Gerar ${DOCUMENT_TYPES[docType]!.toLowerCase()}`}
              </button>
            )}
          </div>
        </div>

        {/* ── Área de status (fixa em baixo) ────────────────────────────── */}
        <div className="flex-shrink-0 border-t p-4">
          {isGenerating ? (
            /* Progresso de fases durante a geração */
            showPipeline ? (
              <PhaseProgress currentPhase={pipelinePhase} completedPhases={completedPhases} />
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" />
                Gerando documento...
              </div>
            )
          ) : activeDoc ? (
            /* Documento pronto — badge + ações */
            <div className="space-y-2">
              {showPipeline && audit && <AuditBadge audit={audit} />}
              <button
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                <FileText size={13} />
                Ver documento
              </button>
              {showPipeline && audit && (audit.blocked ?? !audit.aprovada) && pipelineGenerationId && (
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  <RotateCcw size={13} />
                  Corrigir e regerar
                </button>
              )}
            </div>
          ) : (
            /* Estado vazio */
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              {mode === "premium"
                ? "Adicione PDFs, selecione decisões e clique em gerar."
                : mode === "pipeline"
                  ? "Selecione decisões e clique em gerar."
                  : "Selecione decisões e clique em gerar."}
            </p>
          )}
        </div>
      </div>

      {/* ── Modal do documento ─────────────────────────────────────────── */}
      <DocumentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        content={activeDoc ?? ""}
        isStreaming={isGenerating}
        pipelinePhase={pipelinePhase}
        completedPhases={completedPhases}
        audit={audit}
        showPipeline={showPipeline}
        copied={copied}
        onCopy={handleCopy}
        downloading={downloading}
        onDownload={handleDownload}
        mode={mode}
      />
    </>
  );
}
