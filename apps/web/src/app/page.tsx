"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Shield, Zap, Lock, Sparkles, TrendingUp,
  Users, FileText, Database, Clock, CheckCircle,
} from "lucide-react";

const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const NAV_LINKS = ["Recursos", "Planos", "Tutorial", "Ajuda"];

const STATS = [
  { icon: <Users size={20} className="text-violet-400" />, value: "+10.000", label: "Usuários Ativos", sub: "todos os dias" },
  { icon: <FileText size={20} className="text-indigo-400" />, value: "+2M", label: "Peças Geradas", sub: "com IA" },
  { icon: <Database size={20} className="text-blue-400" />, value: "+1M", label: "Acórdãos", sub: "na base" },
  { icon: <Shield size={20} className="text-emerald-400" />, value: "100%", label: "Seguro e Confidencial", sub: "" },
  { icon: <Clock size={20} className="text-amber-400" />, value: "24/7", label: "Disponível", sub: "para você" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080f] text-white flex flex-col overflow-x-hidden">

      {/* ── Background glows ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-[140px]" />
        <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-700/8 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-800/6 blur-[100px]" />
      </div>

      {/* ── Navbar ────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex items-center justify-between px-6 md:px-14 py-4 border-b border-white/[0.06] backdrop-blur-xl bg-[#07080f]/80"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="JudiCore" width={38} height={38} className="rounded-lg" />
          <div>
            <span className="text-base font-bold tracking-tight">
              judi<span className="text-violet-400">C</span>re
            </span>
            <p className="text-[9px] text-white/25 uppercase tracking-widest leading-none">
              Suíte de Ferramentas Jurídicas Inteligentes
            </p>
          </div>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <span key={l} className="text-sm text-white/45 hover:text-white/80 cursor-pointer transition-colors">
              {l}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Entrar
        </Link>
      </motion.nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex-1 px-6 md:px-14 pt-16 pb-10 md:pt-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">

          {/* Left — headline */}
          <div>
            <motion.div
              custom={0} variants={fadeUp} initial="hidden" animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-6"
            >
              <Sparkles size={12} />
              IA JURÍDICA AVANÇADA
            </motion.div>

            <motion.h1
              custom={1} variants={fadeUp} initial="hidden" animate="visible"
              className="text-4xl md:text-5xl font-extrabold leading-[1.12] mb-5"
            >
              Inteligência que<br />
              transforma o{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Direito.
              </span>
            </motion.h1>

            <motion.p
              custom={2} variants={fadeUp} initial="hidden" animate="visible"
              className="text-white/50 text-base leading-relaxed mb-8 max-w-md"
            >
              Geração de peças, cálculos judiciais e análise inteligente com base
              na legislação e jurisprudência atualizada dos principais tribunais.
            </motion.p>

            {/* Feature badges */}
            <motion.div
              custom={3} variants={fadeUp} initial="hidden" animate="visible"
              className="flex flex-wrap gap-4"
            >
              {[
                { icon: <Shield size={14} className="text-violet-400" />, label: "Confiável", sub: "Baseado em Jurisprudência" },
                { icon: <Zap size={14} className="text-amber-400" />, label: "Rápido", sub: "IA de Alta Performance" },
                { icon: <Lock size={14} className="text-emerald-400" />, label: "Seguro", sub: "Seus dados protegidos" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/8 bg-white/[0.03]">
                  {f.icon}
                  <div>
                    <p className="text-xs font-semibold text-white/80">{f.label}</p>
                    <p className="text-[10px] text-white/35">{f.sub}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — visual */}
          <motion.div
            custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="relative hidden md:flex items-center justify-center"
          >
            {/* Glow rings */}
            <div className="absolute w-[360px] h-[360px] rounded-full border border-violet-500/10 bg-violet-600/5 blur-sm" />
            <div className="absolute w-[260px] h-[260px] rounded-full border border-violet-500/15 bg-violet-700/8" />

            {/* Hero image */}
            <div className="relative w-[300px] h-[380px]">
              <Image
                src="/hero.png"
                alt="Justiça"
                fill
                className="object-contain object-bottom drop-shadow-2xl"
                style={{ filter: "drop-shadow(0 0 40px rgba(139,92,246,0.3))" }}
                priority
              />
            </div>

            {/* Floating stat card */}
            <div className="absolute top-4 right-0 bg-[#12162a]/90 border border-violet-500/20 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-xl">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={10} className="text-violet-400" />
                <span className="text-[9px] text-violet-300 uppercase tracking-widest font-semibold">Base de Conhecimento</span>
              </div>
              <p className="text-3xl font-extrabold text-white">1M+</p>
              <p className="text-[10px] text-white/40 leading-tight">Acórdãos e Decisões<br />atualizados diariamente</p>
              <div className="mt-2">
                <TrendingUp size={28} className="text-violet-400/60" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Product cards ────────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto mt-16 grid md:grid-cols-2 gap-5">

          {/* JudiCore */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              href="/login"
              className="group block h-full p-7 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-violet-500/25 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/40 border border-violet-500/30 flex items-center justify-center">
                  <FileText size={20} className="text-violet-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    Judi<span className="text-violet-400">Core</span>
                  </h2>
                  <p className="text-xs text-white/35">Geração Inteligente de Peças Jurídicas</p>
                </div>
              </div>

              <p className="text-sm text-white/45 leading-relaxed mb-5">
                Crie petições, decisões, sentenças e recursos com IA especializada,
                fundamentadas em jurisprudência real do STJ, STF e TRFs.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {["+1M Acórdãos", "Citações 100%", "Exportação DOCX", "Formato ABNT"].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-md bg-violet-900/30 border border-violet-500/20 text-xs text-violet-300">
                    {tag}
                  </span>
                ))}
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                Acessar JudiCore
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>

          {/* JudiCalc */}
          <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
            <a
              href={JUDICALC_URL}
              className="group block h-full p-7 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-emerald-500/25 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    Judi<span className="text-emerald-400">Calc</span>
                  </h2>
                  <p className="text-xs text-white/35">Cálculos Judiciais de Precisão</p>
                </div>
              </div>

              <p className="text-sm text-white/45 leading-relaxed mb-5">
                Cálculos previdenciários, trabalhistas e cíveis com índices oficiais
                do Banco Central e correções monetárias automáticas.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {["IPCA, SELIC, INPC", "Atualização via BCB", "Relatórios PDF", "Exportação Excel"].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-md bg-emerald-900/30 border border-emerald-500/20 text-xs text-emerald-300">
                    {tag}
                  </span>
                ))}
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                Acessar JudiCalc
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="relative z-10 border-t border-white/[0.05] bg-white/[0.015] px-6 md:px-14 py-8"
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

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 md:px-14 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="JudiCore" width={28} height={28} className="rounded-md opacity-60" />
            <span className="text-xs text-white/25">Tecnologia que impulsiona a justiça.</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-white/25">
            {["Sobre", "Privacidade", "Termos de Uso", "Suporte", "Contato"].map((l) => (
              <span key={l} className="hover:text-white/50 cursor-pointer transition-colors">{l}</span>
            ))}
          </nav>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
