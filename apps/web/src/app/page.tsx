"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Gavel, ClipboardCheck, Check, Scale } from "lucide-react";

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
    <div className="relative w-full h-[160px] flex flex-col rounded-xl bg-[#0d1117] border border-white/[0.07] p-5 overflow-hidden shadow-2xl group-hover:shadow-indigo-500/20 transition-all">
      <div className="flex gap-2 mb-5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      </div>
      <div className="text-xs text-white/70 font-semibold mb-4 leading-none">Petição Inicial</div>
      <div className="space-y-3 flex-1">
        <div className="h-2 bg-white/15 rounded-full w-full" />
        <div className="h-2 bg-white/10 rounded-full w-4/5" />
        <div className="h-2 bg-white/15 rounded-full w-full" />
        <div className="h-2 bg-indigo-400/35 rounded-full w-3/4" />
        <div className="h-2 bg-white/10 rounded-full w-full" />
        <div className="h-2 bg-white/12 rounded-full w-5/6" />
      </div>
      <div className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-[14px] font-bold text-white shadow-lg shadow-indigo-600/40">
        A
      </div>
    </div>
  );
}


function PreviewJudiAudit() {
  const items: [string, "green" | "amber"][] = [
    ["Estrutura Base", "green"],
    ["Fundamentação",  "amber"],
    ["Jurisprudência", "green"],
    ["Pedidos Finais", "green"],
  ];
  return (
    <div className="w-full h-[160px] flex flex-col rounded-xl bg-[#100a02] border border-amber-900/40 p-5 overflow-hidden shadow-2xl group-hover:shadow-amber-500/20 transition-all">
      <div className="flex items-start justify-between mb-1">
        <div className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wider leading-none mt-1">SCORE DE RISCO</div>
        <div className="text-[26px] font-black text-amber-400 leading-none">97</div>
      </div>
      <div className="text-[10px] text-white/40 mb-2 leading-none">/100</div>
      <div className="space-y-1 mt-1">
        {items.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${color === "green" ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"}`} />
            <div className="text-xs text-white/75 font-medium leading-none">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewPJE() {
  const docs = ["Petição Inicial", "Contestação", "Decisão", "Impugnação"];
  return (
    <div className="w-full h-[160px] flex flex-col rounded-xl bg-[#020c14] border border-cyan-900/40 p-4 overflow-hidden shadow-2xl group-hover:shadow-cyan-500/20 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
        <div className="text-[10px] text-cyan-400/80 font-mono leading-none truncate">0001234-56.2024.5.04.0101</div>
      </div>
      <div className="flex-1 space-y-1.5">
        {docs.map((doc, i) => (
          <div key={doc} className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-sm ${i === docs.length - 1 ? "bg-cyan-500" : "bg-white/20"}`} />
            <span className={`text-xs leading-none ${i === docs.length - 1 ? "text-cyan-300" : "text-white/45"}`}>{doc}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.07] mt-1">
        <span className="text-[10px] text-white/30">{docs.length} documentos</span>
        <span className="px-2 py-0.5 rounded bg-cyan-600/25 border border-cyan-500/30 text-[10px] text-cyan-400 font-semibold">+ Incluir Peça</span>
      </div>
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
  colorName: "indigo" | "amber" | "cyan";
};

const PRODUCTS: Product[] = [
  {
    icon: Gavel,
    name: "Pesquisa de Jurisprudência",
    tagline: "Pesquisa e Geração Inteligente de Peças",
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
    icon: ClipboardCheck,
    name: "Análise de Peças Judiciais",
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
  {
    icon: Scale,
    name: "Integração com o PJE",
    tagline: "Leia e adicione peças diretamente no PJE",
    features: [
      "Consulta processual",
      "Resumo de documento",
      "Análise de documento",
      "Dicas processuais",
      "Inclusão de peças",
    ],
    iconBg: "bg-cyan-600",
    checkColor: "text-cyan-400",
    Preview: PreviewPJE,
    link: "/login",
    colorName: "cyan",
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
            opacity: [0.6, 0.8, 0.6] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-500/50 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 100, 0],
            y: [0, 80, -80, 0],
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.7, 0.5] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -right-48 w-[700px] h-[700px] rounded-full bg-fuchsia-500/40 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, 120, -120, 0],
            y: [0, 60, -60, 0],
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.8, 0.6] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-48 left-[20%] w-[800px] h-[800px] rounded-full bg-cyan-500/40 blur-[120px]" 
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
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-6 md:px-14 pt-8 md:pt-12 pb-20">
        
        <div className="w-full max-w-6xl">

          {/* Hero: texto + Themis. bottom-0 da Themis = topo dos cards */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full md:w-[54%] lg:w-[50%] text-center md:text-left relative z-[2] pt-4 pb-10"
            >
              <h1 className="text-5xl md:text-[64px] lg:text-[72px] font-black tracking-tight mb-6 leading-[1.05] drop-shadow-2xl">
                Inteligência que<br className="hidden md:block" /> transforma o{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Direito.
                  </span>
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/30 to-purple-600/30 blur-2xl -z-10 opacity-70" />
                </span>
              </h1>
              <p className="text-lg md:text-2xl text-white/60 max-w-xl font-light leading-relaxed mx-auto md:mx-0">
                Ferramentas inteligentes para operadores do direito. Escolha o módulo que deseja e deixe a IA te ajudar.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-8 relative z-20"
              >
                {STATS.map((s) => (
                  <div key={s.label} className="flex flex-col items-center justify-center gap-1 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.03)] text-center">
                    <span className="text-xl font-black text-white tracking-tight leading-none">{s.value}</span>
                    <span className="text-[10px] text-white/50 tracking-wider uppercase font-bold leading-none">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.08 }}
              className="hidden md:block absolute right-0 bottom-0 w-[530px] h-[640px] pointer-events-none z-[5]"
            >
              <Image
                src="/hero.png"
                alt="Themis"
                fill
                sizes="530px"
                className="object-contain object-bottom drop-shadow-[0_0_50px_rgba(139,92,246,0.3)] filter contrast-[1.15] brightness-90"
                priority
              />
            </motion.div>
          </div>

          {/* 3 Cards — largura total, abaixo do texto */}
          <div className="grid md:grid-cols-3 gap-5 relative z-[2]">
            {PRODUCTS.map((p, idx) => {
              const colorClasses = {
                indigo: "from-indigo-600/20 hover:shadow-indigo-500/30 group-hover:border-indigo-500/40",
                amber:  "from-amber-600/20 hover:shadow-amber-500/30 group-hover:border-amber-500/40",
                cyan:   "from-cyan-600/20 hover:shadow-cyan-500/30 group-hover:border-cyan-500/40",
              }[p.colorName] ?? "";

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
                    <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses.split(" ")[0]} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="absolute -inset-px bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
                    <div className="flex-1 p-6 relative z-10 flex flex-col">
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg} shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                          <p.icon size={20} className="text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white leading-snug group-hover:text-gray-200 transition-colors">{p.name}</div>
                          <div className="text-[11px] text-white/50 tracking-wide leading-tight mt-0.5 font-light">{p.tagline}</div>
                        </div>
                      </div>
                      <ul className="space-y-2.5 mb-6">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check size={13} className={`mt-0.5 shrink-0 ${p.checkColor}`} />
                            <span className="text-sm text-white/70 leading-tight">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto opacity-90 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-[1.02] transform">
                        <p.Preview />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

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
