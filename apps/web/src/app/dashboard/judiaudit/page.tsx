"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/store/auth";
import {
  Star, AlertCircle, CheckCircle2, AlertTriangle,
  BarChart3, Shield, FileText, BookOpen, Gavel,
  TrendingUp, Sparkles, Scale, RefreshCw,
  Upload, ClipboardPaste, Zap, Brain,
  Clock, X, ChevronRight, Loader2, File,
} from "lucide-react";

// ── Tipos (espelho de packages/ai/src/audit-report/audit-report.types.ts) ─────

type AuditClassificacao = "EXCELENTE" | "BOA" | "REGULAR" | "CRITICA";
type AuditClassificacaoFinal = "VIAVEL" | "ATENCAO" | "RISCO_ELEVADO" | "CRITICA";
type AuditOrigem = "JUDICORE" | "UPLOAD" | "TEXTO_COLADO";
type AuditMode = "RAPIDA" | "COMPLETA";

interface AuditItem {
  titulo: string;
  descricao: string;
  regra?: string;
  severidade?: "FATAL" | "IMPORTANTE" | "SUGESTAO";
}
interface FundamentacaoItem {
  tipo: "ARTIGO" | "JURISPRUDENCIA" | "DIPLOMA";
  referencia: string;
  contexto?: string;
}
interface QualidadeScore { score: number; label: string; itens: AuditItem[] }
interface ConsistenciaArgumentativa {
  score: number;
  resultado: "CONSISTENTE" | "PARCIALMENTE CONSISTENTE" | "INCONSISTENTE";
  detalhes: AuditItem[];
}
interface QualidadeArgumentativa {
  score: number; normalizedScore: number; perfil: string;
  dimensoes: Array<{ label: string; score: number; max: number }>;
}
interface AuditReport {
  qualidadeTecnica: number;
  viabilidadeJuridica: number;
  classificacaoFinal: AuditClassificacaoFinal;
  motivoClassificacao?: string;
  scoreGeral: number; classificacao: AuditClassificacao;
  problemasFatais: AuditItem[]; problemasNaoFatais: AuditItem[];
  pontosFortes: AuditItem[]; sugestoesMelhoria: AuditItem[];
  fundamentacaoJuridica: FundamentacaoItem[]; riscosProcessuais: AuditItem[];
  consistenciaArgumentativa: ConsistenciaArgumentativa;
  qualidadeEstrutural: QualidadeScore; qualidadeProbatoria: QualidadeScore;
  qualidadeArgumentativa: QualidadeArgumentativa;
}
interface HistoryEntry {
  id: string; createdAt: string;
  origem: AuditOrigem; mode: AuditMode;
  scoreGeral: number; classificacao: AuditClassificacao;
  tipoPeca?: string; assuntoPrincipal?: string;
  fileFormat?: string; originalFilename?: string;
  report: AuditReport;
}
interface ActiveReport {
  entry: HistoryEntry;
}

// ── Cores ─────────────────────────────────────────────────────────────────────

const CLS: Record<AuditClassificacao, { ring: string; text: string; border: string; badge: string; badgeText: string }> = {
  EXCELENTE: { ring: "#10b981", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-100", badgeText: "text-emerald-800" },
  BOA:       { ring: "#3b82f6", text: "text-blue-700",    border: "border-blue-200",    badge: "bg-blue-100",    badgeText: "text-blue-800"    },
  REGULAR:   { ring: "#f59e0b", text: "text-amber-700",   border: "border-amber-200",   badge: "bg-amber-100",   badgeText: "text-amber-800"  },
  CRITICA:   { ring: "#ef4444", text: "text-red-700",     border: "border-red-200",     badge: "bg-red-100",     badgeText: "text-red-800"    },
};
const ORIGEM_LABEL: Record<AuditOrigem, string> = {
  JUDICORE: "JudiCore",
  UPLOAD: "Arquivo",
  TEXTO_COLADO: "Colado",
};
const ORIGEM_COLOR: Record<AuditOrigem, string> = {
  JUDICORE: "bg-violet-100 text-violet-700",
  UPLOAD: "bg-blue-100 text-blue-700",
  TEXTO_COLADO: "bg-slate-100 text-slate-600",
};

function scoreTextCls(s: number) {
  return s >= 85 ? "text-emerald-700" : s >= 70 ? "text-blue-700" : s >= 50 ? "text-amber-700" : "text-red-700";
}
function viabilidadeRingColor(v: number): string {
  return v >= 85 ? "#10b981" : v >= 70 ? "#f59e0b" : v >= 40 ? "#f97316" : "#ef4444";
}
function scoreRingColor(s: number): string {
  return s >= 85 ? "#10b981" : s >= 70 ? "#3b82f6" : s >= 50 ? "#f59e0b" : "#ef4444";
}
function qualidadeTecnicaLabel(s: number): string {
  return s >= 85 ? "Excelente" : s >= 70 ? "Boa" : s >= 50 ? "Regular" : "Fraca";
}
const CLS_FINAL: Record<AuditClassificacaoFinal, { text: string; badge: string; badgeText: string; label: string }> = {
  VIAVEL:        { text: "text-emerald-700", badge: "bg-emerald-100", badgeText: "text-emerald-800", label: "Viável" },
  ATENCAO:       { text: "text-amber-700",   badge: "bg-amber-100",   badgeText: "text-amber-800",   label: "Atenção" },
  RISCO_ELEVADO: { text: "text-orange-700",  badge: "bg-orange-100",  badgeText: "text-orange-800",  label: "Risco Elevado" },
  CRITICA:       { text: "text-red-700",     badge: "bg-red-100",     badgeText: "text-red-800",     label: "Crítica" },
};
function dimBarColor(pct: number) {
  return pct >= 0.8 ? "bg-emerald-500" : pct >= 0.6 ? "bg-blue-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-400";
}
const CONSISTENCIA_BADGE: Record<string, string> = {
  "CONSISTENTE": "bg-emerald-100 text-emerald-800",
  "PARCIALMENTE CONSISTENTE": "bg-amber-100 text-amber-800",
  "INCONSISTENTE": "bg-red-100 text-red-800",
};
const FUND_COLOR: Record<string, string> = {
  ARTIGO: "bg-blue-50 text-blue-700 border-blue-100",
  JURISPRUDENCIA: "bg-violet-50 text-violet-700 border-violet-100",
  DIPLOMA: "bg-emerald-50 text-emerald-700 border-emerald-100",
};
const FUND_LABEL: Record<string, string> = { ARTIGO: "Art.", JURISPRUDENCIA: "Prec.", DIPLOMA: "Lei" };
const TIPO_PECA_LABEL: Record<string, string> = {
  PETICAO_INICIAL: "Petição Inicial",
  RECURSO:         "Recurso",
  SENTENCA:        "Sentença",
  DECISAO:         "Decisão",
  DESPACHO:        "Despacho",
};

// ── Score Circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ score, color, size = "lg" }: { score: number; color: string; size?: "sm" | "lg" }) {
  const cfg = size === "sm"
    ? { r: 40, cx: 48, cy: 48, vb: "0 0 96 96", wh: "w-24 h-24", textCls: "text-3xl", sw: 8 }
    : { r: 54, cx: 64, cy: 64, vb: "0 0 128 128", wh: "w-36 h-36", textCls: "text-4xl", sw: 10 };
  const circ = 2 * Math.PI * cfg.r;
  const dash  = (score / 100) * circ;
  return (
    <div className={`relative ${cfg.wh} flex items-center justify-center`}>
      <svg className="absolute inset-0 -rotate-90" viewBox={cfg.vb} aria-hidden>
        <circle cx={cfg.cx} cy={cfg.cy} r={cfg.r} fill="none" stroke="#f1f5f9" strokeWidth={cfg.sw} />
        <circle cx={cfg.cx} cy={cfg.cy} r={cfg.r} fill="none" stroke={color} strokeWidth={cfg.sw}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div className="relative flex flex-col items-center select-none">
        <span className={`${cfg.textCls} font-bold text-slate-900 leading-none tabular-nums`}>{score}</span>
        <span className="text-xs text-slate-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── History helpers ───────────────────────────────────────────────────────────

const HISTORY_KEY = "judiaudit_history";
const REPORT_KEY  = "judiaudit_last_report";
const MAX_HISTORY = 12;

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[]; } catch { return []; }
}
function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
function pushHistory(entry: HistoryEntry, current: HistoryEntry[]): HistoryEntry[] {
  return [entry, ...current.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JudiAuditPage() {
  const { user, token } = useAuthStore();
  const [active, setActive] = useState<ActiveReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Form state
  const [inputTab, setInputTab]     = useState<"file" | "text">("file");
  const [mode, setMode]             = useState<AuditMode>("COMPLETA");
  const [selectedFile, setFile]     = useState<File | null>(null);
  const [pastedText, setPasted]     = useState("");
  const [isDragging, setDragging]   = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [analyzeErr, setErr]        = useState("");
  const [phase, setPhase]           = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load persisted data ─────────────────────────────────────────────────
  useEffect(() => {
    const hist = loadHistory();
    setHistory(hist);

    // Load last pipeline report (from JudiCore generation)
    try {
      const raw = localStorage.getItem(REPORT_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as {
          report: AuditReport; generatedAt: string;
          tipoPeca?: string; assuntoPrincipal?: string;
        };
        const entry: HistoryEntry = {
          id: `judicore_${stored.generatedAt}`,
          createdAt: stored.generatedAt,
          origem: "JUDICORE",
          mode: "COMPLETA",
          scoreGeral: stored.report.scoreGeral,
          classificacao: stored.report.classificacao,
          ...(stored.tipoPeca        ? { tipoPeca: stored.tipoPeca }               : {}),
          ...(stored.assuntoPrincipal? { assuntoPrincipal: stored.assuntoPrincipal}: {}),
          report: stored.report,
        };
        // Only set as active if no other active
        setActive({ entry });
        // Add to history if not already present
        setHistory((h) => {
          const next = pushHistory(entry, h);
          saveHistory(next);
          return next;
        });
      }
    } catch {}
  }, []);

  // ── File handling ───────────────────────────────────────────────────────
  const onFileChange = useCallback((file: File | null) => {
    setFile(file);
    setErr("");
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileChange(f);
  }, [onFileChange]);

  // ── Analyze ─────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!token) { setErr("Sessão expirada. Faça login novamente."); return; }

    const hasFile = inputTab === "file" && selectedFile;
    const hasText = inputTab === "text" && pastedText.trim().length >= 100;
    if (!hasFile && !hasText) {
      setErr(inputTab === "file" ? "Selecione um arquivo." : "Cole pelo menos 100 caracteres de texto.");
      return;
    }

    setAnalyzing(true); setErr(""); setPhase("");

    const phaseLabels: Record<AuditMode, string[]> = {
      RAPIDA:   ["Analisando documento..."],
      COMPLETA: ["Classificando...", "Extraindo informações...", "Auditando com IA..."],
    };

    let phaseIdx = 0;
    const phaseTimer = mode === "COMPLETA" ? setInterval(() => {
      const labels = phaseLabels[mode];
      phaseIdx = Math.min(phaseIdx + 1, labels.length - 1);
      setPhase(labels[phaseIdx] ?? "");
    }, 8000) : null;

    setPhase(phaseLabels[mode][0] ?? "");

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      if (hasFile) {
        formData.append("file", selectedFile!);
      } else {
        formData.append("text", pastedText.trim());
      }

      const res = await fetch("/api/audit/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const body = await res.json() as {
        report?: AuditReport;
        meta?: { tipoPeca?: string; assuntoPrincipal?: string; regimeJuridico?: string; fileFormat?: string; originalFilename?: string };
        origem?: AuditOrigem;
        error?: string;
      };

      if (!res.ok || body.error) {
        setErr(body.error ?? `Erro ${res.status}`);
        return;
      }

      const report = body.report!;
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        origem: body.origem ?? (hasFile ? "UPLOAD" : "TEXTO_COLADO"),
        mode,
        scoreGeral: report.scoreGeral,
        classificacao: report.classificacao,
        ...(body.meta?.tipoPeca          ? { tipoPeca: body.meta.tipoPeca }                               : {}),
        ...(body.meta?.assuntoPrincipal  ? { assuntoPrincipal: body.meta.assuntoPrincipal }               : {}),
        ...(body.meta?.fileFormat        ? { fileFormat: body.meta.fileFormat }                           : {}),
        ...(body.meta?.originalFilename ?? selectedFile?.name
          ? { originalFilename: body.meta?.originalFilename ?? selectedFile!.name }
          : {}),
        report,
      };

      setHistory((h) => { const next = pushHistory(entry, h); saveHistory(next); return next; });
      setActive({ entry });
      setFile(null);
      setPasted("");

    } catch (err: unknown) {
      setErr(`Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (phaseTimer) clearInterval(phaseTimer);
      setAnalyzing(false);
      setPhase("");
    }
  }

  // ── Report rendering ────────────────────────────────────────────────────

  function renderReport(r: AuditReport, entry: HistoryEntry) {
    const cls = CLS[r.classificacao];
    return (
      <div className="space-y-4">

        {/* Meta strip */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
          <span>{new Date(entry.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span>·</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${ORIGEM_COLOR[entry.origem]}`}>{ORIGEM_LABEL[entry.origem]}</span>
          {entry.tipoPeca && <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{TIPO_PECA_LABEL[entry.tipoPeca] ?? entry.tipoPeca}</span>}
          {entry.originalFilename && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full truncate max-w-[200px]">{entry.originalFilename}</span>}
          {entry.mode === "RAPIDA" && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Zap size={10} />Rápida</span>}
        </div>

        {/* Score + Quality Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* ── Dois scores separados — FASE 5.0.2 ─────────────────── */}
          <div className="md:col-span-2 grid grid-cols-2 gap-3">

            {/* Qualidade Técnica */}
            <div className="bg-white border border-border rounded-2xl p-4 flex flex-col items-center gap-3 shadow-sm">
              <ScoreCircle score={r.qualidadeTecnica ?? r.scoreGeral} color={scoreRingColor(r.qualidadeTecnica ?? r.scoreGeral)} size="sm" />
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Qualidade Técnica</p>
                <span className={`text-xs font-semibold ${scoreTextCls(r.qualidadeTecnica ?? r.scoreGeral)}`}>
                  {qualidadeTecnicaLabel(r.qualidadeTecnica ?? r.scoreGeral)}
                </span>
              </div>
            </div>

            {/* Viabilidade Jurídica */}
            <div className="bg-white border border-border rounded-2xl p-4 flex flex-col items-center gap-3 shadow-sm">
              <ScoreCircle score={r.viabilidadeJuridica ?? 100} color={viabilidadeRingColor(r.viabilidadeJuridica ?? 100)} size="sm" />
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Viabilidade Jurídica</p>
                {(() => {
                  const cf = (r.classificacaoFinal ?? (r.problemasFatais.length > 0 ? "CRITICA" : "VIAVEL")) as AuditClassificacaoFinal;
                  const cfCls = CLS_FINAL[cf];
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfCls.badge} ${cfCls.badgeText}`}>
                      {cfCls.label}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-2.5">
            {[
              { icon: <Scale size={13} />, label: "Consistência", score: r.consistenciaArgumentativa.score, sub: r.consistenciaArgumentativa.resultado },
              { icon: <FileText size={13} />, label: "Estrutural", score: r.qualidadeEstrutural.score, sub: r.qualidadeEstrutural.label },
              { icon: <Gavel size={13} />, label: "Probatória", score: r.qualidadeProbatoria.score, sub: r.qualidadeProbatoria.label },
              { icon: <BarChart3 size={13} />, label: "Argumentativa", score: r.qualidadeArgumentativa.score, sub: r.qualidadeArgumentativa.perfil },
            ].map(({ icon, label, score, sub }) => (
              <div key={label} className="bg-white border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2 text-slate-400">{icon}<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p></div>
                <p className={`text-2xl font-bold tabular-nums ${scoreTextCls(score)}`}>{score}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de problema crítico */}
        {r.motivoClassificacao && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-800">Problema crítico: {r.motivoClassificacao}</p>
          </div>
        )}

        {/* Argumentativa bars */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-violet-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Qualidade Argumentativa</h3>
            <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{r.qualidadeArgumentativa.perfil}</span>
            {r.qualidadeArgumentativa.normalizedScore > r.qualidadeArgumentativa.score && (
              <span className="text-xs text-blue-600 font-semibold">norm. {r.qualidadeArgumentativa.normalizedScore}</span>
            )}
          </div>
          <div className="space-y-3">
            {r.qualidadeArgumentativa.dimensoes.map((d) => {
              const pct = d.max > 0 ? d.score / d.max : 0;
              return (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{d.label}</span>
                    <span className="text-slate-400 font-mono">{d.score}<span className="text-slate-300">/{d.max}</span> <span className="text-slate-400">{Math.round(pct * 100)}%</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${dimBarColor(pct)}`} style={{ width: `${Math.round(pct * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Problemas + Avisos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {r.problemasFatais.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><AlertCircle size={14} className="text-red-600" /><h3 className="font-semibold text-red-800 text-sm">Problemas Fatais</h3><span className="ml-auto bg-red-200 text-red-900 text-xs font-bold px-2 py-0.5 rounded-full">{r.problemasFatais.length}</span></div>
              <div className="space-y-2">
                {r.problemasFatais.map((p, i) => (
                  <div key={i} className="bg-white/70 rounded-xl p-3"><p className="text-xs font-semibold text-red-900">{p.titulo}</p><p className="text-xs text-red-700 mt-0.5 line-clamp-2">{p.descricao}</p></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <p className="font-semibold text-emerald-800 text-sm">Sem problemas fatais</p>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-amber-600" /><h3 className="font-semibold text-amber-800 text-sm">Avisos</h3><span className="ml-auto bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">{r.problemasNaoFatais.length}</span></div>
            {r.problemasNaoFatais.length > 0 ? (
              <div className="space-y-2">
                {r.problemasNaoFatais.slice(0, 5).map((p, i) => (
                  <div key={i} className="bg-white/70 rounded-xl p-3"><p className="text-xs font-semibold text-amber-900">{p.titulo}</p><p className="text-xs text-amber-700 mt-0.5 line-clamp-2">{p.descricao}</p></div>
                ))}
                {r.problemasNaoFatais.length > 5 && <p className="text-xs text-amber-600 text-center">+{r.problemasNaoFatais.length - 5} adicionais</p>}
              </div>
            ) : <p className="text-xs text-amber-700">Nenhum aviso encontrado.</p>}
          </div>
        </div>

        {/* Pontos Fortes + Riscos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><Sparkles size={14} className="text-violet-500" /><h3 className="font-semibold text-slate-800 text-sm">Pontos Fortes</h3></div>
            <div className="space-y-2">
              {r.pontosFortes.length > 0 ? r.pontosFortes.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-700">{p.titulo}</p>
                </div>
              )) : <p className="text-xs text-slate-400">Nenhum ponto forte identificado.</p>}
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><Shield size={14} className="text-red-400" /><h3 className="font-semibold text-slate-800 text-sm">Riscos Processuais</h3></div>
            {r.riscosProcessuais.length > 0 ? (
              <div className="space-y-2">
                {r.riscosProcessuais.map((rk, i) => (
                  <div key={i} className={`rounded-xl p-2.5 border ${rk.severidade === "FATAL" ? "bg-red-50 border-red-100" : "bg-orange-50 border-orange-100"}`}>
                    <p className={`text-xs font-semibold ${rk.severidade === "FATAL" ? "text-red-800" : "text-orange-800"}`}>{rk.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rk.descricao}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={13} /><p className="text-xs font-medium">Nenhum risco identificado</p></div>
            )}
          </div>
        </div>

        {/* Fundamentação */}
        {r.fundamentacaoJuridica.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><BookOpen size={14} className="text-slate-400" /><h3 className="font-semibold text-slate-800 text-sm">Fundamentação Jurídica</h3><span className="ml-auto text-xs text-slate-400">{r.fundamentacaoJuridica.length} referências</span></div>
            <div className="flex flex-wrap gap-1.5">
              {r.fundamentacaoJuridica.map((f, i) => (
                <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${FUND_COLOR[f.tipo]}`}>
                  <span className="opacity-50 text-[9px]">{FUND_LABEL[f.tipo]}</span>
                  {f.referencia.length > 40 ? f.referencia.slice(0, 40) + "…" : f.referencia}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sugestões */}
        {r.sugestoesMelhoria.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-blue-500" /><h3 className="font-semibold text-slate-800 text-sm">Sugestões de Melhoria</h3></div>
            <ol className="space-y-3">
              {r.sugestoesMelhoria.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div><p className="text-xs font-semibold text-slate-700">{s.titulo}</p><p className="text-xs text-slate-500 mt-0.5">{s.descricao}</p></div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">
            <Star size={20} className="text-violet-500" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-display leading-none">JudiAudit</h1>
              <p className="text-xs text-slate-400 mt-0.5">Auditoria jurídica inteligente de minutas processuais</p>
            </div>
          </div>

          {/* ── Nova Auditoria ───────────────────────────────────── */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Nova Auditoria</h2>

            {/* Input tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 w-fit">
              {([["file", <Upload size={13} />, "Arquivo"], ["text", <ClipboardPaste size={13} />, "Colar Texto"]] as const).map(([tab, icon, label]) => (
                <button key={tab} onClick={() => { setInputTab(tab); setErr(""); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${inputTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* File upload zone */}
            {inputTab === "file" && (
              <div
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging ? "border-violet-400 bg-violet-50" : selectedFile ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.odt,.txt,.html,.htm,.rtf"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <File size={20} className="text-emerald-500" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-emerald-700">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">Arraste ou clique para selecionar</p>
                    <p className="text-xs text-slate-400 mt-1">PDF · DOCX · ODT · TXT · HTML · RTF</p>
                    <p className="text-xs text-slate-300 mt-0.5">.doc (Word antigo): salve como DOCX primeiro</p>
                  </>
                )}
              </div>
            )}

            {/* Paste text */}
            {inputTab === "text" && (
              <textarea
                value={pastedText}
                onChange={(e) => { setPasted(e.target.value); setErr(""); }}
                placeholder="Cole aqui o texto completo da peça jurídica..."
                className="w-full h-40 px-3 py-2.5 text-sm border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 text-slate-700 placeholder-slate-300"
              />
            )}

            {/* Mode + Analyze */}
            <div className="flex items-center gap-3 mt-4">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setMode("RAPIDA")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "RAPIDA" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Zap size={12} />Rápida
                </button>
                <button onClick={() => setMode("COMPLETA")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "COMPLETA" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Brain size={12} />Completa
                </button>
              </div>

              <p className="text-xs text-slate-400">
                {mode === "RAPIDA" ? "Verificação rápida sem IA · resultado imediato" : "Classificação + extração + auditoria com IA"}
              </p>

              <button onClick={handleAnalyze} disabled={analyzing}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                {analyzing ? <><Loader2 size={14} className="animate-spin" />{phase || "Analisando..."}</> : <><Star size={14} />Analisar</>}
              </button>
            </div>

            {analyzeErr && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {analyzeErr}
              </p>
            )}
          </div>

          {/* ── Resultado + Histórico ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Histórico — coluna lateral */}
            {history.length > 0 && (
              <div className="lg:col-span-1 space-y-2">
                <div className="flex items-baseline gap-2 px-1">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Histórico</h3>
                  <span className="text-[9px] text-slate-400">Tec. · Jur.</span>
                </div>
                {history.map((entry) => {
                  const cls = CLS[entry.classificacao];
                  const isActive = active?.entry.id === entry.id;
                  return (
                    <button key={entry.id} onClick={() => setActive({ entry })}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                        isActive ? "border-violet-200 bg-violet-50" : "border-transparent bg-white hover:bg-slate-50 hover:border-slate-200"
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-xs font-bold tabular-nums ${scoreTextCls(entry.report?.qualidadeTecnica ?? entry.scoreGeral)}`}>
                          T:{entry.report?.qualidadeTecnica ?? entry.scoreGeral}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${scoreTextCls(entry.report?.viabilidadeJuridica ?? 100)}`}>
                          J:{entry.report?.viabilidadeJuridica ?? "—"}
                        </span>
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full ${ORIGEM_COLOR[entry.origem]}`}>{ORIGEM_LABEL[entry.origem]}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{entry.assuntoPrincipal ?? entry.tipoPeca ?? "—"}</p>
                      <p className="text-[9px] text-slate-300 mt-0.5 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(entry.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resultado principal */}
            <div className={history.length > 0 ? "lg:col-span-3" : "lg:col-span-4"}>
              {active ? (
                renderReport(active.entry.report, active.entry)
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                    <Star size={26} className="text-violet-300" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">Nenhuma auditoria disponível</p>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Envie um arquivo, cole um texto ou gere uma peça pelo módulo <strong className="text-slate-600">Pesquisa</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
