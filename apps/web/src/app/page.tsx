"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Gavel, Calculator, ClipboardCheck, Sparkles, Check, ArrowRight } from "lucide-react";

// ── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

// ── Mini preview mockups ──────────────────────────────────────────────────────

function PreviewJudiCore() {
  return (
    <div className="relative w-full rounded-xl bg-[#0d1117] border border-white/[0.07] p-3 overflow-hidden shadow-2xl group-hover:shadow-indigo-500/20 transition-all">
      <div className="flex gap-1.5 mb-3">
        <div className="w-2 h-2 rounded-full bg-red-500/60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
        <div className="w-2 h-2 rounded-full bg-green-500/60" />
      </div>
      <div className="text-[10px] text-white/50 font-semibold mb-2.5 leading-none">Petição Inicial</div>
      <div className="space-y-2">
        <div className="h-1.5 bg-white/15 rounded-full w-full" />
        <div className="h-1.5 bg-white/10 rounded-full w-4/5" />
        <div className="h-1.5 bg-white/15 rounded-full w-full" />
        <div className="h-1.5 bg-indigo-400/35 rounded-full w-3/4" />
        <div className="h-1.5 bg-white/10 rounded-full w-full" />
        <div className="h-1.5 bg-white/12 rounded-full w-5/6" />
      </div>
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-indigo-600/40">
        A
      </div>
    </div>
  );
}

function PreviewJudiCalc() {
  const rows = [
    ["7","8","9","×"],
    ["4","5","6","−"],
    ["1","2","3","+"],
    ["0",".","","="],
  ];
  return (
    <div className="w-full rounded-xl bg-[#071410] border border-emerald-900/40 p-3 overflow-hidden shadow-2xl group-hover:shadow-emerald-500/20 transition-all">
      <div className="mb-3">
        <div className="text-[9px] text-emerald-400/60 leading-none mb-1">Total</div>
        <div className="text-[13px] font-bold text-emerald-400 leading-tight">R$ 125.430,87</div>
      </div>
      <div className="grid grid-cols-4 gap-0.5">
        {rows.map((row, ri) =>
          row.map((n, ci) => (
            <div
              key={`${ri}-${ci}`}
              className={`text-center text-[10px] py-1 rounded leading-none ${
                n === "=" ? "bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/40" : "bg-white/[0.06] text-white/55"
              }`}
            >
              {n}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PreviewJudiAudit() {
  const items: [string, "green" | "amber"][] = [
    ["Estrutura",     "green"],
    ["Fundament.",    "amber"],
    ["Jurisprudência","green"],
    ["Pedidos",       "green"],
  ];
  return (
    <div className="w-full rounded-xl bg-[#100a02] border border-amber-900/40 p-3 overflow-hidden shadow-2xl group-hover:shadow-amber-500/20 transition-all">
      <div className="flex items-start justify-between mb-0.5">
        <div className="text-[9px] text-amber-400/60 uppercase tracking-wider leading-none">SCORE</div>
        <div className="text-[26px] font-black text-amber-400 leading-none drop-shadow-md">97</div>
      </div>
      <div className="text-[9px] text-white/30 mb-3 leading-none">/100</div>
      {items.map(([label, color]) => (
        <div key={label} className="flex items-center gap-1.5 mb-1.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color === "green" ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"}`} />
          <div className="text-[10px] text-white/55 leading-none">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

type Product = {
  icon: React.ElementType;
  name: string;
  tagline: string;
  features: string[];
  iconBg: string;
  checkColor: string;
  Preview: () => React.ReactElement;
  link: string;
  colorName: "indigo" | "emerald" | "amber";
};

const PRODUCTS: Product[] = [
  {
    icon: Gavel,
    name: "JudiCore",
    tagline: "Geração Inteligente de Peças",
    features: [
      "Mais de 1 milhão de acórdãos",
      "Fundamentação automática",
      "Teses e jurisprudência aplicáveis",
      "Peças personalizadas ao seu caso",
    ],
    iconBg: "bg-indigo-600",
    checkColor: "text-indigo-400",
    Preview: PreviewJudiCore,
    link: "/login",
    colorName: "indigo",
  },
  {
    icon: Calculator,
    name: "JudiCalc",
    tagline: "Automação Completa de Cálculos",
    features: [
      "Acesso via SOAP ao PJe",
      "Cálculos automáticos precisos",
      "Geração de memória e PDF",
      "Assinatura com PJeOffice",
      "Envio automático ao processo",
    ],
    iconBg: "bg-emerald-600",
    checkColor: "text-emerald-400",
    Preview: PreviewJudiCalc,
    link: process.env.NEXT_PUBLIC_JUDICALC_URL || "#",
    colorName: "emerald",
  },
  {
    icon: ClipboardCheck,
    name: "JudiAudit",
    tagline: "Auditoria Inteligente de Peças",
    features: [
      "Score de qualidade (0–100)",
      "Análise de estrutura e conteúdo",
      "Fundamentação e jurisprudência",
      "Detecta riscos e inconsistências",
      "Sugestões de melhoria",
    ],
    iconBg: "bg-amber-600",
    checkColor: "text-amber-400",
    Preview: PreviewJudiAudit,
    link: "/login",
    colorName: "amber",
  },
];

const STATS = [
  { value: "1M+",  label: "acórdãos indexados" },
  { value: "98%",  label: "precisão média"      },
  { value: "−70%", label: "tempo economizado"   },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative">
      
      {/* ── Background Animations ────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {/* Animated Radial Gradients */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.2, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[40%] -left-48 w-[500px] h-[500px] rounded-full bg-violet-700/10 blur-[100px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[30%] -right-48 w-[450px] h-[450px] rounded-full bg-sky-600/10 blur-[100px]" 
        />
        
        {/* Modern Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-6 md:px-14 py-4 flex items-center justify-between border-b border-white/[0.05] bg-[#050505]/70 backdrop-blur-xl">
        <div className="flex items-center gap-4">
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
