"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Shield, Zap, Lock, Sparkles,
  Users, FileText, Database, Clock, CheckCircle,
  Link2, Search, Upload,
} from "lucide-react";

const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const NAV_LINKS = ["Recursos", "Planos", "Integrações", "Casos de uso", "Preços", "Sobre"];

const FLOW_STEPS = [
  { n: "1", title: "Captura de Dados",      sub: "Conecte ao PJe e importe o processo" },
  { n: "2", title: "Geração / Cálculo",     sub: "IA gera a peça ou realiza os cálculos" },
  { n: "3", title: "Revisão com Audit",     sub: "Auditoria aponta melhorias e valida a qualidade" },
  { n: "4", title: "Assinatura",            sub: "Assine com PJeOffice com segurança" },
  { n: "5", title: "Protocolo",             sub: "Envie ao PJe com um único clique" },
];

const STATS = [
  { icon: <Users size={22} className="text-blue-400" />,    value: "+1.000.000", label: "Acórdãos e decisões atualizados diariamente" },
  { icon: <Shield size={22} className="text-emerald-400" />, value: "98%",       label: "Precisão média dos resultados" },
  { icon: <Clock size={22} className="text-amber-400" />,   value: "-70%",       label: "Tempo médio economizado" },
  { icon: <Users size={22} className="text-blue-400" />,    value: "+10.000",    label: "Usuários ativos em todo o Brasil" },
];


function Sparkline() {
  return (
    <svg viewBox="0 0 80 28" className="w-full h-7 mt-2" fill="none">
      <polyline points="0,22 12,18 24,20 36,10 48,14 60,6 72,8 80,3"
        stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points="0,22 12,18 24,20 36,10 48,14 60,6 72,8 80,3 80,28 0,28"
        fill="url(#spark-grad)" opacity="0.15" />
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function JudiCoreMockup() {
  return (
    <div className="w-[140px] h-[110px] rounded-xl bg-[#0d1020] border border-violet-500/20 overflow-hidden shrink-0 shadow-xl">
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-white/5">
        {["bg-red-500/60", "bg-yellow-500/60", "bg-green-500/60"].map((c) => (
          <span key={c} className={`w-1.5 h-1.5 rounded-full ${c}`} />
        ))}
      </div>
      <div className="px-2.5 pt-2 space-y-1.5">
        <div className="h-1.5 rounded-full bg-violet-400/30 w-3/4" />
        <div className="h-1.5 rounded-full bg-white/10 w-full" />
        <div className="h-1.5 rounded-full bg-white/10 w-5/6" />
        <div className="h-1.5 rounded-full bg-white/10 w-4/5" />
        <div className="h-1.5 rounded-full bg-violet-400/20 w-2/3" />
      </div>
      <div className="flex justify-between items-end px-2.5 pt-2">
        <div className="h-1 rounded-full bg-white/8 w-10" />
        <div className="w-5 h-5 rounded-full bg-violet-500/30 flex items-center justify-center">
          <span className="text-[7px] font-bold text-violet-300">A</span>
        </div>
      </div>
    </div>
  );
}

function JudiCalcMockup() {
  const keys = ["7","8","9","×","4","5","6","−","1","2","3","+","0",".",null,"="];
  return (
    <div className="w-[140px] h-[110px] rounded-xl bg-[#0d1a12] border border-emerald-500/20 overflow-hidden shrink-0 shadow-xl p-2 flex flex-col gap-1.5">
      <div className="bg-black/30 rounded px-2 py-1 text-right">
        <p className="text-[7px] text-white/30">Total</p>
        <p className="text-[11px] font-bold text-emerald-400">R$ 125.430,87</p>
      </div>
      <div className="grid grid-cols-4 gap-0.5 flex-1">
        {keys.map((k, idx) =>
          k === null ? <div key={idx} /> : (
            <div key={idx} className={`flex items-center justify-center text-[8px] font-semibold rounded
              ${k === "=" ? "bg-emerald-500 text-white" :
                ["×","−","+"].includes(k) ? "bg-white/10 text-emerald-300" :
                "bg-white/5 text-white/70"}`}>
              {k}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function JudiAuditMockup() {
  return (
    <div className="flex gap-2 shrink-0">
      <div className="w-[110px] h-[110px] rounded-xl bg-[#1a1208] border border-amber-500/20 overflow-hidden shadow-xl p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[7px] text-amber-300/50 uppercase tracking-wide font-semibold">Score</span>
          <span className="text-sm font-extrabold text-amber-400">97</span>
        </div>
        <div className="text-[7px] text-white/25">/100</div>
        <div className="w-full h-1 rounded-full bg-white/8">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: "97%" }} />
        </div>
        <div className="space-y-0.5 mt-0.5">
          {[
            { ok: true,  label: "Estrutura" },
            { ok: false, label: "Fundament." },
            { ok: true,  label: "Jurisprudência" },
            { ok: true,  label: "Pedidos" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-1">
              <span className={`text-[7px] font-bold ${r.ok ? "text-emerald-400" : "text-amber-400"}`}>
                {r.ok ? "✓" : "⚠"}
              </span>
              <span className="text-[7px] text-white/40">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-[68px] h-[110px] rounded-xl bg-[#12100a] border border-amber-500/10 overflow-hidden shadow-xl flex flex-col items-center justify-center gap-1.5 text-center p-2">
        <Upload size={16} className="text-amber-500/40" />
        <p className="text-[6px] text-white/25 leading-tight">Arraste sua peça aqui ou clique para enviar</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080f] text-white flex flex-col overflow-x-hidden">

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-[140px]" />
        <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-700/8 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-800/6 blur-[100px]" />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex items-center justify-between px-6 md:px-12 py-3.5 border-b border-white/[0.06] backdrop-blur-xl bg-[#07080f]/80"
      >
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="JudiCore" width={110} height={36} className="object-contain" />
          <span className="hidden sm:inline-flex text-[9px] font-semibold text-white/30 uppercase tracking-widest border border-white/10 rounded px-2 py-0.5">
            Suíte de Inteligência Jurídica
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <span key={l} className="text-sm text-white/45 hover:text-white/80 cursor-pointer transition-colors">
              {l}
            </span>
          ))}
        </div>

        <div />
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-14 md:pt-18">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-end">

          {/* Left */}
          <div className="pb-10">
            <motion.div
              custom={0} variants={fadeUp} initial="hidden" animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-5"
            >
              <Sparkles size={11} />
              IA JURÍDICA AVANÇADA
            </motion.div>

            <motion.h1
              custom={1} variants={fadeUp} initial="hidden" animate="visible"
              className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-5"
            >
              Inteligência que<br />
              transforma o{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Direito.
              </span>
            </motion.h1>

            <motion.p
              custom={2} variants={fadeUp} initial="hidden" animate="visible"
              className="text-white/50 text-[15px] leading-relaxed mb-8 max-w-md"
            >
              Gere peças, realize cálculos e audite documentos jurídicos com base
              na legislação e jurisprudência atualizada dos principais tribunais.
            </motion.p>

            <motion.div
              custom={3} variants={fadeUp} initial="hidden" animate="visible"
              className="grid grid-cols-2 gap-3 max-w-md"
            >
              {[
                { icon: <Shield size={16} className="text-violet-400" />, label: "Confiável", sub: "Baseado em jurisprudência real" },
                { icon: <Zap size={16} className="text-amber-400" />,    label: "Rápido",    sub: "IA de Alta Performance" },
                { icon: <Lock size={16} className="text-emerald-400" />, label: "Seguro",    sub: "Seus dados protegidos" },
                { icon: <Link2 size={16} className="text-blue-400" />,   label: "Integrado", sub: "Processo Judicial Eletrônico - PJE" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03]">
                  {f.icon}
                  <div>
                    <p className="text-sm font-semibold text-white/80">{f.label}</p>
                    <p className="text-xs text-white/40">{f.sub}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Themis + card */}
          <motion.div
            custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="relative hidden md:block"
            style={{ minHeight: 440 }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
              <div style={{
                width: 340, height: 340, borderRadius: "50%",
                border: "1px solid rgba(139,92,246,0.35)",
                boxShadow: "0 0 60px 12px rgba(109,40,217,0.25), inset 0 0 40px 8px rgba(109,40,217,0.12)",
                position: "absolute",
              }} />
              <div style={{
                width: 220, height: 220, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(109,40,217,0.30) 0%, rgba(109,40,217,0.08) 60%, transparent 100%)",
                position: "absolute",
              }} />
            </div>
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              <Image src="/hero.png" alt="Themis" fill className="object-contain object-bottom" priority />
            </div>
            <div className="absolute top-28 right-0 w-[190px] bg-[#10142a]/95 border border-violet-500/25 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-2xl z-10">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={9} className="text-violet-400" />
                <span className="text-[8px] text-violet-300 uppercase tracking-widest font-semibold">Base de Conhecimento</span>
              </div>
              <p className="text-[28px] font-extrabold leading-none text-white">1M+</p>
              <p className="text-[10px] text-white/40 leading-tight mt-1">Acórdãos e Decisões<br />atualizados diariamente</p>
              <Sparkline />
            </div>
          </motion.div>
        </div>

        {/* Product cards */}
        <div className="max-w-6xl mx-auto mt-0 grid md:grid-cols-3 gap-5">

          {/* JudiCore */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              href="/login"
              className="group flex items-stretch h-full p-6 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-violet-500/25 transition-all gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/40 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-none">Judi<span className="text-violet-400">Core</span></h2>
                    <p className="text-[11px] text-white/35 mt-0.5">Geração Inteligente de Peças</p>
                  </div>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4">
                  Gere petições, decisões, sentenças e recursos com IA especializada,
                  fundamentadas em jurisprudência real do STJ, STF e TRFs.
                </p>
                <ul className="space-y-1.5 mb-5">
                  {[
                    "Mais de 1 milhão de acórdãos",
                    "Fundamentação automática",
                    "Teses e jurisprudência aplicáveis",
                    "Peças personalizadas ao seu caso",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <CheckCircle size={13} className="text-violet-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2 rounded-lg">
                  Gerar peça agora
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div className="hidden lg:flex items-center">
                <JudiCoreMockup />
              </div>
            </Link>
          </motion.div>

          {/* JudiCalc */}
          <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
            <a
              href={JUDICALC_URL}
              className="group flex items-stretch h-full p-6 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-emerald-500/25 transition-all gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Database size={18} className="text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-none">Judi<span className="text-emerald-400">Calc</span></h2>
                    <p className="text-[11px] text-white/35 mt-0.5">Automação Completa de Cálculos</p>
                  </div>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4">
                  Conecte-se ao PJe, gere cálculos previdenciários, trabalhistas e cíveis,
                  assine e protocole diretamente no processo em poucos cliques.
                </p>
                <ul className="space-y-1.5 mb-5">
                  {[
                    "Acesso via SOAP ao PJe",
                    "Cálculos automáticos precisos",
                    "Geração de memória e PDF",
                    "Assinatura com PJeOffice",
                    "Envio automático ao processo",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <CheckCircle size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2 rounded-lg">
                  Fazer cálculo agora
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div className="hidden lg:flex items-center">
                <JudiCalcMockup />
              </div>
            </a>
          </motion.div>

          {/* JudiAudit */}
          <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              href="/login"
              className="group flex items-stretch h-full p-6 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-amber-500/25 transition-all gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600/40 to-orange-600/40 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Search size={18} className="text-amber-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-none">Judi<span className="text-amber-400">Audit</span></h2>
                    <p className="text-[11px] text-white/35 mt-0.5">Auditoria Inteligente de Peças</p>
                  </div>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4">
                  Envie sua peça e receba uma análise completa com score de qualidade,
                  pontos de melhoria e sugestões fundamentadas.
                </p>
                <ul className="space-y-1.5 mb-5">
                  {[
                    "Score de qualidade (0–100)",
                    "Análise de estrutura e conteúdo",
                    "Fundamentação e jurisprudência",
                    "Detecta riscos e inconsistências",
                    "Sugestões de melhoria",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <CheckCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors px-4 py-2 rounded-lg">
                  Auditar peça agora
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              <div className="hidden lg:flex items-center">
                <JudiAuditMockup />
              </div>
            </Link>
          </motion.div>

        </div>
      </section>

      {/* Fluxo + Stats */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative z-10 border-t border-white/[0.05] px-6 md:px-12 py-12"
      >
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">

          {/* Fluxo */}
          <div>
            <h2 className="text-xl font-bold mb-8">Fluxo completo em poucos cliques</h2>
            <div className="flex flex-col">
              {FLOW_STEPS.map((step, idx) => (
                <div key={step.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-violet-400">{step.n}</span>
                    </div>
                    {idx < FLOW_STEPS.length - 1 && (
                      <div className="w-px bg-white/8 my-1" style={{ minHeight: 28 }} />
                    )}
                  </div>
                  <div className="pb-5">
                    <p className="text-sm font-semibold text-white/80">{step.title}</p>
                    <p className="text-xs text-white/35 mt-0.5">{step.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div>
            <h2 className="text-xl font-bold mb-8">Confiança que vem de resultados</h2>
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((s) => (
                <div key={s.label} className="flex items-start gap-3 p-4 rounded-xl border border-white/6 bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xl font-extrabold leading-none">{s.value}</p>
                    <p className="text-[11px] text-white/40 leading-tight mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <Image src="/logo.png" alt="JudiCore" width={90} height={30} className="object-contain opacity-60" />
          <nav className="flex items-center gap-5 text-xs text-white/30">
            {["Sobre", "Privacidade", "Termos de Uso"].map((l) => (
              <span key={l} className="hover:text-white/60 cursor-pointer transition-colors">{l}</span>
            ))}
          </nav>
          <p className="text-xs text-white/25">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
