"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { motion } from "framer-motion";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-xl hover:border-violet-500/25 transition-all duration-500 hover:neon-border-indigo">
      <h2 className="text-base font-bold text-white mb-3">{title}</h2>
      <div className="text-white/60 leading-relaxed space-y-2 font-light">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 items-start">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shrink-0 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
      <span className="text-white/60 font-light">{children}</span>
    </li>
  );
}

export default function TermosPage() {
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

        {/* Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-xs font-medium mb-5">
            <FileText size={11} />
            CONDIÇÕES DE USO DA PLATAFORMA
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-4">
            Termos de{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
              Uso
            </span>
          </h1>
          <p className="text-white/35 text-sm">Última atualização: 02 de junho de 2026</p>
        </div>

        <Section title="1. Aceitação dos Termos">
          <p>
            Ao acessar ou utilizar a plataforma JudiCore, o usuário declara ter lido,
            compreendido e concordado integralmente com estes Termos de Uso. Caso não concorde
            com qualquer disposição, deve abster-se de utilizar os serviços.
          </p>
        </Section>

        <Section title="2. Descrição dos Serviços">
          <p>A JudiCore oferece uma suíte de ferramentas jurídicas baseadas em IA:</p>
          <ul className="space-y-1.5 list-none mt-2">
            <Li><strong className="text-white/85">Pesquisa de Jurisprudência:</strong> busca em mais de 1 milhão de acórdãos e geração assistida de peças jurídicas (petições, decisões, sentenças, recursos) fundamentadas em jurisprudência real dos principais tribunais brasileiros.</Li>
            <Li><strong className="text-white/85">Análise de Peças Judiciais:</strong> auditoria inteligente de documentos jurídicos com score de qualidade (0–100), identificação de riscos, inconsistências e sugestões de melhoria fundamentadas em jurisprudência.</Li>
            <Li><strong className="text-white/85">Integração com o PJE:</strong> consulta processual, resumo e análise de documentos do processo, dicas processuais e inclusão de peças diretamente no Processo Judicial Eletrônico.</Li>
          </ul>
        </Section>

        <Section title="3. Público-Alvo e Uso Profissional">
          <p>
            Os serviços são destinados a profissionais do direito — advogados, defensores públicos,
            promotores de justiça, juízes — e a estudantes de direito. O conteúdo gerado pela
            plataforma é uma <strong className="text-white/85">ferramenta de apoio profissional</strong> e
            não substitui o julgamento técnico-jurídico do operador do direito responsável.
          </p>
          <p>
            O usuário é integralmente responsável pela revisão, adequação ao caso concreto
            e protocolo de qualquer peça gerada por meio da plataforma.
          </p>
        </Section>

        <Section title="4. Responsabilidades do Usuário">
          <ul className="space-y-1.5 list-none">
            <Li>Manter a confidencialidade de suas credenciais de acesso</Li>
            <Li>Não compartilhar conta com terceiros</Li>
            <Li>Utilizar a plataforma exclusivamente para fins lícitos e compatíveis com a ética profissional</Li>
            <Li>Verificar a adequação do conteúdo gerado antes de qualquer utilização formal</Li>
          </ul>
        </Section>

        <Section title="5. Uso Proibido">
          <p>É expressamente vedado ao usuário:</p>
          <ul className="space-y-1.5 list-none mt-2">
            <Li>Reproduzir, copiar, redistribuir ou revender a plataforma ou seus componentes</Li>
            <Li>Utilizar a plataforma para atividades ilegais, antiéticas ou que violem o Estatuto da OAB</Li>
            <Li>Realizar engenharia reversa, descompilar ou extrair os modelos de IA da plataforma</Li>
            <Li>Submeter dados de terceiros sem autorização legal adequada</Li>
            <Li>Utilizar mechanisms automatizados para acessar a plataforma além do uso normal</Li>
          </ul>
        </Section>

        <Section title="6. Propriedade Intelectual">
          <p>
            O conteúdo gerado pelo usuário por meio da plataforma pertence ao próprio usuário.
            A plataforma, seu código-fonte, modelos de IA, algoritmos, base de conhecimento
            jurisprudencial e marca são propriedade exclusiva da JudiCore e protegidos pela
            legislação de propriedade intelectual aplicável.
          </p>
        </Section>

        <Section title="7. Limitação de Responsabilidade">
          <p>
            A JudiCore não garante resultados processuais específicos. O conteúdo gerado é
            baseado em jurisprudência e legislação vigentes, mas pode não contemplar todas
            as particularidades do caso concreto.
          </p>
          <p>
            A plataforma é fornecida "como está". A JudiCore não se responsabiliza por
            danos decorrentes do uso inadequado das ferramentas, por decisões judiciais
            desfavoráveis ou por eventuais imprecisões nos dados da base de conhecimento.
          </p>
        </Section>

        <Section title="8. Disponibilidade do Serviço">
          <p>
            A JudiCore empreenderá esforços razoáveis para manter a plataforma disponível
            continuamente, mas não garante disponibilidade ininterrupta. Manutenções
            programadas serão comunicadas com antecedência sempre que possível.
          </p>
        </Section>

        <Section title="9. Planos e Pagamentos">
          <p>
            Os serviços podem estar sujeitos a planos pagos. As condições de cobrança, reembolso
            e cancelamento são detalhadas no momento da contratação e na área do usuário.
            O cancelamento pode ser solicitado a qualquer momento, com efeito no final do período
            contratado.
          </p>
        </Section>

        <Section title="10. Rescisão">
          <p>
            A JudiCore se reserva o direito de suspender ou encerrar o acesso de usuários
            que violem estes Termos, sem prejuízo de outras medidas legais cabíveis. O usuário
            pode encerrar sua conta a qualquer momento por meio das configurações da plataforma.
          </p>
        </Section>

        <Section title="11. Modificações dos Termos">
          <p>
            Estes Termos podem ser atualizados a qualquer momento. Alterações relevantes
            serão comunicadas por e-mail com antecedência mínima de 15 dias. O uso continuado
            da plataforma após a publicação das alterações implica aceitação das novas condições.
          </p>
        </Section>

        <Section title="12. Lei Aplicável e Foro">
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil.
            Fica eleito o foro da Comarca de São Paulo/SP para dirimir eventuais
            controvérsias, com renúncia expressa a qualquer outro, por mais privilegiado
            que seja.
          </p>
        </Section>

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
