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
    <div className="min-h-screen bg-[#030014] text-white flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative">
      
      {/* ── Background Animations ────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {/* Animated Radial Gradients (Floating Orbs) */}
        <motion.div 
          animate={{ 
            x: [0, 80, -80, 0],
            y: [0, -80, 80, 0],
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-600/30 blur-[150px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 100, 0],
            y: [0, 80, -80, 0],
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.4, 0.3] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -right-48 w-[700px] h-[700px] rounded-full bg-fuchsia-600/20 blur-[150px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, 120, -120, 0],
            y: [0, 60, -60, 0],
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-48 left-[20%] w-[800px] h-[800px] rounded-full bg-cyan-600/20 blur-[150px]" 
        />
        
        {/* Modern Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_70%,transparent_100%)]" />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-6 md:px-14 py-4 flex items-center justify-between border-b border-white/[0.05] bg-[#030014]/50 backdrop-blur-xl">
        <div className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="Judicore" width={112} height={38} className="object-contain" priority />
          <span className="hidden sm:inline text-xs text-white/35 border-l border-white/10 pl-4 tracking-wide font-light">
            SUÍTE DE INTELIGÊNCIA JURÍDICA
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-white/50 font-medium">
          <a
            href="/login"
            className="px-5 py-2 rounded-full bg-white text-black hover:bg-gray-200 text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105"
          >
            Entrar no Sistema
          </a>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-6 md:px-14 pt-16 md:pt-24 pb-20">
        <div className="w-full max-w-5xl flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-24"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-8 backdrop-blur-md shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              <Sparkles size={14} className="animate-pulse" />
              <span>IA Jurídica Avançada</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1] drop-shadow-2xl">
              Suíte{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Judicore
                </span>
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/30 to-purple-600/30 blur-2xl -z-10 opacity-70" />
              </span>
            </h1>
            <p className="text-lg md:text-2xl text-white/60 max-w-2xl mx-auto font-light leading-relaxed">
              Ferramentas inteligentes para operadores do direito. Escolha o módulo que deseja e deixe a IA te ajudar.
            </p>
          </motion.div>

          <div className="w-full max-w-6xl mt-4 relative">
            
            {/* Imagem da Themis Absoluta no Background (Removida do Grid) */}
            <motion.div
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.08 }}
              className="hidden lg:block absolute -top-[450px] right-0 w-[550px] h-[750px] pointer-events-none -z-10 opacity-80"
            >
              <Image
                src="/hero.png"
                alt="Themis"
                fill
                sizes="550px"
                className="object-contain object-bottom drop-shadow-[0_0_50px_rgba(139,92,246,0.4)] filter contrast-[1.15] brightness-90"
                priority
              />
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 relative z-10">
              {PRODUCTS.map((p, idx) => {
                // Determina as cores do hover baseadas no card
                const colorClasses = {
                  indigo: "from-indigo-600/20 hover:shadow-indigo-500/30 group-hover:border-indigo-500/40",
                  emerald: "from-emerald-600/20 hover:shadow-emerald-500/30 group-hover:border-emerald-500/40",
                  amber: "from-amber-600/20 hover:shadow-amber-500/30 group-hover:border-amber-500/40",
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
                      className={`group relative flex flex-col h-full rounded-3xl bg-white/[0.04] border border-white/[0.08] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.06] shadow-2xl backdrop-blur-xl ${colorClasses}`}
                    >
                      {/* Efeito Glow Interno */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses.split(' ')[0]} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      <div className="absolute -inset-px bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

                      {/* Body */}
                      <div className="flex-1 p-6 relative z-10">
                        {/* Icon + name + tagline */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg} shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                            <p.icon size={22} className="text-white" />
                          </div>
                          <div>
                            <div className="text-lg font-bold text-white leading-tight group-hover:text-gray-200 transition-colors">{p.name}</div>
                            <div className="text-xs text-white/50 tracking-wide leading-tight mt-1 font-light">{p.tagline}</div>
                          </div>
                        </div>

                        {/* Features */}
                        <ul className="space-y-3 mb-8">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check size={14} className={`mt-0.5 shrink-0 ${p.checkColor}`} />
                              <span className="text-sm text-white/70 leading-tight">{f}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {/* Preview area */}
                        <div className="w-full flex justify-center mt-auto opacity-90 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-[1.03]">
                          <div className="w-[90%]">
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
      <footer className="relative z-10 py-8 px-6 md:px-14 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4 bg-[#030014]/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
          <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain grayscale hover:grayscale-0 transition-all" />
        </div>
        <p className="text-xs text-white/30 font-medium tracking-wide">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
