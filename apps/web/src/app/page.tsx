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
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </Link>
        </div>
      </motion.nav>

      {/* Hero e Cards */}
      {/* Ajustado o flex e padding para remover o excesso de espaço centralizado que afastava o hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-20 md:pt-32 pb-20 px-6">
        <div className="max-w-6xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-24"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-8 backdrop-blur-md"
            >
              <Sparkles size={14} />
              <span>IA Jurídica Avançada</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1] drop-shadow-2xl">
              Suíte{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Judicore
                </span>
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-purple-600/20 blur-xl -z-10" />
              </span>
            </h1>
            <p className="text-lg md:text-2xl text-white/60 max-w-2xl mx-auto font-light leading-relaxed">
              Ferramentas inteligentes para operadores do direito. Escolha o módulo que deseja e deixe a IA te ajudar.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Card: Peças Jurídicas */}
            <motion.div custom={0} variants={cardFade} initial="hidden" animate="visible">
              <Link
                href="/login"
                className="group relative block h-full p-8 md:p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-xl overflow-hidden transition-all duration-500 hover:-translate-y-2"
              >
                {/* Efeito Glow Interno */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] pointer-events-none" />
                
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_30px_-10px_rgba(139,92,246,0.4)]">
                  <FileText size={28} className="text-violet-300" />
                </div>
                
                <h2 className="relative z-10 text-3xl font-bold mb-4 tracking-tight group-hover:text-violet-200 transition-colors">Peças Jurídicas</h2>
                <p className="relative z-10 text-white/50 mb-8 leading-relaxed text-lg">
                  Geração de minutas com IA — despachos, decisões, sentenças e petições com base em jurisprudência real do STJ, STF e TRFs. Sem alucinação.
                </p>
                
                <ul className="relative z-10 space-y-4 mb-10">
                  {[
                    "Busca semântica em > 1 milhão de acórdãos",
                    "RAG com citações 100% auditáveis",
                    "Export em DOCX com formatação ABNT",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-white/70 font-medium">
                      <div className="mt-1 rounded-full p-1 bg-violet-500/20 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                        <CheckCircle size={14} />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="relative z-10 flex items-center gap-2 text-violet-400 font-semibold text-lg group-hover:text-violet-300 transition-colors">
                  Acessar Módulo
                  <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </Link>
            </motion.div>

            {/* Card: Cálculos Judiciais */}
            <motion.div custom={1} variants={cardFade} initial="hidden" animate="visible">
              <a
                href={JUDICALC_URL}
                className="group relative block h-full p-8 md:p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-xl overflow-hidden transition-all duration-500 hover:-translate-y-2"
              >
                {/* Efeito Glow Interno */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] pointer-events-none" />
                
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)]">
                  <Calculator size={28} className="text-emerald-300" />
                </div>
                
                <h2 className="relative z-10 text-3xl font-bold mb-4 tracking-tight group-hover:text-emerald-200 transition-colors">Cálculos Judiciais</h2>
                <p className="relative z-10 text-white/50 mb-8 leading-relaxed text-lg">
                  Cálculos previdenciários, trabalhistas e cíveis com índices oficiais do Banco Central — IPCA, SELIC, INPC, TR e demais correções.
                </p>
                
                <ul className="relative z-10 space-y-4 mb-10">
                  {[
                    "Atualização automática via BCB",
                    "Integração SOAP com PJe",
                    "Exportação em PDF e Excel",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-white/70 font-medium">
                      <div className="mt-1 rounded-full p-1 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        <CheckCircle size={14} />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="relative z-10 flex items-center gap-2 text-emerald-400 font-semibold text-lg group-hover:text-emerald-300 transition-colors">
                  Acessar Módulo
                  <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </a>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="relative z-10 mt-auto py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pt-8">
          <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="Judicore" width={60} height={60} className="rounded-lg grayscale hover:grayscale-0 transition-all" />
            <span className="text-white text-sm font-semibold tracking-wide">Judicore</span>
          </div>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="#" className="hover:text-white transition-colors">Privacidade</Link>
            <Link href="#" className="hover:text-white transition-colors">Termos</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
