"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, FileText, Shield, Zap, Scale, Brain,
  ArrowRight, CheckCircle, Lock, BookOpen, BarChart3,
  Clock, Sparkles, Database, ChevronRight, AlertTriangle,
  Gavel, ScrollText, Download,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={isInView ? "visible" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

function TypingText({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length]!;
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1));
        if (text.length + 1 === current.length) setTimeout(() => setDeleting(true), 1800);
      } else {
        setText(current.slice(0, text.length - 1));
        if (text.length === 0) { setDeleting(false); setIndex((i) => i + 1); }
      }
    }, deleting ? 40 : 80);
    return () => clearTimeout(timeout);
  }, [text, deleting, index, phrases]);

  return (
    <span className="text-violet-400">
      {text}
      <span className="animate-pulse">|</span>
    </span>
  );
}

const FEATURES = [
  { icon: Search, title: "Busca Semântica", desc: "Elasticsearch com analyzer jurídico português. Fuzziness automático para variações ortográficas e terminologia técnica." },
  { icon: Shield, title: "Zero Alucinação", desc: "A IA só cita o que está na base. Se não encontrou, informa. Nenhum processo, relator ou data inventada — jamais." },
  { icon: Brain, title: "Geração RAG", desc: "Retrieval-Augmented Generation: jurisprudência real primeiro, IA depois. Contexto fechado garante citações auditáveis." },
  { icon: ScrollText, title: "Minutas ABNT", desc: "Despachos, decisões e sentenças geradas com formatação ABNT — Times New Roman, 1,5 de espaçamento, margens corretas." },
  { icon: Download, title: "Export DOCX", desc: "Download direto em .docx com fontes e referências numeradas. Pronto para editar no Word ou LibreOffice." },
  { icon: BarChart3, title: "Atualização Contínua", desc: "Jobs automáticos noturnos indexam novos acórdãos do DataJud, STJ e STF. Base sempre atualizada sem intervenção manual." },
];

const STEPS = [
  { num: "01", icon: Gavel, title: "Descreva o caso", desc: "Informe a área do direito, o tema jurídico e os dados do processo. O sistema entende linguagem natural." },
  { num: "02", icon: Search, title: "Busca real nos tribunais", desc: "O Elasticsearch pesquisa acórdãos reais do STJ, STF e TRFs. Você seleciona os mais relevantes." },
  { num: "03", icon: FileText, title: "Minuta gerada com IA", desc: "A IA recebe apenas os acórdãos que você selecionou e gera o documento — sem inventar nada além do contexto." },
];

const TRIBUNAIS = ["STJ", "STF", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "DataJud/CNJ"];

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5 backdrop-blur-xl bg-[#07070f]/80"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Scale size={14} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Judicore</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-white/60 hover:text-white transition-colors hidden md:block"
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
          >
            Acessar sistema <ArrowRight size={13} />
          </Link>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-600/8 blur-[80px]" />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8">
            <Sparkles size={11} />
            Sistema de apoio à decisão judicial · Powered by RAG
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
          >
            Jurisprudência real.{" "}
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Minutas que convencem.
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Busca nos tribunais federais, seleciona os acórdãos relevantes e gera{" "}
            <TypingText phrases={["despachos.", "decisões.", "sentenças.", "minutas ABNT."]} />{" "}
            Sem inventar uma única citação.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.25 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/login"
              className="group flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-semibold text-sm transition-all hover:shadow-2xl hover:shadow-violet-500/30 hover:-translate-y-0.5"
            >
              Acessar o sistema
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#como-funciona"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all"
            >
              Ver como funciona
            </a>
          </motion.div>

          {/* App Preview Mock */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.4 }}
            className="mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070f] via-transparent to-transparent z-10 pointer-events-none" style={{ top: "60%" }} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/60 p-1">
              {/* Window bar */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-4 h-5 rounded-md bg-white/5 flex items-center px-3">
                  <span className="text-white/20 text-[10px]">judicore.com.br/dashboard</span>
                </div>
              </div>
              {/* Mock content */}
              <div className="grid grid-cols-3 h-64 divide-x divide-white/5">
                {/* Search col */}
                <div className="p-4 space-y-3">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">Busca</div>
                  <div className="h-7 rounded-lg bg-white/5 border border-white/10 flex items-center px-3 gap-2">
                    <Search size={10} className="text-violet-400" />
                    <span className="text-[10px] text-white/30">responsabilidade do Estado</span>
                  </div>
                  <div className="space-y-1.5">
                    {["STJ", "TRF3", "STF"].map((t) => (
                      <div key={t} className="h-5 rounded bg-violet-500/20 flex items-center px-2">
                        <span className="text-[9px] text-violet-300">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Results col */}
                <div className="p-4 space-y-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">48 resultados</div>
                  {[92, 88, 85].map((score, i) => (
                    <div key={i} className={`p-2 rounded-lg border transition-colors ${i === 0 ? "border-violet-500/40 bg-violet-500/10" : "border-white/5 bg-white/[0.02]"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-violet-300 font-medium">REsp 1.234.567</span>
                        <span className="text-[9px] text-white/30">{score}%</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="h-1.5 rounded bg-white/10 w-full" />
                        <div className="h-1.5 rounded bg-white/10 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Document col */}
                <div className="p-4 space-y-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">Gerando decisão</div>
                  <div className="space-y-1.5">
                    {[1, 0.7, 0.9, 0.5, 0.8, 0.6].map((w, i) => (
                      <motion.div
                        key={i}
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: `${w * 100}%`, opacity: 1 }}
                        transition={{ delay: 0.8 + i * 0.2, duration: 0.6 }}
                        className="h-1.5 rounded bg-gradient-to-r from-violet-500/40 to-indigo-500/40"
                      />
                    ))}
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.4 }}
                    className="mt-3 flex items-center gap-1.5 text-[9px] text-emerald-400"
                  >
                    <CheckCircle size={9} />
                    Documento gerado
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <AnimatedSection className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "4.000+", label: "Acórdãos indexados" },
            { value: "3", label: "Fontes oficiais" },
            { value: "8", label: "Áreas do direito" },
            { value: "0", label: "Citações inventadas" },
          ].map((stat) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <div className="text-3xl font-extrabold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">{stat.value}</div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>

      {/* ── Problema ── */}
      <section className="py-24 px-6">
        <AnimatedSection className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-rose-400">O problema</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4">Pesquisar jurisprudência<br />consome o seu tempo.</h2>
            <p className="text-white/40 max-w-xl mx-auto">E quando você recorre a ferramentas de IA, corre o risco de citar processos que não existem.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Clock, color: "rose", title: "Horas perdidas", desc: "Buscar manualmente em portais de tribunais, copiar ementas, verificar datas — um processo que deveria levar minutos leva horas." },
              { icon: AlertTriangle, color: "amber", title: "IA que inventa", desc: "ChatGPT e similares geram números de processo, relatores e datas plausíveis — mas fictícios. Uma citação errada compromete a decisão." },
              { icon: FileText, color: "blue", title: "Formatação manual", desc: "Mesmo com o conteúdo em mãos, adequar à ABNT consome mais tempo. Margens, espaçamento, capa — tudo feito à mão." },
            ].map(({ icon: Icon, color, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="p-6 rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  color === "rose" ? "bg-rose-500/15 text-rose-400" :
                  color === "amber" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
                }`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="py-24 px-6 bg-white/[0.015]">
        <AnimatedSection className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">Como funciona</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3">Três passos.<br />Do caso à minuta.</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-violet-500/50 to-indigo-500/50" />
            {STEPS.map(({ num, icon: Icon, title, desc }) => (
              <motion.div key={num} variants={fadeUp} className="relative text-center p-8 rounded-2xl border border-white/8 bg-white/[0.03] hover:border-violet-500/30 transition-all hover:-translate-y-1">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                  <Icon size={22} className="text-violet-400" />
                </div>
                <div className="text-xs font-bold text-violet-500 mb-2">{num}</div>
                <h3 className="font-bold text-lg mb-3">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6">
        <AnimatedSection className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">Funcionalidades</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3">Tudo que você precisa.<br />Nada que não precisa.</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ scale: 1.02, borderColor: "rgba(139, 92, 246, 0.3)" }}
                className="group p-6 rounded-2xl border border-white/8 bg-white/[0.03] transition-all cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                  <Icon size={18} className="text-violet-400" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ── Anti-alucinação ── */}
      <section className="py-24 px-6">
        <AnimatedSection className="max-w-4xl mx-auto">
          <motion.div
            variants={fadeUp}
            className="relative p-10 md:p-14 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-indigo-950/60 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-indigo-600/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Lock size={18} className="text-violet-300" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-violet-300">Garantia anti-alucinação</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight">
                A IA só fala o que<br />
                <span className="text-violet-300">está na base.</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-2xl">
                O Judicore usa RAG — Retrieval-Augmented Generation. O Elasticsearch busca os acórdãos reais primeiro. Somente depois, com o contexto fechado, a IA gera o texto. Cinco regras absolutas no sistema impedem qualquer citação fora do contexto fornecido.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "Nunca cita processo ausente no contexto",
                  "Nunca menciona tribunal não encontrado",
                  "Nunca inventa datas ou ementas",
                  "Informa quando o contexto é insuficiente",
                  "Cita apenas relator, tribunal e data do contexto",
                  "Auditável: cada citação tem link para a fonte",
                ].map((rule) => (
                  <div key={rule} className="flex items-start gap-2.5 text-sm text-white/60">
                    <CheckCircle size={14} className="text-violet-400 mt-0.5 shrink-0" />
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ── Tribunais ── */}
      <section className="py-16 px-6 border-y border-white/5">
        <AnimatedSection className="max-w-4xl mx-auto text-center">
          <motion.p variants={fadeIn} className="text-xs uppercase tracking-widest text-white/30 mb-8">
            Acórdãos indexados de
          </motion.p>
          <div className="flex flex-wrap justify-center gap-3">
            {TRIBUNAIS.map((t) => (
              <motion.div
                key={t}
                variants={fadeUp}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm font-medium text-white/50 hover:text-white/80 hover:border-violet-500/30 transition-all"
              >
                {t}
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/12 blur-[100px]" />
        </div>
        <AnimatedSection className="max-w-3xl mx-auto text-center relative">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8">
            <Sparkles size={11} />
            Disponível agora
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Decida com mais{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              segurança.
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/40 text-lg mb-10">
            Pare de gastar horas em pesquisa manual. Deixe o Judicore encontrar, o Judicore citar — e você decidir.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-semibold text-base transition-all hover:shadow-2xl hover:shadow-violet-500/30 hover:-translate-y-1"
            >
              Acessar o sistema
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Scale size={12} className="text-white" />
            </div>
            <span className="font-bold text-sm">Judicore</span>
            <span className="text-white/20 text-sm ml-2">Sistema de apoio à decisão judicial</span>
          </div>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} Judicore · Dados indexados de fontes oficiais públicas
          </p>
        </div>
      </footer>
    </div>
  );
}
