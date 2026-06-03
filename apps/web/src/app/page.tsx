"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Database, Search, Sparkles } from "lucide-react";

const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const PRODUCTS = [
  {
    href: "/login",
    icon: FileText,
    name: "JudiCore",
    tagline: "Geração de Peças",
    description: "Petições e recursos fundamentados com jurisprudência real dos principais tribunais brasileiros.",
    cta: "Começar",
    accent: "indigo",
    iconCls: "bg-indigo-500/10 text-indigo-400",
    borderHover: "hover:border-indigo-500/25",
    ctaCls: "text-indigo-400",
  },
  {
    href: JUDICALC_URL,
    icon: Database,
    name: "JudiCalc",
    tagline: "Automação de Cálculos",
    description: "Cálculos previdenciários, trabalhistas e cíveis com integração ao PJe.",
    cta: "Abrir",
    accent: "sky",
    iconCls: "bg-sky-500/10 text-sky-400",
    borderHover: "hover:border-sky-500/25",
    ctaCls: "text-sky-400",
  },
  {
    href: "/login",
    icon: Search,
    name: "JudiAudit",
    tagline: "Auditoria Inteligente",
    description: "Score de qualidade, pontos de melhoria e sugestões automáticas por IA.",
    cta: "Auditar",
    accent: "violet",
    iconCls: "bg-violet-500/10 text-violet-400",
    borderHover: "hover:border-violet-500/25",
    ctaCls: "text-violet-400",
  },
] as const;

const STATS = [
  { value: "1M+",     label: "acórdãos indexados"  },
  { value: "98%",     label: "precisão média"       },
  { value: "−70%",    label: "tempo economizado"    },
  { value: "+10.000", label: "usuários ativos"      },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col selection:bg-indigo-500/30 overflow-x-hidden">

      {/* ── Ambient glow ────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-[40%] -left-48 w-[500px] h-[500px] rounded-full bg-violet-700/7 blur-3xl" />
        <div className="absolute top-[30%] -right-48 w-[450px] h-[450px] rounded-full bg-sky-600/6 blur-3xl" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)", backgroundSize: "60px 60px" }}
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-6 md:px-14 py-4 flex items-center justify-between border-b border-white/[0.05] bg-[#080c14]/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="JudiCore" width={112} height={38} className="object-contain" />
          <span className="hidden sm:inline text-xs text-white/35 border-l border-white/10 pl-4 tracking-wide font-light">
            Suíte de Inteligência Jurídica
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-white/45">
          <Link href="/sobre"      className="hidden md:block hover:text-white/80 transition-colors">Sobre</Link>
          <Link href="/privacidade" className="hidden md:block hover:text-white/80 transition-colors">Privacidade</Link>
          <Link href="/termos"     className="hidden md:block hover:text-white/80 transition-colors">Termos</Link>
          <a
            href="/login"
            className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-900/40"
          >
            Entrar
          </a>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 md:px-14 pt-24 pb-20">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="mb-7"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/8 text-indigo-300 text-[11px] font-medium tracking-widest uppercase">
            <Sparkles size={10} />
            IA Jurídica Avançada
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.06 }}
          className="text-center text-5xl md:text-6xl lg:text-[68px] font-bold leading-[1.07] tracking-tight max-w-3xl mb-6"
        >
          <span className="text-white">Inteligência que</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
            transforma o Direito.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
          className="text-center text-white/45 text-[15px] md:text-base leading-relaxed max-w-lg mb-10"
        >
          Gere peças, calcule valores e audite documentos com base na legislação e jurisprudência atualizada dos principais tribunais brasileiros.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }}
          className="flex items-center gap-3 mb-20"
        >
          <a
            href="/login"
            className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-xl shadow-indigo-900/50 hover:shadow-indigo-800/60 hover:-translate-y-px active:translate-y-0"
          >
            Começar gratuitamente
          </a>
          <a
            href="/sobre"
            className="px-6 py-2.5 rounded-full border border-white/10 text-white/55 hover:text-white/80 hover:border-white/20 text-sm font-medium transition-all"
          >
            Saiba mais
          </a>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24, duration: 0.5 }}
          className="w-full max-w-3xl flex flex-wrap justify-center gap-x-12 gap-y-5 pb-20 mb-20 border-b border-white/[0.06]"
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white tracking-tight">{s.value}</span>
              <span className="text-xs text-white/35 tracking-wide">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Product cards */}
        <div className="w-full max-w-4xl">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            className="text-center text-xs text-white/25 uppercase tracking-widest mb-8 font-medium"
          >
            Produtos
          </motion.p>
          <div className="grid md:grid-cols-3 gap-4">
            {PRODUCTS.map((p, idx) => (
              <motion.a
                key={p.name}
                href={p.href}
                custom={idx * 0.08}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className={`group relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] ${p.borderHover} hover:bg-white/[0.045] transition-all duration-200 cursor-pointer`}
              >
                {/* Top accent line on hover */}
                <div className={`absolute top-0 left-6 right-6 h-px rounded-full bg-gradient-to-r from-transparent ${p.accent === "indigo" ? "via-indigo-500/50" : p.accent === "sky" ? "via-sky-500/50" : "via-violet-500/50"} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${p.iconCls}`}>
                  <p.icon size={18} />
                </div>

                <div className="text-[15px] font-semibold text-white mb-1">{p.name}</div>
                <div className="text-[11px] text-white/35 mb-3 tracking-wide">{p.tagline}</div>
                <p className="text-sm text-white/50 leading-relaxed mb-6">{p.description}</p>

                <div className={`flex items-center gap-1.5 text-xs font-semibold ${p.ctaCls}`}>
                  {p.cta}
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform duration-150" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 py-5 px-6 md:px-14 border-t border-white/[0.05] flex items-center justify-between">
        <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain opacity-20" />
        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
