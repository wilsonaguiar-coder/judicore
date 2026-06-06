"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
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

export default function PrivacidadePage() {
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
            <Shield size={11} />
            LGPD — LEI Nº 13.709/2018
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-4">
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
