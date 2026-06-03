import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata = { title: "Privacidade — JudiCore" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      <h2 className="text-base font-bold text-white mb-3">{title}</h2>
      <div className="text-white/60 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 items-start">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400/60 shrink-0" />
      <span className="text-white/60">{children}</span>
    </li>
  );
}

export default function PrivacidadePage() {
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

        {/* Título */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300 text-xs font-medium mb-5">
            <Shield size={11} />
            LGPD — LEI Nº 13.709/2018
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-4">
            Política de{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
              Privacidade
            </span>
          </h1>
          <p className="text-white/35 text-sm">Última atualização: 02 de junho de 2026</p>
        </div>

        <Section title="1. Controlador de Dados">
          <p>
            A JudiCore Tecnologia Jurídica é a controladora dos dados pessoais coletados por
            meio desta plataforma, responsável pelas decisões sobre o tratamento dos dados,
            em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
          <p>Contato: <span className="text-indigo-400">privacidade@judicore.com.br</span></p>
        </Section>

        <Section title="2. Dados Coletados">
          <ul className="space-y-1.5 list-none">
            <Li><strong className="text-white/85">Dados de cadastro:</strong> nome completo, endereço de e-mail e número da OAB (opcional).</Li>
            <Li><strong className="text-white/85">Dados de uso:</strong> histórico de peças geradas, pesquisas realizadas e preferências da plataforma.</Li>
            <Li><strong className="text-white/85">Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e cookies de sessão.</Li>
          </ul>
        </Section>

        <Section title="3. Finalidade do Tratamento">
          <p>Os dados pessoais são utilizados para:</p>
          <ul className="space-y-1.5 list-none mt-2">
            <Li>Prestação e melhoria contínua dos serviços contratados</Li>
            <Li>Suporte técnico e atendimento ao usuário</Li>
            <Li>Aprimoramento dos modelos de IA (de forma anonimizada)</Li>
            <Li>Comunicações sobre atualizações, com possibilidade de opt-out a qualquer momento</Li>
          </ul>
        </Section>

        <Section title="4. Base Legal">
          <p>
            O tratamento é realizado com fundamento nos incisos I (consentimento) e IX
            (legítimos interesses) do art. 7º da LGPD, conforme aplicável a cada
            finalidade específica.
          </p>
        </Section>

        <Section title="5. Compartilhamento de Dados">
          <p>Não comercializamos dados pessoais. Podemos compartilhá-los exclusivamente:</p>
          <ul className="space-y-1.5 list-none mt-2">
            <Li>Com prestadores de serviço (hospedagem, processamento de pagamento) sob acordos de confidencialidade</Li>
            <Li>Quando exigido por ordem judicial ou obrigação legal</Li>
          </ul>
        </Section>

        <Section title="6. Retenção de Dados">
          <p>
            Os dados são mantidos pelo período necessário à prestação do serviço ou conforme
            exigido por lei. Após o encerramento da conta, os dados pessoais são eliminados
            em até <strong className="text-white/85">90 dias</strong>, salvo obrigações legais de retenção.
          </p>
        </Section>

        <Section title="7. Direitos do Titular">
          <p>Nos termos dos arts. 17 a 22 da LGPD, você tem direito a:</p>
          <ul className="space-y-1.5 list-none mt-2">
            <Li>Confirmar a existência de tratamento de seus dados</Li>
            <Li>Acessar os dados que mantemos sobre você</Li>
            <Li>Corrigir dados incompletos, inexatos ou desatualizados</Li>
            <Li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</Li>
            <Li>Portabilidade dos dados a outro fornecedor de serviço</Li>
            <Li>Revogar o consentimento a qualquer momento</Li>
          </ul>
          <p className="mt-3">
            Para exercer seus direitos: <span className="text-indigo-400">privacidade@judicore.com.br</span>
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Utilizamos cookies essenciais para o funcionamento da plataforma e cookies
            analíticos para melhoria da experiência do usuário. Você pode gerenciar
            as preferências de cookies nas configurações do seu navegador a qualquer momento.
          </p>
        </Section>

        <Section title="9. Segurança">
          <p>
            Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados,
            incluindo criptografia em trânsito (TLS/HTTPS), controles de acesso por função,
            monitoramento contínuo de segurança e política de senhas robustas.
          </p>
        </Section>

        <Section title="10. Alterações desta Política">
          <p>
            Esta Política pode ser atualizada periodicamente. Comunicaremos alterações
            relevantes por e-mail ou por aviso destacado na plataforma. O uso continuado
            dos serviços após a publicação implica aceitação das novas condições.
          </p>
        </Section>

        <Section title="11. Contato — DPO">
          <p>
            Encarregado de Proteção de Dados (DPO): <span className="text-indigo-400">privacidade@judicore.com.br</span>
          </p>
        </Section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-12 py-5 mt-8 border-t border-white/[0.05] flex items-center justify-between">
        <Image src="/logo.png" alt="JudiCore" width={80} height={26} className="object-contain opacity-20" />
        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} JudiCore. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
