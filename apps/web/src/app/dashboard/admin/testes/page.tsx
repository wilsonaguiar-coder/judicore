"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  X,
  FlaskConical,
  Beaker,
} from "lucide-react";

interface ReportFileInfo {
  size: number;
  mtime: string;
}
interface ReportsListing {
  legal: Record<string, ReportFileInfo | null>;
  quality: Record<string, ReportFileInfo | null>;
}

type LogLine = { line: string; stderr: boolean };

export default function TestesPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();

  // Reports listing
  const [reports, setReports] = useState<ReportsListing | null>(null);

  // Modal de visualização
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");

  // Estado dos runs
  const [legalRunning, setLegalRunning] = useState(false);
  const [legalLog, setLegalLog] = useState<LogLine[]>([]);
  const [legalExit, setLegalExit] = useState<number | null>(null);

  const [qualityRunning, setQualityRunning] = useState(false);
  const [qualityLog, setQualityLog] = useState<LogLine[]>([]);
  const [qualityExit, setQualityExit] = useState<number | null>(null);

  const [reportRunning, setReportRunning] = useState(false);

  // Config do quality:run
  const [count, setCount] = useState(10);
  const [maxCostUsd, setMaxCostUsd] = useState(5);
  const [area, setArea] = useState<string>("");
  const [documentType, setDocumentType] = useState<string>("");

  // Auth gate
  useEffect(() => {
    if (user && user.role !== "ADMIN") router.push("/dashboard");
  }, [user, router]);

  const refreshReports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<ReportsListing>("/admin/testes/reports", token);
      setReports(data);
    } catch (err) {
      console.error("Falha ao listar relatórios:", err);
    }
  }, [token]);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  // ── SSE runner ──────────────────────────────────────────────────────────────

  async function runSSE(
    path: string,
    body: unknown,
    onLog: (line: LogLine) => void,
    onDone: (exitCode: number | null) => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      onError(j.error ?? `HTTP ${res.status}`);
      onDone(null);
      return;
    }
    if (!res.body) {
      onError("Stream indisponível");
      onDone(null);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastEvent = "log";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) lastEvent = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }
        if (lastEvent === "log") onLog(parsed as LogLine);
        else if (lastEvent === "start") onLog({ line: `▶ ${(parsed as any).command}`, stderr: false });
        else if (lastEvent === "done") onDone((parsed as any).exitCode ?? null);
        else if (lastEvent === "error") onError((parsed as any).message ?? "Erro desconhecido");
      }
    }
    onDone(null);
  }

  async function runLegal() {
    setLegalLog([]);
    setLegalExit(null);
    setLegalRunning(true);
    await runSSE(
      "/admin/testes/run-legal",
      null,
      (line) => setLegalLog((prev) => [...prev, line]),
      (code) => {
        setLegalExit(code);
        setLegalRunning(false);
        void refreshReports();
      },
      (msg) => setLegalLog((prev) => [...prev, { line: `❌ ${msg}`, stderr: true }]),
    );
  }

  async function runQuality() {
    setQualityLog([]);
    setQualityExit(null);
    setQualityRunning(true);
    const body: Record<string, unknown> = { count, maxCostUsd };
    if (area) body.area = area;
    if (documentType) body.documentType = documentType;
    await runSSE(
      "/admin/testes/run-quality",
      body,
      (line) => setQualityLog((prev) => [...prev, line]),
      (code) => {
        setQualityExit(code);
        setQualityRunning(false);
        void refreshReports();
      },
      (msg) => setQualityLog((prev) => [...prev, { line: `❌ ${msg}`, stderr: true }]),
    );
  }

  async function generateQualityReport() {
    setReportRunning(true);
    setQualityLog((prev) => [...prev, { line: "▶ Gerando report.html / report.json...", stderr: false }]);
    await runSSE(
      "/admin/testes/quality-report",
      null,
      (line) => setQualityLog((prev) => [...prev, line]),
      () => {
        setReportRunning(false);
        void refreshReports();
      },
      (msg) => setQualityLog((prev) => [...prev, { line: `❌ ${msg}`, stderr: true }]),
    );
  }

  function openReport(kind: "legal" | "quality", file: string, title: string) {
    if (!token) return;
    // Usa um Blob URL para passar o token via fetch, pois iframe não envia Authorization
    void (async () => {
      const res = await fetch(`/api/admin/testes/reports/${kind}/${file}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert(`Erro ao carregar relatório: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setModalUrl(url);
      setModalTitle(title);
    })();
  }

  function closeModal() {
    if (modalUrl) URL.revokeObjectURL(modalUrl);
    setModalUrl(null);
    setModalTitle("");
  }

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar user={user} />
      <main className="flex-1 px-8 py-6 overflow-y-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="text-blue-600" size={28} />
            Testes & Quality Lab
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Regressão técnica e avaliação prática em massa do motor jurídico.
          </p>
        </header>

        {/* ── Test:legal ──────────────────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical size={20} className="text-emerald-600" />
                Regressão técnica
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Roda <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">pnpm test:legal</code> — 44 testes
                de validadores + pipeline mockado. Sem custo de OpenAI. ~1s.
              </p>
            </div>
            <button
              onClick={runLegal}
              disabled={legalRunning}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {legalRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {legalRunning ? "Rodando..." : "Rodar testes"}
            </button>
          </div>

          {(legalLog.length > 0 || legalExit !== null) && (
            <div className="mt-4">
              {legalExit !== null && (
                <div
                  className={`mb-2 flex items-center gap-2 text-sm font-medium ${
                    legalExit === 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {legalExit === 0 ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  Encerrado — exit code {legalExit}
                </div>
              )}
              <LogView lines={legalLog} />
              {reports?.legal["report.html"] && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openReport("legal", "report.html", "Test:legal — Relatório HTML")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium"
                  >
                    <Eye size={13} /> Ver HTML
                  </button>
                  <button
                    onClick={() => openReport("legal", "report.json", "Test:legal — JSON")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                  >
                    <FileText size={13} /> Ver JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Quality:run ─────────────────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Beaker size={20} className="text-amber-600" />
                Quality Lab — Avaliação prática
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Gera casos sintéticos e roda o pipeline real (com OpenAI). Custo controlado.
                Cada caso ~$0.05–0.10 e demora ~30–60s.
              </p>
            </div>
            <button
              onClick={runQuality}
              disabled={qualityRunning}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {qualityRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {qualityRunning ? "Rodando..." : "Rodar quality"}
            </button>
          </div>

          {/* Form */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nº de casos (1–100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                disabled={qualityRunning}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Custo estimado: ~${(count * 0.07).toFixed(2)}–${(count * 0.10).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Custo máximo (USD)
              </label>
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={maxCostUsd}
                onChange={(e) => setMaxCostUsd(Math.max(0.5, Math.min(50, Number(e.target.value) || 0.5)))}
                disabled={qualityRunning}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Aborta a execução se o custo passar deste valor.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Área (opcional)
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={qualityRunning}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Todas as áreas</option>
                <option value="RPPS">RPPS</option>
                <option value="RGPS">RGPS</option>
                <option value="TRABALHISTA">Trabalhista</option>
                <option value="CRIMINAL">Criminal (cautelar)</option>
                <option value="CRIMINAL_MERITO">Criminal (mérito)</option>
                <option value="CIVEL">Cível (todas as sub-áreas)</option>
                <option value="CIVEL_GERAL">Cível Geral</option>
                <option value="CONSUMIDOR">Consumidor (CDC)</option>
                <option value="FAZENDA_PUBLICA">Fazenda Pública</option>
                <option value="EXECUCAO_CUMPRIMENTO">Execução / Cumprimento</option>
                <option value="JEF_CIVEL">JEF Cível (Lei 9.099/95)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Peça (opcional)
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={qualityRunning}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Todas as peças</option>
                <option value="SENTENCA">Sentença</option>
                <option value="DECISAO">Decisão</option>
                <option value="RECURSO">Recurso</option>
                <option value="PETICAO_INICIAL">Petição Inicial</option>
                <option value="DESPACHO">Despacho</option>
              </select>
            </div>
          </div>

          {(qualityLog.length > 0 || qualityExit !== null) && (
            <div className="mt-4">
              {qualityExit !== null && (
                <div
                  className={`mb-2 flex items-center gap-2 text-sm font-medium ${
                    qualityExit === 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {qualityExit === 0 ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  Encerrado — exit code {qualityExit}
                </div>
              )}
              <LogView lines={qualityLog} />
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={generateQualityReport}
                  disabled={reportRunning || qualityRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 rounded-md font-medium"
                >
                  {reportRunning ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Gerar relatório
                </button>
                {reports?.quality["report.html"] && (
                  <button
                    onClick={() => openReport("quality", "report.html", "Quality Lab — Relatório HTML")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md font-medium"
                  >
                    <Eye size={13} /> Ver HTML
                  </button>
                )}
                {reports?.quality["results.json"] && (
                  <button
                    onClick={() => openReport("quality", "results.json", "Quality Lab — results.json")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                  >
                    <FileText size={13} /> results.json
                  </button>
                )}
                {reports?.quality["report.json"] && (
                  <button
                    onClick={() => openReport("quality", "report.json", "Quality Lab — report.json")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                  >
                    <FileText size={13} /> report.json
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Relatórios disponíveis ─────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Relatórios em disco</h2>
          <div className="grid grid-cols-2 gap-4">
            <ReportCard
              title="Test:legal"
              files={reports?.legal ?? {}}
              kind="legal"
              onOpen={openReport}
            />
            <ReportCard
              title="Quality Lab"
              files={reports?.quality ?? {}}
              kind="quality"
              onOpen={openReport}
            />
          </div>
        </section>
      </main>

      {/* ── Modal de visualização ─────────────────────────────────────────── */}
      {modalUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">{modalTitle}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={modalUrl}
                  download
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                >
                  Baixar
                </a>
                <button
                  onClick={closeModal}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={modalUrl} className="flex-1 w-full bg-white" title={modalTitle} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ───────────────────────────────────────────────────

function LogView({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={ref}
      className="bg-slate-900 text-slate-100 text-xs font-mono p-3 rounded-md max-h-80 overflow-y-auto"
    >
      {lines.length === 0 ? (
        <span className="text-slate-500">Aguardando saída...</span>
      ) : (
        lines.map((l, i) => (
          <div key={i} className={l.stderr ? "text-red-300" : ""}>
            {l.line}
          </div>
        ))
      )}
    </div>
  );
}

function ReportCard({
  title,
  files,
  kind,
  onOpen,
}: {
  title: string;
  files: Record<string, ReportFileInfo | null>;
  kind: "legal" | "quality";
  onOpen: (kind: "legal" | "quality", file: string, title: string) => void;
}) {
  const fileList = Object.entries(files);
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
      {fileList.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum arquivo disponível ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {fileList.map(([file, info]) => (
            <li key={file} className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => info && onOpen(kind, file, `${title} — ${file}`)}
                  disabled={!info}
                  className="text-xs text-left truncate text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {file}
                </button>
                {info && (
                  <p className="text-[10px] text-slate-500">
                    {(info.size / 1024).toFixed(1)} KB · {new Date(info.mtime).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              {!info && <span className="text-[10px] text-slate-400">não gerado</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
