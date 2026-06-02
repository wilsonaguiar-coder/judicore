"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Shield, Zap, Lock, Sparkles,
  Users, FileText, Database, Clock, CheckCircle,
  LayoutGrid, Gem, PlayCircle, HelpCircle, User,
} from "lucide-react";

const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const NAV_LINKS = [
  { label: "Recursos", icon: <LayoutGrid size={13} /> },
  { label: "Planos",   icon: <Gem size={13} /> },
  { label: "Tutorial", icon: <PlayCircle size={13} /> },
  { label: "Ajuda",    icon: <HelpCircle size={13} /> },
];

const STATS = [
  { icon: <Users size={20} className="text-violet-400" />,  value: "+10.000", label: "Usuários Ativos",       sub: "todos os dias" },
  { icon: <FileText size={20} className="text-indigo-400" />, value: "+2M",  label: "Peças Geradas",          sub: "com IA" },
  { icon: <Database size={20} className="text-blue-400" />,  value: "+1M",   label: "Acórdãos",               sub: "na base" },
  { icon: <Shield size={20} className="text-emerald-400" />, value: "100%",  label: "Seguro e Confidencial",  sub: "" },
  { icon: <Clock size={20} className="text-amber-400" />,    value: "24/7",  label: "Disponível",             sub: "para você" },
];

// Sparkline SVG simples para o card "Base de Conhecimento"
function Sparkline() {
  return (
    <svg viewBox="0 0 80 28" className="w-full h-7 mt-2" fill="none">
      <polyline
        points="0,22 12,18 24,20 36,10 48,14 60,6 72,8 80,3"
        stroke="#a78bfa"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points="0,22 12,18 24,20 36,10 48,14 60,6 72,8 80,3 80,28 0,28"
        fill="url(#grad)"
        opacity="0.15"
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Mockup do painel do JudiCore
function JudiCoreMockup() {
  return (
    <div className="w-[140px] h-[110px] rounded-xl bg-[#0d1020] border border-violet-500/20 overflow-hidden shrink-0 shadow-xl">
      {/* barra de título */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-white/5">
        {["bg-red-500/60","bg-yellow-500/60","bg-green-500/60"].map((c) => (
          <span key={c} className={`w-1.5 h-1.5 rounded-full ${c}`} />
        ))}
      </div>
      {/* conteúdo simulado */}
      <div className="px-2.5 pt-2 space-y-1.5">
        <div className="h-1.5 rounded-full bg-violet-400/30 w-3/4" />
        <div className="h-1.5 rounded-full bg-white/10 w-full" />
        <div className="h-1.5 rounded-full bg-white/10 w-5/6" />
        <div className="h-1.5 rounded-full bg-white/10 w-4/5" />
        <div className="h-1.5 rounded-full bg-violet-400/20 w-2/3" />
      </div>
      <div className="flex justify-end px-2.5 pt-2 gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400/25" />
      </div>
    </div>
  );
}

// Mockup da calculadora do JudiCalc
function JudiCalcMockup() {
  const rows = [
    ["AC","%","×","+"],
    ["7","8","9","×"],
    ["4","5","6","−"],
    ["1","2","3","+"],
    ["0",".",".",null],
  ];
  return (
    <div className="w-[136px] h-[110px] rounded-xl bg-[#0d1a12] border border-emerald-500/20 overflow-hidden shrink-0 shadow-xl p-1.5">
      <div className="grid grid-cols-4 gap-0.5">
        {rows.flat().map((k, idx) => (
          k === null
            ? <div key={idx} />
            : (
              <div
                key={idx}
                className={`flex items-center justify-center text-[8px] font-semibold rounded h-4
                  ${k === "+" && idx === rows.flat().indexOf("+") + 3 ? "bg-emerald-500 text-white" :
                    ["AC","%","×","−"].includes(k) ? "bg-white/8 text-white/50" :
                    "bg-white/5 text-white/70"}`}
              >
                {k}
              </div>
            )
        ))}
      </div>
      {/* linha "=" verde */}
      <div className="mt-0.5 mx-0 bg-emerald-500 rounded h-4 flex items-center justify-center text-[8px] font-bold text-white">
        =
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080f] text-white flex flex-col overflow-x-hidden">

      {/* ── Background glows ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-[140px]" />
        <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-700/8 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-800/6 blur-[100px]" />
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex items-center justify-between px-6 md:px-12 py-3.5 border-b border-white/[0.06] backdrop-blur-xl bg-[#07080f]/80"
      >
        {/* Logo */}
        <Image src="/logo.png" alt="JudiCore" width={110} height={36} className="object-contain" />

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 cursor-pointer transition-colors">
              <span className="text-white/25">{l.icon}</span>
              {l.label}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all"
        >
          <User size={13} className="text-white/60" />
          Entrar
        </Link>
      </motion.nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pt-14 pb-8 md:pt-18">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">

          {/* Left */}
          <div>
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
              Geração de peças, cálculos judiciais e análise inteligente com base
              na legislação e jurisprudência atualizada dos principais tribunais.
            </motion.p>

            <motion.div
              custom={3} variants={fadeUp} initial="hidden" animate="visible"
              className="flex flex-wrap gap-3"
            >
              {[
                { icon: <Shield size={13} className="text-violet-400" />, label: "Confiável", sub: "Baseado em Jurisprudência" },
                { icon: <Zap size={13} className="text-amber-400" />,    label: "Rápido",    sub: "IA de Alta Performance" },
                { icon: <Lock size={13} className="text-emerald-400" />, label: "Seguro",    sub: "Seus dados protegidos" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/8 bg-white/[0.03]">
                  {f.icon}
                  <div>
                    <p className="text-xs font-semibold text-white/80">{f.label}</p>
                    <p className="text-[10px] text-white/35">{f.sub}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Themis */}
          <motion.div
            custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="relative hidden md:block"
            style={{ minHeight: 440 }}
          >
            {/* Glow atrás da Themis — posição central fixa */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
              {/* anel externo visível */}
              <div style={{
                width: 340, height: 340,
                borderRadius: "50%",
                border: "1px solid rgba(139,92,246,0.35)",
                boxShadow: "0 0 60px 12px rgba(109,40,217,0.25), inset 0 0 40px 8px rgba(109,40,217,0.12)",
                position: "absolute",
              }} />
              {/* blob de luz central */}
              <div style={{
                width: 220, height: 220,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(109,40,217,0.30) 0%, rgba(109,40,217,0.08) 60%, transparent 100%)",
                position: "absolute",
              }} />
            </div>

            {/* Themis PNG */}
            <div className="absolute inset-0" style={{ zIndex: 1 }}>
              <Image
                src="/hero.png"
                alt="Themis"
                fill
                className="object-contain object-bottom"
                priority
              />
            </div>

            {/* Card "Base de Conhecimento" */}
            <div className="absolute top-4 right-0 w-[190px] bg-[#10142a]/95 border border-violet-500/25 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-2xl z-10">
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

        {/* ── Product cards ──────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto mt-12 grid md:grid-cols-2 gap-5">

          {/* JudiCore */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              href="/login"
              className="group flex items-stretch h-full p-6 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-violet-500/25 transition-all gap-4"
            >
              {/* Left content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/40 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-none">Judi<span className="text-violet-400">Core</span></h2>
                    <p className="text-[11px] text-white/35 mt-0.5">Geração Inteligente de Peças Jurídicas</p>
                  </div>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4">
                  Crie petições, decisões, sentenças e recursos com IA especializada,
                  fundamentadas em jurisprudência real do STJ, STF e TRFs.
                </p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    "Busca semântica em mais de 1 milhão de acórdãos",
                    "RAG com apoio de IA e citações 100% auditáveis",
                    "Minutas disponíveis para exportação",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <CheckCircle size={13} className="text-violet-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                  Acessar JudiCore
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              {/* Right mockup */}
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
              {/* Left content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle size={18} className="text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-none">Judi<span className="text-emerald-400">Calc</span></h2>
                    <p className="text-[11px] text-white/35 mt-0.5">Cálculos Judiciais de Precisão</p>
                  </div>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4">
                  Cálculos previdenciários, trabalhistas e cíveis com índices oficiais
                  do Banco Central e correções monetárias automáticas.
                </p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    "Atualização automática de índices",
                    "Integração SOAP com PJe para consulta processos e inclusão de documentos",
                    "Exportação em PDF e Excel",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <CheckCircle size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  Acessar JudiCalc
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              {/* Right mockup */}
              <div className="hidden lg:flex items-center">
                <JudiCalcMockup />
              </div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="relative z-10 border-t border-white/[0.05] bg-white/[0.015] px-6 md:px-12 py-8"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                {s.icon}
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[11px] text-white/40 leading-tight mt-0.5">{s.label}</p>
                {s.sub && <p className="text-[10px] text-white/25">{s.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="JudiCore" width={80} height={28} className="object-contain opacity-70" />
            <span className="text-xs text-white/25">Tecnologia que impulsiona a justiça.</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-white/25">
            {["Sobre","Privacidade","Termos de Uso","Suporte","Contato"].map((l) => (
              <span key={l} className="hover:text-white/50 cursor-pointer transition-colors">{l}</span>
            ))}
          </nav>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
