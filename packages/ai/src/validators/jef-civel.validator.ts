// JefCivelValidator — validações específicas para o Juizado Especial Cível (Lei 9.099/95).
//
// Ativado automaticamente quando o draft ou classificação contém contexto de JEF.
//
// Regras fatais (4):   incompetência, valor excedente, recurso errado, perícia complexa
// Regras não-fatais (2): tutela sem fumus, tutela sem periculum

import type { ValidationError, LegalClassification } from "../pipeline/types.js";

// ── Detector de contexto JEF ──────────────────────────────────────────────────

const JEF_CONTEXT_RE =
  /\b(juizado\s+especial\s+c[íi]vel|juizado\s+especial\b|jec\b|lei\s+(?:n[°º\.]\s*)?9\.099|rito\s+sumar[íi]ssimo|recurso\s+inominado|art\.\s*41\s+(?:da\s+)?lei\s+9\.099|competência\s+do\s+juizado)\b/i;

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
      "Valor da causa excede o limite de 40 salários mínimos do JEF (art. 3º, caput, Lei 9.099/95) " +
      "sem que conste renúncia expressa ao excedente — ausência de renúncia invalida a competência.",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      // Detectar valores altos em R$ (acima de ~R$ 48.000 = 40 SM × R$ 1.200)
      const temValorAlto = /r\$\s*(?:\d{1,3}\.)*(?:[5-9]\d{4}|\d{6,})/i.test(draft) ||
        /\b(?:4[1-9]|[5-9]\d|\d{3,})\s+sal[aá]rios?\s+m[íi]nimos?\b/i.test(draft) ||
        /acima\s+de\s+40\s+sal[aá]rios?\s+m[íi]nimos?/i.test(draft);
      if (!temValorAlto) return false;
      // Verificar se há renúncia ao excedente
      const temRenuncia =
        /renunci[ao]\s+ao\s+excedente|renúncia\s+ao\s+valor\s+excedente|renuncia\s+ao\s+que\s+exceder|renuncia\s+expressamente\s+ao\s+excedente/i.test(draft);
      return !temRenuncia;
    },
  },
  {
    rule: "JEF_RECURSO_ERRADO",
    description:
      "Recurso de apelação utilizado em sede de Juizado Especial Cível — o recurso cabível é o " +
      "recurso inominado (art. 41 Lei 9.099/95), não a apelação (art. 1.009 CPC).",
    detect: (draft) => {
      if (!JEF_CONTEXT_RE.test(draft)) return false;
      const temApelacao = /\bapela[cç][aã]o\b/i.test(draft) &&
        !/recurso\s+inominado/i.test(draft);
      // Só dispara em peças que realmente interpõem o recurso errado
      const eRecurso = /apelante|razões\s+de\s+apela[cç][aã]o|interpõe\s+(?:a\s+presente\s+)?apela[cç][aã]o|recorre\s+por\s+meio\s+de\s+apela[cç][aã]o/i.test(draft);
      return temApelacao && eRecurso;
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
