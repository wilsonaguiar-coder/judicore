import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = { title: "Termos de Uso — JudiCore" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 glass-card p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 items-start">
      <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-200 shrink-0" />
      <span className="text-slate-600">{children}</span>
    </li>
  );
}

export default function TermosPage() {
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

        {/* Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200/40 bg-indigo-50 text-indigo-600 text-xs font-medium mb-5">
            <FileText size={11} />
            CONDIÇÕES DE USO DA PLATAFORMA
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-4">
            Termos de{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
              Uso
            </span>
          </h1>
          <p className="text-slate-500 text-sm">Última atualização: 02 de junho de 2026</p>
        </div>

        <div className="prose-content">

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
              <Li><strong className="text-slate-800">JudiCore:</strong> geração assistida de peças jurídicas (petições, decisões, sentenças, recursos) com base em jurisprudência dos principais tribunais brasileiros.</Li>
              <Li><strong className="text-slate-800">JudiCalc:</strong> automação de cálculos previdenciários, trabalhistas e cíveis com integração ao PJe via SOAP.</Li>
              <Li><strong className="text-slate-800">JudiAudit:</strong> auditoria e análise de qualidade de documentos jurídicos com pontuação e sugestões de melhoria.</Li>
            </ul>
          </Section>

          <Section title="3. Público-Alvo e Uso Profissional">
            <p>
              Os serviços são destinados a profissionais do direito — advogados, defensores públicos,
              promotores de justiça, juízes — e a estudantes de direito. O conteúdo gerado pela
              plataforma é uma <strong className="text-slate-800">ferramenta de apoio profissional</strong> e
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
              <Li>Utilizar mecanismos automatizados para acessar a plataforma além do uso normal</Li>
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

          <Section title="13. Contato">
            <p>
              Para dúvidas sobre estes Termos: <span className="text-indigo-600">contato@judicore.com.br</span>
            </p>
          </Section>

        </div>
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
