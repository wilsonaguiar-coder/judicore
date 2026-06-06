"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/store/auth";
import { ArrowLeft, FileText, Upload, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "odt", "txt", "html", "htm", "rtf"];
const SUPPORTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/html",
  "application/rtf",
  "text/rtf",
];
const MAX_SIZE_MB = 20;

type Mode = "paste" | "upload";

type ProgressStep = "upload" | "extraction" | "normalization" | "session";
const STEPS: { id: ProgressStep; label: string }[] = [
  { id: "upload",       label: "Upload" },
  { id: "extraction",   label: "Extração" },
  { id: "normalization",label: "Normalização" },
  { id: "session",      label: "Criação da Auditoria" },
];

function isFileSupported(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    SUPPORTED_MIME.some(m => file.type.toLowerCase().includes(m.toLowerCase())) ||
    SUPPORTED_EXTENSIONS.includes(ext)
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Progress indicator ────────────────────────────────────────────────────────

function IngestionProgress({
  activeStep,
  done,
}: {
  activeStep: ProgressStep | null;
  done: boolean;
}) {
  const activeIndex = activeStep ? STEPS.findIndex(s => s.id === activeStep) : -1;

  return (
    <div className="flex items-center gap-2 py-4">
      {STEPS.map((step, i) => {
        const isCompleted = done || i < activeIndex;
        const isActive    = !done && i === activeIndex;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${isCompleted ? "bg-emerald-500 text-white"
                    : isActive ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-400"
                  }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={16} />
                ) : isActive ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs text-center leading-tight ${
                  isCompleted ? "text-emerald-600 font-medium"
                    : isActive ? "text-blue-600 font-semibold"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mt-[-10px] transition-colors ${
                  i < activeIndex || done ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  file,
  onFile,
  onClear,
  disabled,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [disabled, onFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  if (file) {
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{file.name}</p>
            <p className="text-xs text-slate-500">{ext} · {formatBytes(file.size)}</p>
          </div>
        </div>
        {!disabled && (
          <button
            onClick={onClear}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none
        ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Upload size={32} className="mx-auto text-slate-400 mb-3" />
      <p className="text-sm font-medium text-slate-600 mb-1">Arraste arquivos ou clique para selecionar</p>
      <p className="text-xs text-slate-400">
        {SUPPORTED_EXTENSIONS.map(e => e.toUpperCase()).join(" · ")} · Máx. {MAX_SIZE_MB} MB
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(",")}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NovaAuditoriaPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("paste");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState<ProgressStep | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    (mode === "paste" ? pastedText.trim().length > 0 : file !== null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    setDone(false);

    try {
      // Step 1: Upload
      setActiveStep("upload");

      const formData = new FormData();
      if (mode === "paste") {
        formData.append("text", pastedText);
      } else if (file) {
        // Client-side validations
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          throw new Error(`Formato não suportado: .${ext}. Formatos aceitos: ${SUPPORTED_EXTENSIONS.join(", ")}.`);
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          throw new Error(`Arquivo muito grande. Limite: ${MAX_SIZE_MB} MB. Arquivo: ${formatBytes(file.size)}.`);
        }
        formData.append("file", file);
      }

      // Step 2: Extraction (start fetch)
      setActiveStep("extraction");

      const res = await fetch("/api/review-studio/ingest", {
        method: "POST",
        body: formData,
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Resposta inesperada do servidor: ${text.slice(0, 120)}`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }

      // Step 3: Normalization (already done by API, just show progress)
      setActiveStep("normalization");
      await new Promise(r => setTimeout(r, 350));

      // Step 4: Session created
      setActiveStep("session");
      await new Promise(r => setTimeout(r, 400));

      setDone(true);
      await new Promise(r => setTimeout(r, 600));

      // Navigate to Review Studio using pieceId
      router.push(`/review-studio/${data.pieceId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar documento.";
      setError(msg);
      setSubmitting(false);
      setActiveStep(null);
      setDone(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold">Nova Auditoria</h1>
            <p className="text-xs text-muted-foreground">
              Envie uma peça jurídica ou cole o texto manualmente.
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">

            {/* Mode selector */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
              <button
                onClick={() => setMode("paste")}
                disabled={submitting}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === "paste"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Colar Texto
              </button>
              <button
                onClick={() => setMode("upload")}
                disabled={submitting}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === "upload"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Upload de Arquivo
              </button>
            </div>

            {/* Progress (visible during submission) */}
            {submitting && (
              <div className="mb-6 bg-white rounded-xl border border-slate-200 px-4 py-2 shadow-sm">
                <IngestionProgress activeStep={activeStep} done={done} />
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Mode 1: Paste text */}
            {mode === "paste" && (
              <div className="space-y-4">
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  disabled={submitting}
                  placeholder="Cole aqui sentença, decisão, despacho, recurso ou petição."
                  className="w-full h-72 px-4 py-3 text-sm border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 text-right">
                  {pastedText.length.toLocaleString("pt-BR")} caracteres
                </p>
              </div>
            )}

            {/* Mode 2: File upload */}
            {mode === "upload" && (
              <DropZone
                file={file}
                onFile={setFile}
                onClear={() => setFile(null)}
                disabled={submitting}
              />
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`mt-6 w-full py-3 rounded-xl text-sm font-semibold transition-all
                ${canSubmit
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[0.98]"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Processando...
                </span>
              ) : (
                "Executar Auditoria"
              )}
            </button>

            {/* Format hint */}
            {!submitting && (
              <p className="mt-4 text-xs text-center text-slate-400">
                Formatos aceitos: {SUPPORTED_EXTENSIONS.map(e => e.toUpperCase()).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
