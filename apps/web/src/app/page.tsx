"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Calculator, CheckCircle, Sparkles } from "lucide-react";

// URL do módulo de cálculos. Configurável via env para facilitar testes.
// Ambos os módulos apontam direto para o login da respectiva plataforma
const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const cardFade = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.2 + i * 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05050A] text-white flex flex-col overflow-x-hidden selection:bg-violet-500/30">
      {/* Background Dinâmico e Motion */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Glows com animação */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.3, 0.15],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] rounded-full bg-violet-600/20 blur-[150px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.25, 0.1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 2 }}
          className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[150px]"
        />
      </div>

      {/* Navbar com Glassmorphism */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-50 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 backdrop-blur-2xl bg-[#05050A]/60"
      >
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Judicore" width={110} height={110} className="rounded-xl drop-shadow-[0_0_15px_rgba(139,92,246,0.2)]" />
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <span className="text-xs tracking-widest uppercase font-semibold text-white/40 hidden sm:inline">Suíte de Inteligência Jurídica</span>
        </div>
        <div className="flex items-center gap-8">
          <Link href="/login" className="group relative px-6 py-2.5 rounded-full overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 transition-all">
            <span className="relative z-10 text-sm font-medium text-white group-hover:text-violet-200 transition-colors">Entrar no Sistema</span>
          <Image src="/logo.png" alt="JudiCore" width={112} height={38} className="object-contain" />
          <span className="hidden sm:inline text-xs text-white/35 border-l border-white/10 pl-4 tracking-wide font-light">
            Suíte de Inteligência Jurídica
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-white/45">
          <Link href="/sobre"       className="hidden md:block hover:text-white/80 transition-colors">Sobre</Link>
          <Link href="/privacidade" className="hidden md:block hover:text-white/80 transition-colors">Privacidade</Link>
          <Link href="/termos"      className="hidden md:block hover:text-white/80 transition-colors">Termos</Link>
          <a
            href="/login"
            className="px-5 py-2 rounded-full bg-white text-black hover:bg-gray-200 text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105"
          >
            Entrar no Sistema
          </a>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 md:px-14 pt-6 pb-20">

        {/* Hero row: texto esquerda + Themis direita */}
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-8 mb-0">

          {/* Coluna esquerda */}
          <div className="flex-1 flex flex-col items-start pb-12 z-10 mt-12 md:mt-0">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="mb-7"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-[11px] font-medium tracking-widest uppercase shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <Sparkles size={10} className="animate-pulse" />
                IA Jurídica Avançada
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.06 }}
              className="text-5xl md:text-6xl lg:text-[68px] font-black leading-[1.07] tracking-tight max-w-xl mb-6 drop-shadow-2xl"
            >
              <span className="text-white">Inteligência que</span>
              <br />
              <span className="relative inline-block mt-2">
                <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
                  transforma o Direito.
                </span>
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 blur-2xl -z-10 opacity-70" />
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
              className="text-white/60 text-[16px] md:text-lg leading-relaxed max-w-md font-light"
            >
              Gere peças, calcule valores e audite documentos com base na legislação e jurisprudência atualizada dos principais tribunais brasileiros.
            </motion.p>
          </div>

          {/* Coluna direita: Themis */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.08 }}
            className="relative w-[320px] h-[450px] md:w-[480px] md:h-[640px] shrink-0"
          >
            <Image
              src="/hero.png"
              alt="Themis"
              fill
              sizes="(max-width: 768px) 320px, 480px"
              className="object-contain object-bottom drop-shadow-[0_0_40px_rgba(99,102,241,0.3)] filter contrast-125"
              priority
            />
          </motion.div>
        </div>

        {/* Product cards */}
        <div className="w-full max-w-6xl mt-8">
          <div className="grid md:grid-cols-3 gap-6">
            {PRODUCTS.map((p, idx) => {
              // Determina as cores do hover baseadas no card
              const colorClasses = {
                indigo: "from-indigo-600/10 hover:shadow-indigo-500/20 group-hover:border-indigo-500/30",
                emerald: "from-emerald-600/10 hover:shadow-emerald-500/20 group-hover:border-emerald-500/30",
                amber: "from-amber-600/10 hover:shadow-amber-500/20 group-hover:border-amber-500/30",
              }[p.colorName];

              return (
                <motion.div
                  key={p.name}
                  custom={idx * 0.08}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                >
                  <Link
                    href={p.link}
                    className={`group relative flex flex-col h-full rounded-3xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.04] shadow-2xl backdrop-blur-xl ${colorClasses}`}
                  >
                    {/* Efeito Glow Interno */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses.split(' ')[0]} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

                    {/* Body */}
                    <div className="flex-1 p-6 relative z-10">
                      {/* Icon + name + tagline */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg} shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                          <p.icon size={22} className="text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white leading-tight group-hover:text-gray-200 transition-colors">{p.name}</div>
                          <div className="text-xs text-white/40 tracking-wide leading-tight mt-1">{p.tagline}</div>
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="space-y-3 mb-6">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check size={14} className={`mt-0.5 shrink-0 ${p.checkColor}`} />
                            <span className="text-sm text-white/60 leading-tight">{f}</span>
                          </li>
                        ))}
                      </ul>
                      
                      {/* Preview area */}
                      <div className="w-full flex justify-center mt-auto opacity-80 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-[1.02]">
                        <div className="w-[85%]">
                          <p.Preview />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18, duration: 0.5 }}
          className="w-full max-w-3xl flex flex-wrap justify-center gap-x-12 gap-y-5 pt-16 mt-16 border-t border-white/[0.06]"
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black text-white tracking-tight drop-shadow-md">{s.value}</span>
              <span className="text-sm text-white/40 tracking-wide uppercase font-semibold">{s.label}</span>
            </div>
          ))}
        </motion.div>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 py-8 px-6 md:px-14 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4 bg-[#050505]/70 backdrop-blur-xl">
        <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
          <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain grayscale hover:grayscale-0 transition-all" />
        </div>
        <p className="text-xs text-white/30 font-medium tracking-wide">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
