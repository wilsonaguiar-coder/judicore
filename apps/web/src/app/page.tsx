"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-400 flex items-center justify-center font-bold shadow-sm text-white">JC</div>
          <div className="text-sm font-semibold">JudiCore</div>
        </div>
        <nav className="flex items-center gap-4 text-sm text-slate-700">
          <Link href="/sobre" className="hover:text-slate-900">Sobre</Link>
          <Link href="/contato" className="hover:text-slate-900">Contato</Link>
          <Link href="/login" className="btn-primary">Entrar</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-3 bg-slate-100 text-slate-700 rounded-full py-1.5 px-3 text-xs w-max">
              IA Jurídica • Processos & Jurisprudência
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight text-slate-900">
              Inteligência que transforma o <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-emerald-500">Direito</span>
            </h1>

            <p className="text-slate-600 max-w-2xl text-lg">
              Automação e análise jurídica de ponta: gere peças, realize cálculos e audite documentos com base em legislação e jurisprudência sempre atualizadas.
            </p>

            <div className="flex items-center gap-6">
              <div>
                <div className="text-4xl font-extrabold text-slate-900">1M+</div>
                <div className="text-sm text-slate-500">Acórdãos atualizados diariamente</div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-xs">Confiável</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-xs">Seguro</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
              <div className="card">
                <div className="font-medium text-slate-900">Geração de peças</div>
                <div className="text-xs text-slate-500">Modelos e automações prontos</div>
              </div>
              <div className="card">
                <div className="font-medium text-slate-900">Cálculos avançados</div>
                <div className="text-xs text-slate-500">Precisão e auditoria</div>
              </div>
              <div className="card">
                <div className="font-medium text-slate-900">Auditoria</div>
                <div className="text-xs text-slate-500">Checks por jurisprudência</div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="relative w-full h-[520px] rounded-3xl bg-slate-50 flex items-center justify-center shadow-lg">
              <div className="w-[360px] h-[480px] bg-cover bg-center rounded-2xl overflow-hidden border border-slate-100" style={{backgroundImage: "url('/themis.png')"}} />
            </div>
          </aside>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-lg">
            <h3 className="font-semibold text-slate-900">Base de Conhecimento</h3>
            <p className="text-sm text-slate-500">1M+ acórdãos indexados e consultáveis.</p>
          </div>
          <div className="card-lg">
            <h3 className="font-semibold text-slate-900">Segurança</h3>
            <p className="text-sm text-slate-500">Controles, logs e auditoria.</p>
          </div>
          <div className="card-lg">
            <h3 className="font-semibold text-slate-900">Integrações</h3>
            <p className="text-sm text-slate-500">Conecte ao PJe e sistemas internos.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100/30 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-slate-500">
          <div>© {new Date().getFullYear()} JudiCore</div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="hover:text-slate-700">Privacidade</Link>
            <Link href="/termos" className="hover:text-slate-700">Termos</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
