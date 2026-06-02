// ExecutionValidator — Especificação técnica para Execução / Cumprimento de Sentença.
//
// STATUS: especificação — NÃO integrado ao pipeline ainda (Fase 3).
//
// Cobre os 10 tipos de regra mais críticos na fase executiva do CPC/2015:
//   FATAL (bloqueantes):    7 regras
//   NÃO-FATAL (ressalvas):  10 regras
//
// Integração futura: registrar em FinalValidator como mais um ValidatorComponent,
// ativado quando classification.area === "EXECUCAO_CUMPRIMENTO" (Fase 4).

import type { ValidationError, TipoPeca } from "../pipeline/types.js";

// ── Contexto de execução ─────────────────────────────────────────────────────

export interface ExecutionContext {
  tipo_peca: TipoPeca;
  is_fazenda_publica?: boolean;   // executado é ente público
  valor_exequendo?: number;       // valor total da execução
  tem_impugnacao?: boolean;       // há impugnação pendente
}

// ── Regras ───────────────────────────────────────────────────────────────────

// Regras fatais — erros jurídicos graves e objetivamente verificáveis
const FATAL_RULES = [
  {
    rule: "EC_RITO_FAZENDA_IGNORADO",
    description: "Cumprimento contra Fazenda Pública processado pelo rito comum (art. 523 CPC) em vez do rito especial (arts. 534/535 CPC + precatório/RPV — art. 100 CF/88).",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.is_fazenda_publica) return false;
      const lower = draft.toLowerCase();
      const temRitoComum = /multa\s+de\s+10[%]|art\.\s*523|penhora\s+imedia/i.test(draft);
      const temRitoEspecial = /precat[oó]rio|rpv|requisi[cç][aã]o\s+de\s+pequeno\s+valor|art\.\s*534|art\.\s*535/i.test(draft);
      return temRitoComum && !temRitoEspecial && lower.includes("fazenda");
    },
  },
  {
    rule: "EC_PENHORA_SALARIO_TOTAL",
    description: "Penhora de 100% de salário/aposentadoria do executado — viola impenhorabilidade do art. 833, IV, CPC. Limite jurisprudencial: até 30% em casos excepcionais (EREsp 1.518.169/DF).",
    detect: (draft: string, _ctx: ExecutionContext): boolean => {
      const lower = draft.toLowerCase();
      const penhoraTotal = /penhora\s+(?:d[oe]s?|sobre|integral|total|de\s+100[%])/i.test(draft) &&
        /sal[aá]rio|vencimento|remunera[cç][aã]o|aposentadoria|proventos/i.test(draft);
      const temProtecao = /art\.\s*833|impenhor[aá]vel|limite|30[%]|eresp\s*1\.?518/i.test(draft);
      return penhoraTotal && !temProtecao;
    },
  },
  {
    rule: "EC_BEM_FAMILIA_PENHORADO",
    description: "Penhora de imóvel residencial único do executado — bem de família (Lei 8.009/90) é impenhorável (art. 833, VIII, CPC), salvo exceções taxativas (dívida de IPTU, fiança, etc.).",
    detect: (draft: string, _ctx: ExecutionContext): boolean => {
      const penhoraImovel = /penhora[^.]{0,60}im[oó]vel/i.test(draft) ||
        /im[oó]vel[^.]{0,60}penhor/i.test(draft);
      const temProtecao = /bem\s+de\s+fam[ií]lia|lei\s+8\.009|impenhor[aá]vel|art\.\s*833/i.test(draft);
      return penhoraImovel && !temProtecao;
    },
  },
  {
    rule: "EC_PRESCRICAO_INTERCORRENTE_IGNORADA",
    description: "Processo paralisado há mais de 5 anos sem movimentação útil do exequente — prescrição intercorrente não declarada (art. 921 §4º CPC), apesar de configurada.",
    detect: (draft: string, _ctx: ExecutionContext): boolean => {
      const temParalisacao = /parali[sz]/i.test(draft) || /sem\s+movimenta[cç][aã]o/i.test(draft);
      const temPrescricao = /prescri[cç][aã]o\s+intercorrente|art\.\s*921|art\.\s*924|tema\s+stj\s+1\.?062/i.test(draft);
      return temParalisacao && !temPrescricao;
    },
  },
  {
    rule: "EC_EXCESSO_EXECUCAO_IGNORADO",
    description: "Impugnação por excesso de execução (art. 525 §1º, III, CPC) não analisada — penhora mantida pelo valor maior sem exame do cálculo correto.",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.tem_impugnacao) return false;
      const temExcesso = /excesso\s+de\s+execu[cç][aã]o|art\.\s*525/i.test(draft);
      const foiAnalisado = /an[aá]lis[eo]|examin[ao]|calcul[ao]|per[ií]cia\s+cont[aá]bil/i.test(draft);
      return temExcesso && !foiAnalisado;
    },
  },
  {
    rule: "EC_JUROS_ILEGAIS",
    description: "Juros moratórios calculados fora do padrão legal — taxa superior à SELIC (art. 406 CC) sem base legal expressa, ou aplicação de juros compostos em execução de sentença.",
    detect: (draft: string, _ctx: ExecutionContext): boolean => {
      const taxaAbusiva = /juros\s+de\s+(?:\d+(?:,\d+)?)\s*%\s*(?:ao|a\.?o\.?)\s*m[eê]s/i.exec(draft);
      if (!taxaAbusiva) return false;
      const match = taxaAbusiva[0].match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (!match) return false;
      const taxa = parseFloat(match[1]!.replace(",", "."));
      return taxa > 1.5; // acima de 1,5% ao mês é juridicamente suspeito sem base específica
    },
  },
  {
    rule: "EC_TITULO_INEXIGIVEL_IGNORADO",
    description: "Impugnação por inexigibilidade do título (art. 525 §1º, I, CPC) não analisada — citação nula ou incompetência absoluta não examinadas.",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.tem_impugnacao) return false;
      const temInexigibilidade = /inexigibilidade|art\.\s*525[^,]{0,20}I\b|cite[^.]*nul/i.test(draft);
      const foiAnalisado = /examin[ao]|an[aá]lis[eo]|[ié]\s+[ée]xig[ií]vel|compet[eê]ncia/i.test(draft);
      return temInexigibilidade && !foiAnalisado;
    },
  },
];

// Regras não-fatais — avisos e ressalvas
const NON_FATAL_RULES = [
  {
    rule: "EC_SISBAJUD_SEM_GRADACAO",
    description: "Penhora eletrônica deferida sem observar a ordem de preferência do art. 835 CPC — dinheiro/crédito bancário tem prioridade, mas deve ser mencionada a gradação.",
    detect: (draft: string, _ctx: ExecutionContext): boolean =>
      /sisbajud|bacenjud|penhora\s+eletr[oô]nica/i.test(draft) &&
      !/art\.\s*835|ordem\s+de\s+prefer[eê]ncia|gradac[aã]o/i.test(draft),
  },
  {
    rule: "EC_RENAJUD_SEM_AVALIACAO",
    description: "Restrição de veículo via RENAJUD deferida sem mencionar a necessidade de avaliação prévia (art. 870 CPC) antes da alienação.",
    detect: (draft: string, _ctx: ExecutionContext): boolean =>
      /renajud|restri[cç][aã]o\s+veicular/i.test(draft) &&
      !/avalia[cç][aã]o|art\.\s*870|art\.\s*879/i.test(draft),
  },
  {
    rule: "EC_CORRECAO_INDICE_INADEQUADO",
    description: "Índice de correção monetária diferente do IPCA-E — padrão consolidado pelo STJ para condenações civis (Tema 905 / REsp 1.492.221). Índices como IGP-M geram revisão obrigatória.",
    detect: (draft: string, _ctx: ExecutionContext): boolean =>
      /igp-?m|inpc|tr\b|ufir/i.test(draft) &&
      !/ressalva|tese\s+defensiva|requer(?:id)?[ao]|alega/i.test(draft),
  },
  {
    rule: "EC_ASTREINTES_SEM_PARAMETRO",
    description: "Fixação ou cobrança de astreintes sem indicar o parâmetro de razoabilidade (art. 537 §1º CPC) — ausência de análise sobre proporcionalidade da multa acumulada.",
    detect: (draft: string, _ctx: ExecutionContext): boolean =>
      /astreinte|multa\s+(?:di[aá]ria|cominat[oó]ria|por\s+atraso)/i.test(draft) &&
      !/art\.\s*537|proporcionalidade|razoabilidade|reduz[ij]|modif/i.test(draft),
  },
  {
    rule: "EC_HONORARIOS_FASE_EXECUCAO",
    description: "Honorários da fase de cumprimento não fixados ou fixados sem mencionar os 10% do art. 523 §1º CPC (multa) e os honorários adicionais do art. 85 CPC.",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (ctx.tipo_peca !== "SENTENCA" && ctx.tipo_peca !== "DECISAO") return false;
      const temHonorarios = /honorar/i.test(draft);
      const temArt523 = /art\.\s*523|10\s*%\s*(?:de\s+)?multa/i.test(draft);
      return !temHonorarios || !temArt523;
    },
  },
  {
    rule: "EC_REMESSA_NECESSARIA_FAZENDA",
    description: "Sentença proferida contra Fazenda Pública sem verificar o cabimento de remessa necessária (art. 496 CPC) — obrigatória para condenações acima de 100/500/1000 salários mínimos conforme o ente.",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.is_fazenda_publica) return false;
      if (ctx.tipo_peca !== "SENTENCA") return false;
      return !/remessa\s+necess[aá]ria|art\.\s*496|reexame\s+necess[aá]rio/i.test(draft);
    },
  },
  {
    rule: "EC_EXTINCAO_SEM_CANCELAMENTO",
    description: "Extinção do cumprimento de sentença por satisfação sem determinar o cancelamento das restrições patrimoniais (SISBAJUD, RENAJUD, ARISP) — causar prejuízo ao executado.",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (ctx.tipo_peca !== "SENTENCA") return false;
      const extinto = /extingo|extint[ao]/i.test(draft);
      const temCancelamento = /cancel[ae]|libera[^r]|ofici[ao]|sisbajud|renajud/i.test(draft);
      return extinto && !temCancelamento;
    },
  },
  {
    rule: "EC_PENHORA_FATURAMENTO_SEM_LIMITE",
    description: "Penhora de faturamento (art. 866 CPC) deferida sem fixar percentual máximo — deve ser delimitado (geralmente 5% a 20%) para não inviabilizar a atividade empresarial.",
    detect: (draft: string, _ctx: ExecutionContext): boolean =>
      /penhora\s+(?:de\s+)?faturamento|art\.\s*866/i.test(draft) &&
      !/[0-9]+\s*%|percentual|propor[cç][aã]o/i.test(draft),
  },
  {
    rule: "EC_PRAZO_FAZENDA_INCORRETO",
    description: "Cumprimento contra Fazenda Pública com prazo de pagamento de 15 dias (rito comum) em vez de 60 dias (art. 535 §3º CPC — prazo especial da Fazenda).",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.is_fazenda_publica) return false;
      return /15\s*(?:\(quinze\)\s*)?dias\s+(?:para|de)\s+pagamento/i.test(draft);
    },
  },
  {
    rule: "EC_IMPUGNACAO_SEM_EFEITO_SUSPENSIVO",
    description: "Impugnação ao cumprimento de sentença sem análise do efeito suspensivo — o efeito suspensivo não é automático e exige demonstração de fumus e periculum (art. 525 §6º CPC).",
    detect: (draft: string, ctx: ExecutionContext): boolean => {
      if (!ctx.tem_impugnacao) return false;
      return /impugna[cç][aã]o/i.test(draft) &&
        !/efeito\s+suspensivo|art\.\s*525[^,]{0,15}§\s*6|suspens[aã]o\s+da\s+execu[cç][aã]o/i.test(draft);
    },
  },
];

// ── ExecutionValidator ────────────────────────────────────────────────────────

export class ExecutionValidator {
  validate(draft: string, ctx: ExecutionContext): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of FATAL_RULES) {
      if (rule.detect(draft, ctx)) {
        errors.push({
          rule: rule.rule,
          message: rule.description,
          fatal: true,
        });
      }
    }

    for (const rule of NON_FATAL_RULES) {
      if (rule.detect(draft, ctx)) {
        errors.push({
          rule: rule.rule,
          message: rule.description,
          fatal: false,
        });
      }
    }

    return errors;
  }

  scoreImpact(errors: ValidationError[]): number {
    let impact = 0;
    for (const e of errors) {
      if (e.fatal) impact -= 10;
      else impact -= 3;
    }
    return impact;
  }
}
