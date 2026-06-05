"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/store/auth";
import {
  Star, AlertCircle, CheckCircle2, AlertTriangle,
  BarChart3, Shield, FileText, BookOpen, Gavel,
  TrendingUp, Sparkles, Scale, RefreshCw,
} from "lucide-react";

// ── Tipos (espelho de packages/ai/src/audit-report/audit-report.types.ts) ────

type AuditClassificacao = "EXCELENTE" | "BOA" | "REGULAR" | "CRITICA";

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

interface QualidadeScore {
  score: number;
  label: string;
  itens: AuditItem[];
}

interface ConsistenciaArgumentativa {
  score: number;
  resultado: "CONSISTENTE" | "PARCIALMENTE CONSISTENTE" | "INCONSISTENTE";
  detalhes: AuditItem[];
}

interface QualidadeArgumentativa {
  score: number;
  normalizedScore: number;
  perfil: string;
  dimensoes: Array<{ label: string; score: number; max: number }>;
}

interface AuditReport {
  scoreGeral: number;
  classificacao: AuditClassificacao;
  problemasFatais: AuditItem[];
  problemasNaoFatais: AuditItem[];
  pontosFortes: AuditItem[];
  sugestoesMelhoria: AuditItem[];
  fundamentacaoJuridica: FundamentacaoItem[];
  riscosProcessuais: AuditItem[];
  consistenciaArgumentativa: ConsistenciaArgumentativa;
  qualidadeEstrutural: QualidadeScore;
  qualidadeProbatoria: QualidadeScore;
  qualidadeArgumentativa: QualidadeArgumentativa;
}

interface StoredReport {
  report: AuditReport;
  generatedAt: string;
  tipoPeca?: string;
  assuntoPrincipal?: string;
}

// ── Helpers de cor ────────────────────────────────────────────────────────────

const CLS: Record<AuditClassificacao, {
  ring: string; text: string; bg: string; border: string; badge: string; badgeText: string;
}> = {
  EXCELENTE: { ring: "#10b981", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", badge: "bg-emerald-100", badgeText: "text-emerald-800" },
  BOA:       { ring: "#3b82f6", text: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    badge: "bg-blue-100",    badgeText: "text-blue-800"    },
  REGULAR:   { ring: "#f59e0b", text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   badge: "bg-amber-100",   badgeText: "text-amber-800"  },
  CRITICA:   { ring: "#ef4444", text: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     badge: "bg-red-100",     badgeText: "text-red-800"    },
};

function scoreTextCls(score: number): string {
  if (score >= 85) return "text-emerald-700";
  if (score >= 70) return "text-blue-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function scoreBorderCls(score: number): string {
  if (score >= 85) return "border-emerald-100";
  if (score >= 70) return "border-blue-100";
  if (score >= 50) return "border-amber-100";
  return "border-red-100";
}

function dimBarColor(pct: number): string {
  if (pct >= 0.8) return "bg-emerald-500";
  if (pct >= 0.6) return "bg-blue-500";
  if (pct >= 0.4) return "bg-amber-500";
  return "bg-red-400";
}

const CONSISTENCIA_BADGE: Record<string, string> = {
  "CONSISTENTE":              "bg-emerald-100 text-emerald-800",
  "PARCIALMENTE CONSISTENTE": "bg-amber-100 text-amber-800",
  "INCONSISTENTE":            "bg-red-100 text-red-800",
};

const FUND_COLOR: Record<FundamentacaoItem["tipo"], string> = {
  ARTIGO:         "bg-blue-50 text-blue-700 border-blue-100",
  JURISPRUDENCIA: "bg-violet-50 text-violet-700 border-violet-100",
  DIPLOMA:        "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const FUND_LABEL: Record<FundamentacaoItem["tipo"], string> = {
  ARTIGO:         "Art.",
  JURISPRUDENCIA: "Prec.",
  DIPLOMA:        "Lei",
};

// ── Score Circle SVG ──────────────────────────────────────────────────────────

function ScoreCircle({ score, color }: { score: number; color: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="relative flex flex-col items-center select-none">
        <span className="text-5xl font-bold text-slate-900 leading-none tabular-nums">{score}</span>
        <span className="text-sm text-slate-400 mt-1">/ 100</span>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-6 shadow-sm">
        <Star size={32} className="text-violet-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Nenhuma auditoria disponível</h2>
      <p className="text-slate-500 max-w-xs text-sm leading-relaxed">
        Gere uma peça pelo módulo <strong className="text-slate-700">Pesquisa</strong> para ver o
        relatório JudiAudit aqui automaticamente.
      </p>
      <button
        onClick={onRefresh}
        className="mt-6 flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 transition-colors"
      >
        <RefreshCw size={14} />
        Verificar novamente
      </button>
    </div>
  );
}

// ── Quality Mini Card ─────────────────────────────────────────────────────────

function QualityCard({
  icon, label, score, sublabel,
}: { icon: React.ReactNode; label: string; score: number; sublabel: string }) {
  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm ${scoreBorderCls(score)}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-400">{icon}</div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${scoreTextCls(score)}`}>{score}</p>
      <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JudiAuditPage() {
  const { user } = useAuthStore();
  const [stored, setStored] = useState<StoredReport | null>(null);

  function load() {
    try {
      const raw = localStorage.getItem("judiaudit_last_report");
      if (raw) setStored(JSON.parse(raw) as StoredReport);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  const r = stored?.report;
  const cls = r ? CLS[r.classificacao] : null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">

          {/* ── Cabeçalho ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Star size={22} className="text-violet-500" />
                <h1 className="text-2xl font-bold text-slate-900 font-display">JudiAudit</h1>
              </div>
              <p className="text-slate-500 text-sm">
                Auditoria jurídica inteligente de minutas processuais
              </p>
            </div>

            {stored && (
              <div className="text-right space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Última análise</p>
                <p className="text-sm font-medium text-slate-700">
                  {new Date(stored.generatedAt).toLocaleString("pt-BR", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {stored.tipoPeca && (
                    <span className="inline-block text-xs bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-medium">
                      {stored.tipoPeca}
                    </span>
                  )}
                  {stored.assuntoPrincipal && (
                    <span className="inline-block text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full max-w-[200px] truncate">
                      {stored.assuntoPrincipal}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Conteúdo ────────────────────────────────────────────── */}
          {!r || !cls ? (
            <EmptyState onRefresh={load} />
          ) : (
            <div className="space-y-5">

              {/* ── Linha 1: Score + 4 Quality Cards ─────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                {/* Score Principal */}
                <div className={`md:col-span-2 bg-white border ${cls.border} rounded-2xl p-7 flex flex-col items-center justify-center shadow-sm gap-5`}>
                  <ScoreCircle score={r.scoreGeral} color={cls.ring} />
                  <div className="text-center">
                    <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${cls.badge} ${cls.badgeText}`}>
                      {r.classificacao}
                    </span>
                    <p className="text-xs text-slate-400 mt-2">Score Geral de Qualidade</p>
                  </div>
                </div>

                {/* 4 mini cards */}
                <div className="md:col-span-3 grid grid-cols-2 gap-3">
                  <QualityCard
                    icon={<Scale size={14} />}
                    label="Consistência"
                    score={r.consistenciaArgumentativa.score}
                    sublabel={r.consistenciaArgumentativa.resultado}
                  />
                  <QualityCard
                    icon={<FileText size={14} />}
                    label="Estrutural"
                    score={r.qualidadeEstrutural.score}
                    sublabel={r.qualidadeEstrutural.label}
                  />
                  <QualityCard
                    icon={<Gavel size={14} />}
                    label="Probatória"
                    score={r.qualidadeProbatoria.score}
                    sublabel={r.qualidadeProbatoria.label}
                  />
                  <QualityCard
                    icon={<BarChart3 size={14} />}
                    label="Argumentativa"
                    score={r.qualidadeArgumentativa.score}
                    sublabel={r.qualidadeArgumentativa.perfil}
                  />
                </div>
              </div>

              {/* ── Qualidade Argumentativa — Barras ─────────────────── */}
              <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 size={16} className="text-violet-500" />
                  <h3 className="font-semibold text-slate-800">Qualidade Argumentativa</h3>
                  <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    {r.qualidadeArgumentativa.perfil}
                  </span>
                  {r.qualidadeArgumentativa.normalizedScore > r.qualidadeArgumentativa.score && (
                    <span className="text-xs text-blue-600 font-semibold">
                      norm. {r.qualidadeArgumentativa.normalizedScore}/100
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {r.qualidadeArgumentativa.dimensoes.map((dim) => {
                    const pct = dim.max > 0 ? dim.score / dim.max : 0;
                    return (
                      <div key={dim.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-slate-700">{dim.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">
                              {dim.score}<span className="text-slate-300">/{dim.max}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              {Math.round(pct * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${dimBarColor(pct)}`}
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Problemas: Fatal + Avisos ─────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Fatais */}
                {r.problemasFatais.length > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle size={16} className="text-red-600" />
                      <h3 className="font-semibold text-red-800">Problemas Fatais</h3>
                      <span className="ml-auto bg-red-200 text-red-900 text-xs font-bold px-2 py-0.5 rounded-full">
                        {r.problemasFatais.length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {r.problemasFatais.map((p, i) => (
                        <div key={i} className="bg-white/70 rounded-xl p-3.5">
                          <p className="text-sm font-semibold text-red-900">{p.titulo}</p>
                          <p className="text-xs text-red-700 mt-0.5 leading-relaxed line-clamp-3">{p.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center gap-3">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                    <div className="text-center">
                      <p className="font-semibold text-emerald-800">Sem problemas fatais</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Nenhuma violação crítica detectada</p>
                    </div>
                  </div>
                )}

                {/* Avisos */}
                <div className={`bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <h3 className="font-semibold text-amber-800">Avisos</h3>
                    <span className="ml-auto bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
                      {r.problemasNaoFatais.length}
                    </span>
                  </div>
                  {r.problemasNaoFatais.length > 0 ? (
                    <div className="space-y-2.5">
                      {r.problemasNaoFatais.slice(0, 5).map((p, i) => (
                        <div key={i} className="bg-white/70 rounded-xl p-3.5">
                          <p className="text-sm font-semibold text-amber-900">{p.titulo}</p>
                          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed line-clamp-2">{p.descricao}</p>
                        </div>
                      ))}
                      {r.problemasNaoFatais.length > 5 && (
                        <p className="text-xs text-amber-600 text-center pt-1">
                          +{r.problemasNaoFatais.length - 5} avisos adicionais
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-700">
                      <CheckCircle2 size={15} className="text-emerald-500" />
                      <p className="text-sm">Nenhum aviso encontrado.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Pontos Fortes + Riscos ────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Pontos Fortes */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} className="text-violet-500" />
                    <h3 className="font-semibold text-slate-800">Pontos Fortes</h3>
                  </div>
                  <div className="space-y-2.5">
                    {r.pontosFortes.length > 0 ? r.pontosFortes.map((p, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-700 leading-snug">{p.titulo}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-400">Nenhum ponto forte identificado.</p>
                    )}
                  </div>
                </div>

                {/* Riscos Processuais */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={16} className="text-red-400" />
                    <h3 className="font-semibold text-slate-800">Riscos Processuais</h3>
                  </div>
                  {r.riscosProcessuais.length > 0 ? (
                    <div className="space-y-2.5">
                      {r.riscosProcessuais.map((risk, i) => (
                        <div
                          key={i}
                          className={`rounded-xl p-3.5 border ${
                            risk.severidade === "FATAL"
                              ? "bg-red-50 border-red-100"
                              : "bg-orange-50 border-orange-100"
                          }`}
                        >
                          <p className={`text-sm font-semibold ${risk.severidade === "FATAL" ? "text-red-800" : "text-orange-800"}`}>
                            {risk.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{risk.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={15} />
                      <p className="text-sm font-medium">Nenhum risco processual identificado</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Fundamentação Jurídica — Tags ─────────────────────── */}
              {r.fundamentacaoJuridica.length > 0 && (
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen size={16} className="text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Fundamentação Jurídica Detectada</h3>
                    <span className="ml-auto text-xs text-slate-400">
                      {r.fundamentacaoJuridica.length} referências
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.fundamentacaoJuridica.map((f, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${FUND_COLOR[f.tipo]}`}
                      >
                        <span className="opacity-50 text-[10px]">{FUND_LABEL[f.tipo]}</span>
                        {f.referencia.length > 45 ? f.referencia.slice(0, 45) + "…" : f.referencia}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Sugestões de Melhoria ─────────────────────────────── */}
              {r.sugestoesMelhoria.length > 0 && (
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <TrendingUp size={16} className="text-blue-500" />
                    <h3 className="font-semibold text-slate-800">Sugestões de Melhoria</h3>
                  </div>
                  <ol className="space-y-4">
                    {r.sugestoesMelhoria.map((s, i) => (
                      <li key={i} className="flex items-start gap-3.5">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{s.titulo}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.descricao}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* ── Consistência — Detalhes ───────────────────────────── */}
              {r.consistenciaArgumentativa.detalhes.length > 0 && (
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Scale size={16} className="text-slate-400" />
                    <h3 className="font-semibold text-slate-800">Consistência Argumentativa</h3>
                    <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${CONSISTENCIA_BADGE[r.consistenciaArgumentativa.resultado] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.consistenciaArgumentativa.resultado}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {r.consistenciaArgumentativa.detalhes.map((d, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                        <p className="text-sm font-semibold text-slate-700">{d.titulo}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-3">{d.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
