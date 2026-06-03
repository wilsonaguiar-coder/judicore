import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Gavel, Calculator, ClipboardCheck, Sparkles, Shield, Zap, Lock, Link2 } from "lucide-react";

export const metadata = { title: "Sobre — JudiCore" };

export default function SobrePage() {
  const products = [
    {
      icon: <Gavel size={20} className="text-indigo-300" />,
      bg: "from-indigo-600/30 to-violet-600/30 border-indigo-500/20",
      name: "JudiCore",
      accent: "text-indigo-400",
      sub: "Geração Inteligente de Peças",
      desc: "Gere petições, decisões, sentenças e recursos com IA especializada, fundamentadas em jurisprudência real do STJ, STF e TRFs.",
    },
    {
      icon: <Calculator size={20} className="text-emerald-300" />,
      bg: "from-emerald-600/30 to-teal-600/30 border-emerald-500/20",
      name: "JudiCalc",
      accent: "text-emerald-400",
      sub: "Automação Completa de Cálculos",
      desc: "Conecte-se ao PJe, gere cálculos previdenciários, trabalhistas e cíveis, assine e protocole diretamente no processo em poucos cliques.",
    },
    {
      icon: <ClipboardCheck size={20} className="text-amber-300" />,
      bg: "from-amber-600/30 to-orange-600/30 border-amber-500/20",
      name: "JudiAudit",
      accent: "text-amber-400",
      sub: "Auditoria Inteligente de Peças",
      desc: "Envie sua peça e receba uma análise completa com score de qualidade, pontos de melhoria e sugestões fundamentadas em jurisprudência.",
    },
  ];

  const values = [
    { icon: <Shield size={16} className="text-violet-400" />, label: "Confiável", desc: "Baseado em jurisprudência real dos principais tribunais brasileiros" },
    { icon: <Zap size={16} className="text-amber-400" />,    label: "Rápido",    desc: "IA de alta performance que entrega resultados em segundos" },
    { icon: <Lock size={16} className="text-emerald-400" />, label: "Seguro",    desc: "Seus dados protegidos com criptografia e conformidade LGPD" },
    { icon: <Link2 size={16} className="text-blue-400" />,   label: "Integrado", desc: "Comunicação direta com o Processo Judicial Eletrônico — PJe" },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-[40%] -left-48 w-[500px] h-[500px] rounded-full bg-violet-700/[0.07] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 w-full px-6 md:px-12 py-4 flex items-center justify-between border-b border-white/[0.05] bg-[#080c14]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="JudiCore" width={110} height={36} className="object-contain" />
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 transition-colors">
          <ArrowLeft size={15} />
          Voltar à home
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 py-16">

        {/* Badge + Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-xs font-medium mb-5">
            <Sparkles size={11} />
            QUEM SOMOS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-4">
            Sobre a{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
              JudiCore
            </span>
          </h1>
          <p className="text-white/55 text-lg leading-relaxed max-w-2xl">
            Uma suíte de inteligência artificial jurídica desenvolvida para profissionais
            do direito que buscam agilidade, precisão e qualidade em sua prática diária.
          </p>
        </div>

        {/* Missão */}
        <section className="mb-10 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">Nossa Missão</h2>
          <p className="text-white/60 leading-relaxed">
            Democratizar o acesso à tecnologia jurídica avançada, reduzindo o tempo gasto em
            tarefas repetitivas e aumentando a qualidade das peças e cálculos produzidos por
            advogados, defensores e membros do Ministério Público em todo o Brasil.
          </p>
        </section>

        {/* Produtos */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Nossa Suíte</h2>
          <div className="flex flex-col gap-4">
            {products.map((p) => (
              <div key={p.name} className="flex gap-4 p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.bg} border flex items-center justify-center shrink-0`}>
                  {p.icon}
                </div>
                <div>
                  <p className="font-bold text-base leading-none mb-0.5">
                    Judi<span className={p.accent}>{p.name.slice(4)}</span>
                    <span className="ml-2 text-xs font-normal text-white/35">{p.sub}</span>
                  </p>
                  <p className="text-sm text-white/55 leading-relaxed mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Base de Conhecimento */}
        <section className="mb-10 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">Base de Conhecimento</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Nossa base conta com mais de <strong className="text-white/85">1 milhão de acórdãos e decisões</strong> dos
            principais tribunais brasileiros — STJ, STF, TRFs e TJs — atualizados diariamente
            para garantir que a fundamentação jurídica reflita o entendimento atual da jurisprudência.
          </p>
          <p className="text-white/60 leading-relaxed">
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
              <div key={v.label} className="flex gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                  {v.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{v.label}</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">Contato</h2>
          <p className="text-white/60 leading-relaxed mb-2">
            Para dúvidas, parcerias, suporte ou imprensa:
          </p>
          <p className="text-indigo-400 font-medium">contato@judicore.com.br</p>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-12 py-5 mt-8 border-t border-white/[0.05] flex items-center justify-between">
        <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain opacity-20" />
        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
