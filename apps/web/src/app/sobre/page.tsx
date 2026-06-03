import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileText, Database, Search, Sparkles, Shield, Zap, Lock, Link2 } from "lucide-react";

export const metadata = { title: "Sobre — JudiCore" };

export default function SobrePage() {
  const products = [
    {
      icon: <FileText size={20} className="text-violet-300" />,
      bg: "from-violet-600/40 to-indigo-600/40 border-violet-500/30",
      name: "JudiCore",
      accent: "text-violet-400",
      sub: "Geração Inteligente de Peças",
      desc: "Gere petições, decisões, sentenças e recursos com IA especializada, fundamentadas em jurisprudência real do STJ, STF e TRFs.",
    },
    {
      icon: <Database size={20} className="text-emerald-300" />,
      bg: "from-emerald-600/40 to-teal-600/40 border-emerald-500/30",
      name: "JudiCalc",
      accent: "text-emerald-400",
      sub: "Automação Completa de Cálculos",
      desc: "Conecte-se ao PJe, gere cálculos previdenciários, trabalhistas e cíveis, assine e protocole diretamente no processo em poucos cliques.",
    },
    {
      icon: <Search size={20} className="text-amber-300" />,
      bg: "from-amber-600/40 to-orange-600/40 border-amber-500/30",
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
    <div className="min-h-screen relative bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">

      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-6 md:px-12 py-3.5 band-dark shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="JudiCore" width={110} height={36} className="object-contain" />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar à home
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 py-16">

        {/* Badge + Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-5">
            <Sparkles size={11} />
            QUEM SOMOS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-4">
            Sobre a{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
              JudiCore
            </span>
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed max-w-2xl">
            Uma suíte de inteligência artificial jurídica desenvolvida para profissionais
            do direito que buscam agilidade, precisão e qualidade em sua prática diária.
          </p>
        </div>

        {/* Missão */}
        <section className="mb-14 p-6 rounded-2xl glass-card">
          <h2 className="text-xl font-bold mb-3 text-slate-800">Nossa Missão</h2>
          <p className="text-slate-600 leading-relaxed">
            Democratizar o acesso à tecnologia jurídica avançada, reduzindo o tempo gasto em
            tarefas repetitivas e aumentando a qualidade das peças e cálculos produzidos por
            advogados, defensores e membros do Ministério Público em todo o Brasil.
          </p>
        </section>

        {/* Produtos */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-6">Nossa Suíte</h2>
          <div className="flex flex-col gap-4">
            {products.map((p) => (
              <div key={p.name} className="flex gap-4 p-5 rounded-2xl glass-card">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.bg} border flex items-center justify-center shrink-0`}>
                  {p.icon}
                </div>
                <div>
                  <p className="font-bold text-base leading-none mb-0.5">
                    Judi<span className={p.accent}>{p.name.slice(4)}</span>
                    <span className="ml-2 text-xs font-normal text-slate-500">{p.sub}</span>
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Base de Conhecimento */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-4">Base de Conhecimento</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Nossa base conta com mais de <strong className="text-slate-800">1 milhão de acórdãos e decisões</strong> dos
            principais tribunais brasileiros — STJ, STF, TRFs e TJs — atualizados diariamente
            para garantir que a fundamentação jurídica reflita o entendimento atual da jurisprudência.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Utilizamos modelos de linguagem de última geração, ajustados para o direito brasileiro,
            garantindo precisão terminológica, coerência argumentativa e conformidade com a
            legislação e o precedente aplicável.
          </p>
        </section>

        {/* Valores */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-6">Nossos Valores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.label} className="flex gap-3 p-4 rounded-xl glass-sm">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-slate-100 flex items-center justify-center shrink-0">
                  {v.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 leading-none">{v.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section className="p-6 rounded-2xl glass-card">
          <h2 className="text-xl font-bold mb-3">Contato</h2>
          <p className="text-slate-600 leading-relaxed mb-2">
            Para dúvidas, parcerias, suporte ou imprensa:
          </p>
          <p className="text-indigo-600 font-medium">contato@judicore.com.br</p>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-20 band-strong px-6 md:px-12 py-5 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Image src="/logo.png" alt="JudiCore" width={90} height={30} className="object-contain" />
          <p className="text-xs text-white/80">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
