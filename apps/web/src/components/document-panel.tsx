"use client";

import { useState, useRef } from "react";
import { FileText, Loader2, Copy, Check, Square, CheckSquare, Download } from "lucide-react";
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
  const [docType, setDocType] = useState<DocumentType>(allowedTypes[0]);
  const [instruction, setInstruction] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleGenerate() {
    if (jurisprudencias.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreaming(true);
    setError("");
    onDocGenerated(""); // limpa o conteúdo anterior

    try {
      const res = await fetch("/api/stream/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ caseId, type: docType, jurisprudencias, instruction: instruction.trim() || undefined }),
        signal: controller.signal,
      });

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

        const raw = decoder.decode(value, { stream: true });
        const lines = raw.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              chunk?: string;
              done?: boolean;
              error?: string;
            };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              onDocGenerated(accumulated);
            }
            if (parsed.done && (parsed as any).documentId) {
              onDocGenerated(accumulated, (parsed as any).documentId);
            }
          } catch {
            // linha SSE incompleta — ignora
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message ?? "Erro ao gerar documento.");
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setStreaming(false);
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
        ? await fetch(`/api/export/${activeDocId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
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

  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
        Gerar documento
      </h2>

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

        {/* Instrução do magistrado */}
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={streaming}
          placeholder="Orientação para a IA (opcional): entendimento a aplicar, artigos de lei relevantes, direcionamento da peça..."
          rows={3}
          className="w-full text-xs rounded-lg border bg-muted/30 px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />

        {/* Contador de selecionados */}
        <div
          className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-1.5 ${
            jurisprudencias.length === 0
              ? "text-muted-foreground bg-muted/50"
              : "text-foreground"
          }`}
        >
          {jurisprudencias.length === 0 ? (
            <Square size={12} />
          ) : (
            <CheckSquare size={12} className="text-primary" />
          )}
          {jurisprudencias.length === 0
            ? "Nenhuma decisão selecionada"
            : `${jurisprudencias.length} ${jurisprudencias.length > 1 ? "decisões selecionadas" : "decisão selecionada"}`}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Botão gerar / parar */}
        {streaming ? (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            <Loader2 size={13} className="animate-spin" />
            Parar geração
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={jurisprudencias.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <FileText size={13} />
            {`Gerar ${DOCUMENT_TYPES[docType].toLowerCase()}`}
          </button>
        )}
      </div>

      {/* Área do documento */}
      {activeDoc ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              Minuta gerada
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
                {downloading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Download size={12} />}
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
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
          Selecione decisões relevantes e clique em gerar para criar a minuta.
        </div>
      )}
    </div>
  );
}
