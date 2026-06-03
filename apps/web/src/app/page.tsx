"use client";

/* ui-redesign: minimal marker update */

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Database, Search, Sparkles } from "lucide-react";

const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login.html";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen relative bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 flex flex-col">

      <div className="dynamic-bg" />

      <header className="z-30 w-full px-6 md:px-12 py-4 flex items-center justify-between band-dark shadow-sm">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="JudiCore" width={120} height={40} className="object-contain" />
          <span className="hidden sm:inline text-sm text-white/90 border-l border-slate-800 pl-4">Suíte de Inteligência Jurídica</span>
        </div>
        <nav className="hidden md:flex items-center gap-5 text-sm text-white/80">
          <Link href="/sobre" className="hover:text-white transition-colors">Sobre</Link>
          <Link href="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
          <Link href="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 md:px-12 py-16">
        <div className="w-full max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">

            <section className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 text-xs font-medium"
              >
                <Sparkles size={11} />
                IA JURÍDICA AVANÇADA
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
                className="text-4xl md:text-5xl font-extrabold leading-tight"
              >
                Inteligência que<br />
                transforma o{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
                  Direito.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="text-slate-500 text-[15px] leading-relaxed max-w-lg"
              >
                Gere peças, realize cálculos e audite documentos jurídicos com base
                na legislação e jurisprudência atualizada dos principais tribunais brasileiros.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {/* JudiCore */}
                <motion.a
                  href="/login"
                  custom={0.1} variants={fadeUp} initial="hidden" animate="visible"
                  className="group block p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">JudiCore</div>
                      <div className="text-[11px] text-slate-400">Geração de Peças</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Petições e recursos fundamentados com jurisprudência real.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-600">Começar</span>
                    <ArrowRight size={13} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.a>

                {/* JudiCalc */}
                <motion.a
                  href={JUDICALC_URL}
                  custom={0.2} variants={fadeUp} initial="hidden" animate="visible"
                  className="group block p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-sky-100 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                      <Database size={16} className="text-sky-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">JudiCalc</div>
                      <div className="text-[11px] text-slate-400">Automação de Cálculos</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Cálculos previdenciários, trabalhistas e cíveis com PJe.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-600">Abrir</span>
                    <ArrowRight size={13} className="text-sky-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.a>

                {/* JudiAudit */}
                <motion.a
                  href="/login"
                  custom={0.3} variants={fadeUp} initial="hidden" animate="visible"
                  className="group block p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-100 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Search size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">JudiAudit</div>
                      <div className="text-[11px] text-slate-400">Auditoria Inteligente</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Score de qualidade, pontos de melhoria e sugestões automáticas.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-600">Auditar</span>
                    <ArrowRight size={13} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.a>
              </motion.div>
            </section>

            <aside className="hidden md:flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-full max-w-sm"
              >
                <div className="rounded-3xl p-8 bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-xl">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Sparkles size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Base de Conhecimento</div>
                      <div className="text-xs text-slate-400">Atualizada diariamente</div>
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-800 mb-1">1M+</div>
                  <div className="text-sm text-slate-500 mb-6">acórdãos e decisões do STJ, STF e TRFs</div>
                  <div className="space-y-2">
                    {[
                      { label: "Precisão média", value: "98%" },
                      { label: "Tempo economizado", value: "−70%" },
                      { label: "Usuários ativos", value: "+10.000" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-xs text-slate-500">{s.label}</span>
                        <span className="text-sm font-bold text-slate-700">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </aside>

          </div>
        </div>
      </main>

      <footer className="py-5 px-6 md:px-12 band-strong border-t border-slate-800 flex items-center justify-between z-20">
        <Image src="/logo.png" alt="JudiCore" width={90} height={30} className="object-contain opacity-100" />
        <p className="text-xs text-white/80">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
