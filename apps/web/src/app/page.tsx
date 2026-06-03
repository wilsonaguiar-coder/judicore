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


const FLOW_STEPS = [
  { n: "1", title: "Captura de Dados",  sub: "Conecte ao PJe e importe o processo" },
  { n: "2", title: "Geração / Cálculo", sub: "IA gera a peça ou realiza os cálculos" },
  { n: "3", title: "Revisão com Audit", sub: "Auditoria aponta melhorias e valida a qualidade" },
  { n: "4", title: "Assinatura",        sub: "Assine com PJeOffice com segurança" },
  { n: "5", title: "Protocolo",         sub: "Envie ao PJe com um único clique" },
];

const STATS = [
  { icon: <Users size={22} className="text-blue-400" />,     value: "+1.000.000", label: "Acórdãos e decisões atualizados diariamente" },
  { icon: <Shield size={22} className="text-emerald-400" />, value: "98%",        label: "Precisão média dos resultados" },
  { icon: <Clock size={22} className="text-amber-400" />,    value: "-70%",       label: "Tempo médio economizado" },
  { icon: <Users size={22} className="text-blue-400" />,     value: "+10.000",    label: "Usuários ativos em todo o Brasil" },
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
    <div className="w-[175px] h-[135px] rounded-xl bg-[#0d1020] border border-violet-500/20 overflow-hidden shrink-0 shadow-xl">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
        {["bg-red-500/60", "bg-yellow-500/60", "bg-green-500/60"].map((c) => (
          <span key={c} className={`w-2 h-2 rounded-full ${c}`} />
        ))}
      </div>
      <div className="px-3 pt-2.5 space-y-2">
        <div className="h-2 rounded-full bg-violet-400/30 w-3/4" />
        <div className="h-2 rounded-full bg-white/10 w-full" />
        <div className="h-2 rounded-full bg-white/10 w-5/6" />
        <div className="h-2 rounded-full bg-white/10 w-4/5" />
        <div className="h-2 rounded-full bg-violet-400/20 w-2/3" />
      </div>
      <div className="flex justify-between items-end px-3 pt-2.5">
        <div className="h-1.5 rounded-full bg-white/8 w-14" />
        <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center">
          <span className="text-[9px] font-bold text-violet-300">A</span>
        </div>
      </div>
    </div>
  );
}

function JudiCalcMockup() {
  const keys = ["7","8","9","×","4","5","6","−","1","2","3","+","0",".",null,"="];
  return (
    <div className="w-[175px] h-[135px] rounded-xl bg-[#0d1a12] border border-emerald-500/20 overflow-hidden shrink-0 shadow-xl p-2.5 flex flex-col gap-2">
      <div className="bg-black/30 rounded px-2.5 py-1 text-right">
        <p className="text-[8px] text-white/30">Total</p>
        <p className="text-[13px] font-bold text-emerald-400">R$ 125.430,87</p>
      </div>
      <div className="grid grid-cols-4 gap-0.5 flex-1">
        {keys.map((k, idx) =>
          k === null ? <div key={idx} /> : (
            <div key={idx} className={`flex items-center justify-center text-[9px] font-semibold rounded
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
    <div className="w-[145px] h-[145px] rounded-xl bg-[#1a1208] border border-amber-500/20 overflow-hidden shadow-xl p-3 flex flex-col gap-2 shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-amber-300/50 uppercase tracking-wide font-semibold">Score</span>
        <span className="text-lg font-extrabold text-amber-400">97</span>
      </div>
      <div className="text-[8px] text-white/25">/100</div>
      <div className="w-full h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: "97%" }} />
      </div>
      <div className="space-y-1 mt-0.5">
        {[
          { ok: true,  label: "Estrutura" },
          { ok: false, label: "Fundament." },
          { ok: true,  label: "Jurisprudência" },
          { ok: true,  label: "Pedidos" },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold ${r.ok ? "text-emerald-400" : "text-amber-400"}`}>{r.ok ? "✓" : "⚠"}</span>
            <span className="text-[9px] text-white/40">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 flex flex-col overflow-x-hidden">

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-8%] left-[10%] w-[680px] h-[680px] rounded-full bg-sky-300/12 blur-[140px]" />
        <div className="absolute top-[28%] right-[-6%] w-[420px] h-[420px] rounded-full bg-indigo-200/10 blur-[120px]" />
        <div className="absolute bottom-[6%] left-[6%] w-[360px] h-[360px] rounded-full bg-rose-200/8 blur-[100px]" />
      </div>

      {/* Navbar — logo esquerda + badge + links Sobre/Privacidade/Termos direita */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex items-center justify-between px-6 md:px-12 py-3.5 border-b border-slate-200/40 backdrop-blur-md bg-white/60"
      >
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="JudiCore" width={110} height={36} className="object-contain" />
          <span className="hidden sm:inline-flex text-[11px] font-semibold text-indigo-600 uppercase tracking-widest border border-indigo-100 rounded px-2.5 py-1">
            Suíte de Inteligência Jurídica
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-5 text-sm text-slate-600">
          <Link href="/sobre" className="hover:text-slate-800 transition-colors">Sobre</Link>
          <Link href="/privacidade" className="hover:text-slate-800 transition-colors">Privacidade</Link>
          <Link href="/termos" className="hover:text-slate-800 transition-colors">Termos de Uso</Link>
        </nav>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-14 md:pt-18">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">

          {/* Coluna esquerda — pb-10 cria respiro acima dos cards; Themis (sem padding) fica colada */}
          <div className="pb-10">
            <motion.div
              custom={0} variants={fadeUp} initial="hidden" animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 text-xs font-medium mb-5"
            "use client";

            import { motion } from "framer-motion";
            import Link from "next/link";
            import Image from "next/image";
            import { ArrowRight, FileText, Database, Search, Sparkles } from "lucide-react";

            const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

            const fadeUp = {
              hidden: { opacity: 0, y: 18 },
              visible: (i = 0) => ({
                opacity: 1, y: 0,
                transition: { delay: i * 0.08, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] },
              }),
            };

            export default function LandingPage() {
              return (
                <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 flex flex-col">

                  <header className="z-20 w-full px-6 md:px-12 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Image src="/logo.png" alt="JudiCore" width={120} height={40} className="object-contain" />
                      <span className="hidden sm:inline text-sm text-slate-600">Suíte de Inteligência Jurídica</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
                      <Link href="/login" className="px-3 py-1 rounded-md bg-slate-100/60 hover:bg-slate-100 transition">Entrar</Link>
                    </nav>
                  </header>

                  <main className="flex-1 flex items-center justify-center px-6 md:px-12 py-12">
                    <div className="w-full max-w-5xl">
                      <div className="grid md:grid-cols-2 gap-12 items-center">

                        <section className="space-y-6">
                          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl md:text-5xl font-extrabold leading-tight">
                            Inteligência que<br />
                            transforma o <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">Direito.</span>
                          </motion.h1>

                          <p className="text-slate-600 max-w-lg">Gere peças, realize cálculos e audite documentos jurídicos com base na legislação e jurisprudência atualizada.</p>

                          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <motion.a initial="hidden" animate="visible" custom={0.1} variants={fadeUp} href="/login" className="group block p-5 rounded-2xl bg-white/60 border border-slate-100 shadow-lg backdrop-blur-md hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                  <FileText size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">JudiCore</div>
                                  <div className="text-xs text-slate-500">Geração Inteligente de Peças</div>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 mb-4">Produza petições e recursos fundamentados automaticamente.</p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-indigo-600">Começar</span>
                                <ArrowRight size={16} className="text-indigo-600" />
                              </div>
                            </motion.a>

                            <motion.a initial="hidden" animate="visible" custom={0.2} variants={fadeUp} href={JUDICALC_URL} className="group block p-5 rounded-2xl bg-white/60 border border-slate-100 shadow-lg backdrop-blur-md hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                                  <Database size={18} className="text-sky-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">JudiCalc</div>
                                  <div className="text-xs text-slate-500">Automação de Cálculos</div>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 mb-4">Cálculos previdenciários, trabalhistas e civis com integração PJe.</p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-sky-600">Abrir</span>
                                <ArrowRight size={16} className="text-sky-600" />
                              </div>
                            </motion.a>

                            <motion.a initial="hidden" animate="visible" custom={0.3} variants={fadeUp} href="/login" className="group block p-5 rounded-2xl bg-white/60 border border-slate-100 shadow-lg backdrop-blur-md hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                  <Search size={18} className="text-amber-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">JudiAudit</div>
                                  <div className="text-xs text-slate-500">Auditoria Inteligente</div>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 mb-4">Receba análise, score e sugestões automáticas para suas peças.</p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-amber-600">Auditar</span>
                                <ArrowRight size={16} className="text-amber-600" />
                              </div>
                            </motion.a>
                          </div>

                        </section>

                        <aside className="hidden md:flex items-center justify-center">
                          <motion.div initial={{ scale: 0.95, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="w-full max-w-sm">
                            <div className="rounded-3xl p-8 bg-gradient-to-br from-white/40 to-slate-50/40 border border-white/50 shadow-xl backdrop-blur-xl">
                              <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center">
                                  <Sparkles size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">Suporte e Confiabilidade</div>
                                  <div className="text-xs text-slate-500">Integração com tribunais e segurança de dados</div>
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-slate-600">Experimente a interface moderna com movimento sutil e componentes em vidro para foco no conteúdo.</div>
                            </div>
                          </motion.div>
                        </aside>

                      </div>
                    </div>
                  </main>

                  <footer className="py-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</footer>

                </div>
              );
            }
                <div>
