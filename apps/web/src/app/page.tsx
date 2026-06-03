"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Gavel, Calculator, ClipboardCheck, Sparkles, Check } from "lucide-react";

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
    <div className="relative w-full rounded-xl bg-[#0d1117] border border-white/[0.07] p-3 overflow-hidden">
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
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">
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
    <div className="w-full rounded-xl bg-[#071410] border border-emerald-900/40 p-3 overflow-hidden">
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
                n === "=" ? "bg-emerald-600 text-white font-bold" : "bg-white/[0.06] text-white/55"
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
    <div className="w-full rounded-xl bg-[#100a02] border border-amber-900/40 p-3 overflow-hidden">
      <div className="flex items-start justify-between mb-0.5">
        <div className="text-[9px] text-amber-400/60 uppercase tracking-wider leading-none">SCORE</div>
        <div className="text-[26px] font-black text-amber-400 leading-none">97</div>
      </div>
      <div className="text-[9px] text-white/30 mb-3 leading-none">/100</div>
      {items.map(([label, color]) => (
        <div key={label} className="flex items-center gap-1.5 mb-1.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color === "green" ? "bg-green-400" : "bg-amber-400"}`} />
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
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col selection:bg-indigo-500/30 overflow-x-hidden">

      {/* ── Ambient glow ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-[40%] -left-48 w-[500px] h-[500px] rounded-full bg-violet-700/[0.07] blur-3xl" />
        <div className="absolute top-[30%] -right-48 w-[450px] h-[450px] rounded-full bg-sky-600/[0.06] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-6 md:px-14 py-4 flex items-center justify-between border-b border-white/[0.05] bg-[#080c14]/80 backdrop-blur-xl">
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
            className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-900/40"
          >
            Entrar
          </a>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 md:px-14 pt-6 pb-20">

        {/* Hero row: texto esquerda + Themis direita */}
        <div className="w-full max-w-5xl flex items-center gap-8 mb-0">

          {/* Coluna esquerda */}
          <div className="flex-1 flex flex-col items-start pb-12">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="mb-7"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-[11px] font-medium tracking-widest uppercase">
                <Sparkles size={10} />
                IA Jurídica Avançada
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.06 }}
              className="text-5xl md:text-6xl lg:text-[68px] font-bold leading-[1.07] tracking-tight max-w-xl mb-6"
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
              className="text-white/45 text-[15px] md:text-base leading-relaxed max-w-md"
            >
              Gere peças, calcule valores e audite documentos com base na legislação e jurisprudência atualizada dos principais tribunais brasileiros.
            </motion.p>
          </div>

          {/* Coluna direita: Themis */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.08 }}
            className="hidden md:block relative w-[480px] h-[640px] shrink-0"
          >
            <Image
              src="/hero.png"
              alt="Themis"
              fill
              sizes="400px"
              className="object-contain object-bottom drop-shadow-2xl"
              priority
            />
          </motion.div>
        </div>

        {/* Product cards */}
        <div className="w-full max-w-5xl">
          <div className="grid md:grid-cols-3 gap-5">
            {PRODUCTS.map((p, idx) => (
              <motion.div
                key={p.name}
                custom={idx * 0.08}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex flex-col rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
              >
                {/* Body */}
                <div className="flex-1 p-5">
                  {/* Icon + name + tagline */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg}`}>
                      <p.icon size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-white leading-tight">{p.name}</div>
                      <div className="text-[10px] text-white/35 tracking-wide leading-tight mt-0.5">{p.tagline}</div>
                    </div>
                  </div>

                  {/* Features + preview side-by-side */}
                  <div className="flex gap-3">
                    <ul className="flex-1 space-y-2.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check size={11} className={`mt-0.5 shrink-0 ${p.checkColor}`} />
                          <span className="text-[11px] text-white/55 leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="w-[140px] shrink-0">
                      <p.Preview />
                    </div>
                  </div>
                </div>

              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18, duration: 0.5 }}
          className="w-full max-w-3xl flex flex-wrap justify-center gap-x-12 gap-y-5 pt-16 mt-16 border-t border-white/[0.06]"
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white tracking-tight">{s.value}</span>
              <span className="text-xs text-white/35 tracking-wide">{s.label}</span>
            </div>
          ))}
        </motion.div>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 py-5 px-6 md:px-14 border-t border-white/[0.05] flex items-center justify-between">
        <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain opacity-20" />
        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
