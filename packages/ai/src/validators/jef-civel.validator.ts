// JefCivelValidator — validações específicas para o Juizado Especial Cível (Lei 9.099/95).
//
// Ativado automaticamente quando o draft ou classificação contém contexto de JEF.
//
// Regras fatais (4):   incompetência, valor excedente, recurso errado, perícia complexa
// Regras não-fatais (2): tutela sem fumus, tutela sem periculum

import type { ValidationError, LegalClassification } from "../pipeline/types.js";

// ── Detector de contexto JEF ──────────────────────────────────────────────────

const JEF_CONTEXT_RE =
  /\b(juizado\s+especial\s+c[íi]vel|juizado\s+especial\b|jec\b|lei\s+(?:n[°º\.]\s*)?9\.099|lei\s+(?:n[°º\.]\s*)?10\.259|rito\s+sumar[íi]ssimo|recurso\s+inominado|art\.\s*41\s+(?:da\s+)?lei\s+9\.099|competência\s+do\s+juizado)\b/i;

/** Detecta se o draft se refere ao JEF Federal (Lei 10.259/01). */
function isJefFederal(draft: string): boolean {
  return /\b(lei\s+(?:n[°º\.]\s*)?10\.259|juizado\s+especial\s+federal|jef\s+federal|justi[cç]a\s+federal\s+especial|turma\s+recursal\s+federal)\b/i.test(draft);
}

/** Detecta que o draft é um recurso (inominado ou erroneamente nomeado) em contexto JEF. */
const JEF_RECURSO_CONTEXT_RE =
  /\b(recurso\s+inominado|interpõe?\s+(?:o\s+)?(?:presente\s+)?(?:recurso|apela[cç][aã]o)|apelante|recorrente|razões\s+(?:do|de|recursais)\s+(?:recurso|apela[cç][aã]o)|sentença\s+recorrida|decisão\s+recorrida|d[ae]\s+sentença\s+ora\s+recorrida|à?\s*turma\s+recursal|recorre\s+(?:de|da)\s+sentença|contrarrazões)\b/i;

/** Retorna o limite de salários mínimos aplicável ao draft (40 estadual, 60 federal). */
function smLimit(draft: string): number {
  return isJefFederal(draft) ? 60 : 40;
}

// ── Regras fatais ─────────────────────────────────────────────────────────────

const FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string) => boolean;
}> = [
  {
    rule: "JEF_COMPETENCIA",
    description:
      "Causa aparentemente incompatível com o Juizado Especial Cível — matérias excluídas da competência do JEF " +
      "(art. 3º §2º Lei 9.099/95): imóvel, estado das pessoas, falência, acidente de trabalho, " +
      "mandado de segurança, insolvência e causas de natureza fiscal.",
    detect: (draft) => {
      // Verificar se há contexto JEF explícito
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      // Matérias excluídas do JEF (art. 3º §2º Lei 9.099/95)
      const materiaExcluida =
        /\b(im[oó]vel\s+(?:r[úu]stico|urbano)|usucapi[aã]o|divórcio|separa[cç][aã]o\s+judicial|invent[aá]rio|fal[eê]ncia|insolvência|acidente\s+de\s+trabalho|mandado\s+de\s+seguran[cç]a|a[cç][aã]o\s+popular|a[cç][aã]o\s+civil\s+p[úu]blica|execu[cç][aã]o\s+fiscal)\b/i.test(draft);
      if (!materiaExcluida) return false;
      // Só dispara se a peça não reconhece a incompetência
      const reconheceIncompetencia =
        /incompet[eê]ncia|declino\s+da\s+competência|incompetente|remetam-se\s+os\s+autos|remessa\s+(?:dos\s+autos\s+)?(?:ao|para)\s+(?:a\s+)?vara/i.test(draft);
      return !reconheceIncompetencia;
    },
  },
  {
    rule: "JEF_VALOR_EXCEDENTE",
    description:
      "Valor da causa excede o limite de competência do Juizado Especial sem renúncia expressa ao excedente: " +
      "JEF Estadual (Lei 9.099/95): 40 salários mínimos; JEF Federal (Lei 10.259/01): 60 salários mínimos. " +
      "Ausência de renúncia invalida a competência (art. 3º, caput, Lei 9.099/95; art. 3º, §3º, Lei 10.259/01).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const limite = smLimit(draft);
      // Detectar SM numérico explícito acima do limite da jurisdição
      const smMatches = [...draft.matchAll(/\b(\d+)\s+sal[aá]rios?\s+m[íi]nimos?\b/gi)];
      const temSmAlto = smMatches.some((m) => Number.parseInt(m[1]!, 10) > limite);
      // Detectar "acima de N SM" acima do limite
      const acimaRe = new RegExp(`acima\\s+de\\s+${limite}\\s+sal[aá]rios?\\s+m[íi]nimos?`, "i");
      const temAcimaExplicito = acimaRe.test(draft);
      // Detectar R$ acima do limiar aproximado (limite × R$ 1.412, valor atual do SM)
      const thresholdBrl = limite * 1412;
      const brlMatches = [...draft.matchAll(/r\$\s*([\d.,]+)/gi)];
      const temBrlAlto = brlMatches.some((m) => {
        const raw = (m[1] ?? "").replace(/\./g, "").replace(",", ".");
        return Number.parseFloat(raw) > thresholdBrl;
      });
      if (!temSmAlto && !temAcimaExplicito && !temBrlAlto) return false;
      const temRenuncia =
        /renunci[ao]\s+ao\s+excedente|renúncia\s+ao\s+valor\s+excedente|renuncia\s+ao\s+que\s+exceder|renuncia\s+expressamente\s+ao\s+excedente/i.test(draft);
      return !temRenuncia;
    },
  },
  {
    rule: "JEF_RECURSO_ERRADO",
    description:
      "Recurso inadequado utilizado em sede de Juizado Especial — o recurso cabível é o recurso inominado " +
      "(art. 41 Lei 9.099/95; art. 5º Lei 10.259/01). Não são cabíveis: apelação (art. 1.009 CPC), " +
      "agravo de instrumento, recurso ordinário nem recurso especial.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      // Apelação usada sem mencionar recurso inominado
      const temApelacao = /\bapela[cç][aã]o\b/i.test(draft) && !/recurso\s+inominado/i.test(draft);
      // Agravo de instrumento (não cabível no JEF exceto em casos específicos)
      const temAgravo = /\bagravo\s+de\s+instrumento\b/i.test(draft);
      // Recurso ordinário / especial (fora do microssistema)
      const temRecursoFora = /\brecurso\s+(?:ordin[aá]rio|especial|extraordin[aá]rio)\b/i.test(draft);
      const temRecursoErrado = temApelacao || temAgravo || temRecursoFora;
      if (!temRecursoErrado) return false;
      // Confirmar que é uma peça que efetivamente interpõe o recurso (não apenas menciona)
      const eRecurso =
        /apelante|razões\s+de\s+apela[cç][aã]o|interpõe?\s+(?:a\s+presente\s+)?apela[cç][aã]o|recorre\s+por\s+meio\s+de\s+apela[cç][aã]o|interpõe?\s+(?:o\s+presente\s+)?agravo|razões\s+d[eo]\s+agravo|interpõe?\s+(?:o\s+presente\s+)?recurso\s+(?:ordin[aá]rio|especial)/i.test(draft);
      return eRecurso;
    },
  },
  {
    rule: "JEF_PERICIA_COMPLEXA",
    description:
      "Pedido ou deferimento de perícia técnica complexa em sede de Juizado Especial Cível sem " +
      "reconhecer a incompatibilidade com o rito sumaríssimo — o art. 3º §3º da Lei 9.099/95 " +
      "determina que causas de alta complexidade probatória devem ser remetidas à justiça comum; " +
      "perícias médicas especializadas, de engenharia, contábeis aprofundadas e forenses digitais " +
      "são em regra incompatíveis com o rito sumaríssimo.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;

      // Detectar tipos de perícia complexa — abrangendo medicina, engenharia, contabilidade, digital
      const PERICIA_COMPLEXA_RE =
        /per[íi]cia\s+(?:m[eé]dica(?:\s+(?:especializada?|extensa|aprofundada|forense|multidisciplinar|de\s+incapacidade))?|cont[aá]bil(?:\s+(?:complex|detalhada?|aprofundada|extensa))?|de\s+engenharia(?:\s+(?:civil|estrutural|geot[eé]cnica))?|estrutural|grafot[eé]cnica|forense(?:\s+digital)?|multidisciplinar|atuarial|t[eé]cnica\s+(?:especializada?|complex|elaborada|aprofundada))/i;
      const LAUDO_RE =
        /laudo\s+pericial\s+(?:m[eé]dico|cont[aá]bil|de\s+engenharia|estrutural|forense|t[eé]cnico)/i;
      const AVALIACAO_RE =
        /avalia[cç][aã]o\s+(?:m[eé]dica\s+especializada?|multiprofissional|pericial\s+(?:estrutural|cont[aá]bil|t[eé]cnica)|de\s+(?:incapacidade|invalidez|nexo\s+causal))/i;
      const PROVA_TECNICA_RE =
        /produção\s+de\s+prova\s+(?:pericial|t[eé]cnica\s+(?:complex|elaborada|especializada?))|prova\s+pericial\s+(?:é\s+)?(?:necessária|indispensável|imprescindível|complex)/i;

      const temPericia =
        PERICIA_COMPLEXA_RE.test(draft) ||
        LAUDO_RE.test(draft) ||
        AVALIACAO_RE.test(draft) ||
        PROVA_TECNICA_RE.test(draft);
      if (!temPericia) return false;

      // Verificar se a perícia está sendo REQUERIDA ou DEFERIDA (não apenas mencionada)
      const PEDE_PERICIA_RE =
        /requi[re](?:rendo|e-se|imento)?\s+(?:a\s+)?(?:produ[cç][aã]o\s+de\s+)?per[íi]cia|requeiro\s+(?:a\s+)?per[íi]cia|pedido\s+de\s+per[íi]cia|seja\s+(?:nomeado\s+perito|realizada\s+per[íi]cia|determinada\s+a\s+per[íi]cia)|nomeio\s+perito|designo\s+per[íi]cia|determino\s+(?:a\s+)?(?:realiza[cç][aã]o\s+de\s+)?per[íi]cia|defiro\s+(?:a\s+)?per[íi]cia|per[íi]cia\s+(?:é\s+)?(?:indispensável|necessária|imprescindível|fundamental)\s+(?:para|ao?)|(?:é\s+)?(?:essencial|indispensável|imprescindível|necess[aá]ri[ao])\s+a\s+produ[cç][aã]o\s+de\s+prova\s+pericial|requer(?:-se)?\s+.{0,80}produ[cç][aã]o\s+de\s+prova\s+pericial/i;

      if (!PEDE_PERICIA_RE.test(draft)) return false;

      // Não dispara se a peça reconhece explicitamente a incompatibilidade com o JEF
      const RECONHECE_INCOMPAT_RE =
        /incompet[êe]ncia\s+(?:absoluta\s+)?(?:do\s+)?juizado|declino\s+da\s+compet[êe]ncia|incompatível\s+com\s+(?:o\s+)?(?:juizado|rito\s+sumar[íi]ssimo)|supera\s+o\s+rito\s+sumar[íi]ssimo|remessa\s+(?:dos\s+autos\s+)?(?:à|ao)\s+(?:var[ao]\s+)?(?:c[íi]vel\s+)?(?:comum|ordin[aá]ri[ao])|extingue?-se\s+sem\s+julgamento\s+do\s+m[eé]rito\s+por\s+(?:complexidade|incompatibilidade)|causa\s+de\s+alta\s+complexidade.{0,120}incompatível|n[ãa]o\s+(?:demanda|requer|exige)\s+per[íi]cia\s+complex/i;

      return !RECONHECE_INCOMPAT_RE.test(draft);
    },
  },
];

// ── Regras não-fatais ─────────────────────────────────────────────────────────

// Padrão compartilhado: tutela mencionada em qualquer tipo de peça
const TUTELA_MENCIONADA_RE =
  /defiro\s+(?:a\s+)?(?:tutela|liminar|antecipa[cç][aã]o)|concedo\s+(?:a\s+)?(?:tutela|liminar)|requeiro?\s+(?:a\s+)?tutela|pedido\s+de\s+tutela|requer(?:-se)?\s+(?:a\s+)?tutela|tutela\s+(?:de\s+urg[eê]ncia|antecipada|cautelar)\s+(?:é\s+)?(?:cab[íi]vel|adequada|necess[aá]ria|deve\s+ser)|antecipa[cç][aã]o\s+(?:dos\s+efeitos|da\s+tutela)|concessão\s+da\s+(?:tutela|liminar)/i;

const NON_FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string) => boolean;
}> = [
  {
    rule: "JEF_TUTELA_SEM_FUMUS",
    description:
      "Tutela de urgência concedida ou requerida sem análise da probabilidade do direito " +
      "(fumus boni iuris — art. 300 CPC c/c art. 4º Lei 9.099/95). " +
      "Exige-se ao menos um dos seguintes: verossimilhança das alegações, probabilidade do direito, " +
      "prova documental do fundamento ou citação expressa do art. 300 CPC.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!TUTELA_MENCIONADA_RE.test(draft)) return false;
      const temFumus =
        /fumus\s+boni\s+iuris|probabilidade\s+(?:do\s+direito|de\s+procedência)|verossimilhan[cç]a|art\.\s*300\s+(?:do\s+)?cpc|prova\s+(?:documental|inequ[íi]voca|robusta)\s+(?:do\s+direito|da\s+(?:verossimilhança|probabilidade))|aparência\s+do\s+direito|indício\s+(?:sólido|robusto|razo[aá]vel)\s+do\s+direito/i.test(draft);
      return !temFumus;
    },
  },
  {
    rule: "JEF_TUTELA_SEM_PERICULUM",
    description:
      "Tutela de urgência concedida ou requerida sem demonstração de perigo de dano ou risco ao " +
      "resultado útil do processo (periculum in mora — art. 300 CPC c/c art. 4º Lei 9.099/95). " +
      "Exige-se urgência concreta: perigo de dano irreparável, risco de ineficácia ou prejuízo atual demonstrado.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!TUTELA_MENCIONADA_RE.test(draft)) return false;
      const temPericulum =
        /periculum\s+in\s+mora|perigo\s+de\s+dano|risco\s+(?:ao|de)\s+(?:resultado\s+[úu]til|dano\s+irrepará|inutilidade)|urg[eê]ncia\s+(?:comprova|demonstra|evidente|concreta|atual)|dano\s+irrepará|dano\s+de\s+dif[íi]cil\s+repara[cç][aã]o|prejuízo\s+(?:imediato|atual|iminente|concreto)|risco\s+(?:imediato|atual|iminente)\s+de\s+dano/i.test(draft);
      return !temPericulum;
    },
  },
  {
    rule: "JEF_TUTELA_DESPROPORCIONAL",
    description:
      "Tutela de urgência requerida ou concedida com medida desproporcional — bloqueio total de conta " +
      "bancária, suspensão integral de serviço ou cancelamento completo de contrato — sem análise da " +
      "proporcionalidade e da medida menos gravosa (art. 300 CPC; princípio da proporcionalidade). " +
      "A tutela deve ser adequada, necessária e proporcional ao direito tutelado.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!TUTELA_MENCIONADA_RE.test(draft)) return false;
      const medidaAmplа =
        /bloqueio\s+(?:total\s+)?(?:d[ae]\s+)?conta|suspensão\s+(?:total|integral|completa)\s+(?:d[eo]\s+)?(?:serviço|contrato|fornecimento)|cancelamento\s+(?:total|imediato)\s+(?:d[eo]\s+)?(?:contrato|plano|serviço)|bloquear\s+(?:toda[s]?\s+)?(?:a[s]?\s+)?(?:conta[s]?|opera[cç][õo]es)|bloqueio\s+d[ae]\s+(?:conta[s]?|ativo[s]?)/i.test(draft);
      if (!medidaAmplа) return false;
      const temProporcionalidade =
        /proporcionalidade|razoabilidade|medida\s+menos\s+gravosa|medida\s+(?:mais\s+)?adequada|proporcional\s+ao\s+(?:caso|valor|dano)|princípio\s+da\s+proporcionalidade|adequa[cç][aã]o\s+da\s+medida|necess[aá]ria\s+e\s+adequada/i.test(draft);
      return !temProporcionalidade;
    },
  },
  {
    rule: "JEF_TUTELA_ARTIFICIAL",
    description:
      "Urgência invocada para tutela de urgência em situação cronicamente conhecida pela parte — " +
      "mora própria descaracteriza a urgência (art. 300 CPC). O periculum in mora deve ser atual " +
      "e contemporâneo; a parte que deixou fluir longo período sem agir não pode invocar urgência " +
      "fabricada como fundamento para medida de exceção.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temTutela = TUTELA_MENCIONADA_RE.test(draft);
      const temUrgencia =
        /urg[eê]n(?:cia|te)|periculum\s+in\s+mora|perigo\s+de\s+dano\s+irrepará/i.test(draft);
      if (!temTutela || !temUrgencia) return false;
      const temPeríodoLongo =
        /h[aá]\s+(?:mais\s+de\s+)?\d+\s+(?:meses|anos)|desde\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+20(?:2[0-4])|h[aá]\s+(?:dois|três|quatro|cinco|\d+)\s+anos|por\s+mais\s+de\s+\d+\s+(?:meses|anos)/i.test(draft);
      if (!temPeríodoLongo) return false;
      const temExplicacaoRecente =
        /apenas\s+(?:recentemente|agora|neste\s+mês)|fato\s+superveniente|nova\s+circunstância|nova\s+situação|recentemente\s+(?:agravou|deteriorou|piorou|se\s+agravou)|agravamento\s+recente|inesperadamente|de\s+forma\s+repentina|evento\s+recente|situação\s+(?:nova|recente)\s+(?:que|e)/i.test(draft);
      return !temExplicacaoRecente;
    },
  },

  // ── Regras de Recursos nos Juizados (FASE 4.4) ───────────────────────────────

  {
    rule: "JEF_ENDERECAMENTO_ERRADO",
    description:
      "Recurso endereçado ao Tribunal de Justiça, Tribunal Regional Federal, Câmara Cível ou " +
      "desembargadores em vez da Turma Recursal dos Juizados Especiais (art. 41 §1º Lei 9.099/95; " +
      "art. 5º §2º Lei 10.259/01). O único órgão ad quem competente para recursos nos Juizados é " +
      "a Turma Recursal — não o TJ/TRF.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!JEF_RECURSO_CONTEXT_RE.test(draft)) return false;
      const enderecoErrado =
        /(?:excelentíssim[oa]|egrégi[oa]|ilustríssim[oa])\s+(?:senhor[a]?\s+)?desembargador[a]?|tribunal\s+de\s+justiça\s+d[oe]|câmara\s+(?:cível|de\s+direito\s+(?:privado|público))|tribunal\s+regional\s+federal|desembargadores?\s+(?:federais?|estaduais?|integrantes)/i.test(draft);
      const enderecoCorreto =
        /turma\s+recursal\s+(?:dos|do|da|de)\s+(?:juizados?\s+especiais?\s+(?:c[íi]veis|federais?|estaduais?)|jef|jec)|turma\s+recursal\s+(?:cível|federal)/i.test(draft);
      return enderecoErrado && !enderecoCorreto;
    },
  },
  {
    rule: "JEF_PRAZO_ERRADO",
    description:
      "Prazo recursal incorreto em recurso nos Juizados Especiais — o prazo do recurso inominado é " +
      "de 10 (dez) dias (art. 42 Lei 9.099/95; art. 5º Lei 10.259/01), não 15 dias como na " +
      "apelação comum do CPC (art. 1.003 §5º CPC).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!JEF_RECURSO_CONTEXT_RE.test(draft)) return false;
      const prazoCpc =
        /prazo\s+de\s+(?:quinze|15)\s*(?:\(quinze\)\s*)?dias|15\s+\(quinze\)\s+dias\s+(?:para\s+recorrer|recursais?|de\s+recurso)|prazo\s+(?:recursal|para\s+(?:recorrer|apelar))\s+(?:é\s+)?(?:de\s+)?(?:quinze|15)|art\.\s*1\.003\s+(?:§5[oº])?\s+(?:do\s+)?cpc/i.test(draft);
      const prazoCorreto =
        /(?:dez|10)\s+(?:\(dez\)\s+)?dias\s+(?:para\s+recorrer|de\s+(?:prazo|recurso))|prazo\s+de\s+(?:dez|10)\s+dias|art\.\s*42\s+(?:da\s+)?lei\s+9\.099|art\.\s*5[oº]\s+(?:da\s+)?lei\s+10\.259/i.test(draft);
      return prazoCpc && !prazoCorreto;
    },
  },
  {
    rule: "JEF_PREPARO_ERRADO",
    description:
      "Preparo recursal calculado segundo as regras do CPC comum (art. 1.007 CPC) em recurso nos " +
      "Juizados Especiais, sem observar o regramento específico do microssistema " +
      "(Lei 9.099/95; Lei 10.259/01) nem mencionar gratuidade de justiça ou isenção quando aplicável.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!JEF_RECURSO_CONTEXT_RE.test(draft)) return false;
      const mentionaPreparo =
        /preparo\s+recursal|recolhimento\s+do\s+preparo|custas\s+recursais?|guia\s+de\s+recolhimento\s+(?:do\s+)?preparo/i.test(draft);
      if (!mentionaPreparo) return false;
      const preparoCpc =
        /preparo\s+(?:nos\s+termos\s+d[oa]\s+art\.\s*1\.007|calculado\s+(?:sobre|a\s+razão\s+de)\s+[0-9]+%|de\s+[123]%\s+(?:do\s+valor|sobre))|art\.\s*1\.007\s+(?:do\s+)?cpc|tabela\s+(?:de\s+)?custas\s+do\s+(?:tj|tribunal\s+de\s+justiça)/i.test(draft);
      const preparoCorreto =
        /lei\s+9\.099|lei\s+10\.259|isento\s+de\s+preparo|dispensado\s+(?:do\s+)?preparo|gratuidade\s+(?:de\s+)?(?:justiça|judici[aá]ria)|benefici[aá]rio\s+(?:da\s+)?(?:assistência\s+)?judici[aá]ria\s+gratuita|regimento\s+(?:interno\s+)?(?:da\s+)?turma\s+recursal/i.test(draft);
      return preparoCpc && !preparoCorreto;
    },
  },
  {
    rule: "JEF_PEDIDO_INCOMPATIVEL",
    description:
      "Pedido recursal incompatível com o microssistema dos Juizados Especiais — requer remessa ao " +
      "TJ/TRF, recebimento como apelação comum ou julgamento por Câmara Cível, em vez de pedir " +
      "que a Turma Recursal conheça e dê provimento ao recurso inominado " +
      "(art. 41 Lei 9.099/95; art. 5º Lei 10.259/01).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      if (!JEF_RECURSO_CONTEXT_RE.test(draft)) return false;
      const pedidoErrado =
        /(?:remetam-se?|remeta-se)\s+os\s+autos\s+ao?\s+(?:tribunal(?!\s+recursal)|t[jrf]|tribunal\s+de\s+justiça|tribunal\s+regional)|conhecer\s+(?:e\s+(?:dar|negar)\s+provimento\s+(?:à|a)\s+(?:a\s+)?)?apela[cç][aã]o(?!\s+(?:inominada|voluntária))|receber\s+(?:o\s+(?:presente\s+)?recurso\s+)?como\s+apela[cç][aã]o|câmara\s+cível\s+(?:julgue|aprecie|decida|conheça)|após\s+(?:as\s+)?contrarrazões?\s+(?:subam|subir)\s+ao\s+tribunal(?!\s+recursal)|distribuição\s+ao?\s+(?:livre|prevento)\s+(?:n[oa]\s+)?(?:tribunal|câmara)\s+(?!recursal)/i.test(draft);
      const pedidoCorreto =
        /turma\s+recursal|recurso\s+inominado\s+(?:seja\s+)?(?:conhecido|provido|improvido|recebido)|dar\s+provimento\s+ao\s+recurso(?!\s+de\s+apela[cç][aã]o)/i.test(draft);
      return pedidoErrado && !pedidoCorreto;
    },
  },
];

// ── JefCivelValidator ─────────────────────────────────────────────────────────

export class JefCivelValidator {
  validate(
    draft: string,
    classification: LegalClassification,
  ): { errors: ValidationError[] } {
    if (!this.isJefContext(draft, classification)) {
      return { errors: [] };
    }

    const errors: ValidationError[] = [];

    for (const rule of FATAL_RULES) {
      if (rule.detect(draft)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: true });
      }
    }

    for (const rule of NON_FATAL_RULES) {
      if (rule.detect(draft)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: false });
      }
    }

    return { errors };
  }

  private isJefContext(draft: string, classification: LegalClassification): boolean {
    return (
      JEF_CONTEXT_RE.test(classification.assunto_principal ?? "") ||
      JEF_CONTEXT_RE.test(draft)
    );
  }
}
