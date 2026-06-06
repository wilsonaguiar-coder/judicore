"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Gavel, ClipboardCheck, Scale, Sparkles, Shield, Zap, Lock, Link2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SobrePage() {
  const products = [
    {
      icon: <Gavel size={20} className="text-indigo-300" />,
      bg: "from-indigo-600/30 to-violet-600/30 border-indigo-500/20",
      name: "Pesquisa de Jurisprudência",
      accent: "text-indigo-400",
      glow: "hover:border-indigo-500/45 hover:neon-border-indigo",
      sub: "Pesquisa e Geração Inteligente de Peças",
      desc: "Busque em mais de 1 milhão de acórdãos dos principais tribunais e gere petições, decisões e recursos com IA especializada em direito brasileiro.",
    },
    {
      icon: <ClipboardCheck size={20} className="text-amber-300" />,
      bg: "from-amber-600/30 to-orange-600/30 border-amber-500/20",
      name: "Análise de Peças Judiciais",
      accent: "text-amber-400",
      glow: "hover:border-amber-500/45 hover:neon-border-amber",
      sub: "Auditoria Inteligente de Peças",
      desc: "Envie sua peça e receba análise completa com score de qualidade (0–100), pontos de melhoria e sugestões fundamentadas em jurisprudência.",
    },
    {
      icon: <Scale size={20} className="text-cyan-300" />,
      bg: "from-cyan-600/30 to-teal-600/30 border-cyan-500/20",
      name: "Integração com o PJE",
      accent: "text-cyan-400",
      glow: "hover:border-cyan-500/45 hover:neon-border-cyan",
      sub: "Leia e adicione peças diretamente no PJE",
      desc: "Consulte processos, obtenha resumos e análises de documentos, receba dicas processuais e inclua peças diretamente no PJe com IA.",
    },
  ];

  const values = [
    { icon: <Shield size={16} className="text-violet-400" />, label: "Confiável", desc: "Baseado em jurisprudência real dos principais tribunais brasileiros" },
    { icon: <Zap size={16} className="text-amber-400" />,    label: "Rápido",    desc: "IA de alta performance que entrega resultados em segundos" },
    { icon: <Lock size={16} className="text-emerald-400" />, label: "Seguro",    desc: "Seus dados protegidos com criptografia e conformidade LGPD" },
    { icon: <Link2 size={16} className="text-blue-400" />,   label: "Integrado", desc: "Comunicação direta com o Processo Judicial Eletrônico — PJe" },
  ];

  return (
    <div className="min-h-screen bg-[#030014] text-white flex flex-col selection:bg-indigo-500/30 overflow-x-hidden relative">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <motion.div 
          animate={{ 
            x: [0, 80, -80, 0],
            y: [0, -80, 80, 0],
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.7, 0.5] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-500/30 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 100, 0],
            y: [0, 80, -80, 0],
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.6, 0.4] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -right-48 w-[700px] h-[700px] rounded-full bg-fuchsia-500/25 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, 120, -120, 0],
            y: [0, 60, -60, 0],
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.7, 0.5] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-48 left-[20%] w-[800px] h-[800px] rounded-full bg-cyan-500/25 blur-[120px]" 
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_70%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="relative z-20 w-full px-6 md:px-14 py-4 flex items-center justify-between border-b border-white/[0.04] bg-[#030014]/65 backdrop-blur-2xl">
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="JudiCore" width={112} height={38} className="object-contain" priority />
          <span className="hidden sm:inline text-xs text-white/35 border-l border-white/10 pl-4 tracking-wide font-light">
            SUÍTE DE INTELIGÊNCIA JURÍDICA
          </span>
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 transition-colors">
          <ArrowLeft size={15} />
          Voltar à home
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 py-16 flex-1 w-full">

        {/* Badge + Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-xs font-medium mb-5">
            <Sparkles size={11} />
            QUEM SOMOS
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-4">
            Sobre a{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
              JudiCore
            </span>
          </h1>
          <p className="text-white/55 text-lg leading-relaxed max-w-2xl font-light">
            Uma suíte de inteligência artificial jurídica desenvolvida para profissionais
            do direito que buscam agilidade, precisão e qualidade em sua prática diária.
          </p>
        </div>

        {/* Missão */}
        <section className="mb-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-xl hover:border-violet-500/25 transition-all duration-500 hover:neon-border-indigo">
          <h2 className="text-lg font-bold text-white mb-3">Nossa Missão</h2>
          <p className="text-white/60 leading-relaxed font-light">
            Democratizar o acesso à tecnologia jurídica avançada, reduzindo o tempo gasto em
            tarefas repetitivas e aumentando a qualidade das peças produzidas por
            operadores do direito.
          </p>
        </section>

        {/* Produtos */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Nossa Suíte</h2>
          <div className="flex flex-col gap-4">
            {products.map((p) => (
              <div key={p.name} className={`flex gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl backdrop-blur-xl transition-all duration-500 ${p.glow}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.bg} border flex items-center justify-center shrink-0 shadow-lg`}>
                  {p.icon}
                </div>
                <div>
                  <p className="font-bold text-base leading-none mb-0.5">
                    <span className={p.accent}>{p.name}</span>
                    <span className="ml-2 text-xs font-normal text-white/35">{p.sub}</span>
                  </p>
                  <p className="text-sm text-white/55 leading-relaxed mt-2 font-light">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Base de Conhecimento */}
        <section className="mb-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-xl hover:border-violet-500/25 transition-all duration-500 hover:neon-border-indigo">
          <h2 className="text-lg font-bold text-white mb-3">Base de Conhecimento</h2>
          <p className="text-white/60 leading-relaxed mb-4 font-light">
            Nossa base conta com mais de <strong className="text-white/85">1 milhão de acórdãos e decisões</strong> dos
            principais tribunais brasileiros — STJ, STF, TRFs e TJs — atualizados diariamente
            para garantir que a fundamentação jurídica reflita o entendimento atual da jurisprudência.
          </p>
          <p className="text-white/60 leading-relaxed font-light">
            Utilizamos modelos de linguagem de última geração, ajustados para o direito brasileiro,
            garantindo precisão terminológica, coerência argumentativa e conformidade com a
            legislação e o precedente aplicável.
          </p>
        </section>

        {/* Valores */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Nossos Valores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.label} className="flex gap-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl backdrop-blur-xl hover:border-violet-500/25 hover:neon-border-indigo transition-all duration-500">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                  {v.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{v.label}</p>
                  <p className="text-xs text-white/45 mt-1.5 leading-tight font-light">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 md:px-14 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4 bg-[#030014]/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
          <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain grayscale hover:grayscale-0 transition-all" />
        </div>
        <p className="text-xs text-white/30 font-medium tracking-wide">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
