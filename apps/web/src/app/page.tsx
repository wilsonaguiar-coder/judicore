"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Calculator, CheckCircle } from "lucide-react";

// URL do módulo de cálculos. Configurável via env para facilitar testes.
// Ambos os módulos apontam direto para o login da respectiva plataforma
const JUDICALC_URL = process.env["NEXT_PUBLIC_JUDICALC_URL"] ?? "https://calculos.judicore.com.br/login";

const cardFade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col overflow-x-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5 backdrop-blur-xl bg-[#07070f]/80"
      >
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Judicore" width={96} height={96} className="rounded-lg" />
          <span className="text-sm text-white/30 hidden sm:inline">Suíte de ferramentas jurídicas</span>
        </div>
      </motion.nav>

      {/* Hero + Cards */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16 md:py-24">
        <div className="max-w-6xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4">
              Suíte{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Judicore
              </span>
            </h1>
            <p className="text-base md:text-xl text-white/50 max-w-2xl mx-auto">
              Ferramentas inteligentes para operadores do direito.
              Escolha o módulo que deseja e deixe a IA te ajudar.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Módulo Peças Jurídicas */}
            <motion.div custom={0} variants={cardFade} initial="hidden" animate="visible">
              <Link
                href="/login"
                className="group block h-full p-8 md:p-10 rounded-3xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-violet-500/30 transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border border-violet-500/30 flex items-center justify-center mb-6">
                  <FileText size={26} className="text-violet-300" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Peças Jurídicas</h2>
                <p className="text-white/50 mb-6 leading-relaxed">
                  Geração de minutas com IA — despachos, decisões, sentenças e petições com base
                  em jurisprudência real do STJ, STF e TRFs. Sem alucinação.
                </p>
                <ul className="space-y-2 mb-8">
                  {[
                    "Busca semântica em mais de 1 milhão de acórdãos",
                    "RAG com citações 100% auditáveis",
                    "Export em DOCX com formatação ABNT",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                      <CheckCircle size={14} className="text-violet-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 group-hover:text-violet-200 transition-colors">
                  Acessar módulo
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </motion.div>

            {/* Módulo Cálculos Judiciais */}
            <motion.div custom={1} variants={cardFade} initial="hidden" animate="visible">
              <a
                href={JUDICALC_URL}
                className="group block h-full p-8 md:p-10 rounded-3xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600/30 to-teal-600/30 border border-emerald-500/30 flex items-center justify-center mb-6">
                  <Calculator size={26} className="text-emerald-300" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Cálculos Judiciais</h2>
                <p className="text-white/50 mb-6 leading-relaxed">
                  Cálculos previdenciários, trabalhistas e cíveis com índices oficiais do Banco
                  Central — IPCA, SELIC, INPC, TR e demais correções monetárias.
                </p>
                <ul className="space-y-2 mb-8">
                  {[
                    "Atualização automática de índices via BCB",
                    "Integração SOAP com PJe para consulta de processos",
                    "Exportação em PDF e Excel",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                      <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                  Acessar módulo
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Judicore" width={64} height={64} className="rounded-md" />
            <span className="text-white/20 text-sm ml-1">Suíte de ferramentas jurídicas</span>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Judicore</p>
        </div>
      </footer>
    </div>
  );
}
