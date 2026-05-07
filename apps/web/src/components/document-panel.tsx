"use client";

import { useState, useRef } from "react";
import { FileText, Loader2, Copy, Check, Square, CheckSquare, Download, Upload, X, Sparkles } from "lucide-react";
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

export function DocumentPanel({ caseId, token, userRole, jurisprudencias, activeDoc, activeDocId, onDocGenerated }: Props) {
  const allowedTypes = DOC_TYPES_BY_ROLE[userRole] ?? DOC_TYPES_BY_ROLE["COMUM"];
  const [mode, setMode] = useState<"padrao" | "premium">("padrao");
  const [docType, setDocType] = useState<DocumentType>(allowedTypes[0]);
  const [instruction, setInstruction] = useState("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter(
      (f) => f.type === "application/pdf" && f.size <= 5 * 1024 * 1024
    );
    setPdfFiles((prev) => [...prev, ...incoming].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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

  async function handleGenerate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setError("");
    setStatusMsg("");
    onDocGenerated("");

    try {
      let res: Response;
      if (mode === "premium") {
        if (pdfFiles.length === 0) { setError("Adicione pelo menos um PDF."); setStreaming(false); return; }
        const form = new FormData();
        form.append("type", docType);
        form.append("caseId", caseId);
        form.append("jurisprudencias", JSON.stringify(jurisprudencias));
        form.append("instruction", instruction.trim());
        pdfFiles.forEach((f) => form.append("files", f));
        res = await fetch("/api/stream/generate-premium", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: controller.signal,
        });
      } else {
        if (jurisprudencias.length === 0) { setStreaming(false); return; }
        res = await fetch("/api/stream/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ caseId, type: docType, jurisprudencias, instruction: instruction.trim() || undefined }),
          signal: controller.signal,
        });
      }
      await consumeStream(res);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Erro ao gerar documento.");
    } finally {
      setStreaming(false);
      setStatusMsg("");
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

  const canGenerate = mode === "premium" ? pdfFiles.length > 0 : jurisprudencias.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controles — max metade da coluna, rola internamente se necessário */}
      <div className="flex-shrink-0 overflow-y-auto p-4 border-b max-h-[55%]">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Gerar documento
      </h2>

      {/* Seletor de modo */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted mb-3">
        <button
          onClick={() => setMode("padrao")}
          disabled={streaming}
          className={`py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === "padrao" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText size={11} />
          Padrão
        </button>
        <button
          onClick={() => setMode("premium")}
          disabled={streaming}
          className={`py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === "premium" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles size={11} />
          Avançado
        </button>
      </div>

      <div className="space-y-3 mb-4">
        {/* Seletor de tipo */}
        <div className={`grid gap-1.5 p-1 rounded-lg bg-muted ${allowedTypes.length <= 3 ? "grid-cols-3" : "grid-cols-5"}`}>
          {allowedTypes.map((k) => (
            <button
              key={k}
              onClick={() => setDocType(k)}
              disabled={streaming}
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

        {/* Upload de PDFs (modo premium) */}
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
              disabled={streaming || pdfFiles.length >= 5}
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

        {/* Instrução */}
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={streaming}
          placeholder="Orientação para a IA (opcional): entendimento a aplicar, artigos relevantes, direcionamento..."
          rows={3}
          className="w-full text-xs rounded-lg border bg-muted/30 px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />

        {/* Contador de jurisprudências */}
        {mode === "padrao" && (
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
            {jurisprudencias.length} {jurisprudencias.length > 1 ? "decisões" : "decisão"} selecionada{jurisprudencias.length > 1 ? "s" : ""} como base
          </div>
        )}

        {statusMsg && <p className="text-xs text-primary animate-pulse">{statusMsg}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {streaming ? (
          <button
            onClick={() => { abortRef.current?.abort(); setStreaming(false); }}
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
            {mode === "premium" ? <Sparkles size={13} /> : <FileText size={13} />}
            {`Gerar ${DOCUMENT_TYPES[docType].toLowerCase()}`}
          </button>
        )}
      </div>
      </div>{/* fim controles */}

      {/* Área do documento — expande o restante da coluna */}
      {activeDoc ? (
        <div className="flex-1 flex flex-col min-h-0 p-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {mode === "premium" && <Sparkles size={10} className="text-primary" />}
              Documento gerado
              {streaming && <Loader2 size={10} className="animate-spin text-primary" />}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={streaming}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={handleDownload}
                disabled={streaming || !activeDoc || downloading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                title="Baixar como .docx"
              >
                {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                .docx
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-3">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
              {activeDoc}
              {streaming && <span className="inline-block w-1.5 h-3 bg-primary animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
          {mode === "premium"
            ? "Adicione os PDFs do processo, selecione decisões e clique em gerar."
            : "Selecione decisões relevantes e clique em gerar para criar a peça."}
        </div>
      )}
    </div>
  );
}
