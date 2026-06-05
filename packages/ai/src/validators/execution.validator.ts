// ExecutionValidator — validações específicas para Execução / Cumprimento de Sentença.
//
// Integrado ao pipeline via FinalValidator (Fase 3.1).
// Ativado automaticamente quando assunto_principal contém contexto de execução.
//
// Regras fatais (7):   erros jurídicos graves que bloqueiam a peça
// Regras não-fatais (10): ressalvas que reduzem o score
// Regras de qualidade (PETICAO_INICIAL): seções obrigatórias, CPC, SISBAJUD

import type { ValidationError, LegalClassification, TipoPeca } from "../pipeline/types.js";

// ── Contexto interno de execução ─────────────────────────────────────────────

interface ExecutionContext {
  tipo_peca: TipoPeca;
  is_fazenda_publica: boolean;
  tem_impugnacao: boolean;
}

// ── Detector de contexto de execução ─────────────────────────────────────────

const EXECUTION_CONTEXT_RE =
  /\b(execu[cç][aã]o|cumprimento\s+de\s+senten[cç]a|penhora|sisbajud|embargos?\s+(à|de)\s+execu[cç][aã]o|impugna[cç][aã]o\s+ao\s+cumprimento|t[íi]tulo\s+extrajudicial|execu[cç][aã]o\s+for[cç]ada|executado|exequente)\b/i;

const FAZENDA_PUBLICA_RE =
  /\b(fazenda\s+p[úu]blica|munic[íi]pio|estado\s+(?:de|do)|uni[aã]o\s+federal|ente\s+p[úu]blico)\b/i;

// ── Regras fatais ─────────────────────────────────────────────────────────────

const FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string, ctx: ExecutionContext) => boolean;
}> = [
  {
    rule: "EC_RITO_FAZENDA_IGNORADO",
    description: "Cumprimento contra Fazenda Pública processado pelo rito comum (art. 523 CPC) em vez do rito especial (arts. 534/535 CPC + precatório/RPV — art. 100 CF/88).",
    detect: (draft, ctx) => {
      if (!ctx.is_fazenda_publica) return false;
      const temRitoComum = /multa\s+de\s+10[%]|art\.\s*523|penhora\s+imedia/i.test(draft);
      const temRitoEspecial = /precat[oó]rio|rpv|requisi[cç][aã]o\s+de\s+pequeno\s+valor|art\.\s*534|art\.\s*535/i.test(draft);
      return temRitoComum && !temRitoEspecial && /fazenda/i.test(draft);
    },
  },
  {
    rule: "EC_PENHORA_SALARIO_TOTAL",
    description: "Penhora de 100% de salário/aposentadoria do executado — viola impenhorabilidade do art. 833, IV, CPC. Limite jurisprudencial: até 30% em casos excepcionais (EREsp 1.518.169/DF).",
    detect: (draft, _ctx) => {
      // Exige que penhora/bloqueio + verba alimentar + integral/total/100% estejam
      // na mesma frase (sem cruzar ponto/quebra de linha), evitando falsos positivos
      // quando o texto apenas menciona "indicar bens à penhora" + "salário" em partes distintas.
      const VERBAS_RE = /sal[aá]rio|vencimento|remunera[cç][aã]o|aposentadoria|proventos|verba\s+alimentar/i;
      const TOTAL_RE  = /integral|totalidade|100\s*%|cem\s+por\s+cento|na\s+integralidade/i;
      const temProtecao = /art\.\s*833|impenhor[aá]vel|limite|30\s*%|eresp\s*1\.?518/i.test(draft);
      if (temProtecao) return false;
      // Janela: penhora/bloqueio/constrição → busca até fim da frase por verba + quantum total
      for (const m of draft.matchAll(/(?:penhora|bloqueio|constri[cç][aã]o)[^.!?\n]{0,200}/gi)) {
        const trecho = m[0]!;
        if (VERBAS_RE.test(trecho) && TOTAL_RE.test(trecho)) return true;
      }
      // Janela inversa: verba → busca por penhora + quantum total
      for (const m of draft.matchAll(/(?:sal[aá]rio|vencimento|remunera[cç][aã]o|aposentadoria|proventos|verba\s+alimentar)[^.!?\n]{0,200}/gi)) {
        const trecho = m[0]!;
        if (/penhora|bloqueio|constri[cç][aã]o/i.test(trecho) && TOTAL_RE.test(trecho)) return true;
      }
      return false;
    },
  },
  {
    rule: "EC_PRESCRICAO_INTERCORRENTE_IGNORADA",
    description: "Processo paralisado há mais de 5 anos sem movimentação útil do exequente — prescrição intercorrente não declarada (art. 921 §4º CPC).",
    detect: (draft, _ctx) => {
      const temParalisacao = /parali[sz]/i.test(draft) || /sem\s+movimenta[cç][aã]o/i.test(draft);
      const temPrescricao = /prescri[cç][aã]o\s+intercorrente|art\.\s*921|art\.\s*924/i.test(draft);
      return temParalisacao && !temPrescricao;
    },
  },
  {
    rule: "EC_EXCESSO_EXECUCAO_IGNORADO",
    description: "Impugnação por excesso de execução (art. 525 §1º, III, CPC) não analisada — penhora mantida pelo valor maior sem exame do cálculo correto.",
    detect: (draft, ctx) => {
      if (!ctx.tem_impugnacao) return false;
      // Só se aplica a peças decisórias (juiz ignora o excesso).
      // RECURSO, PETICAO_INICIAL etc. são do advogado que *argui* o excesso — não do juiz.
      if (ctx.tipo_peca !== "SENTENCA" && ctx.tipo_peca !== "DECISAO") return false;
      const temExcesso = /excesso\s+de\s+execu[cç][aã]o|art\.\s*525/i.test(draft);
      const foiAnalisado =
        /an[aá]lis[eo]|examin[ao]|c[aá]lcul[ao]s?|per[ií]cia\s+cont[aá]bil|demonstrativ[ao]|planilha|erro\s+aritm[eé]tico/i.test(draft);
      return temExcesso && !foiAnalisado;
    },
  },
  {
    rule: "EC_JUROS_ILEGAIS",
    description: "Juros moratórios calculados fora do padrão legal — taxa superior à SELIC (art. 406 CC) sem base legal expressa.",
    detect: (draft, _ctx) => {
      const match = /juros\s+de\s+(\d+(?:[.,]\d+)?)\s*%\s*(?:ao|a\.?o\.?)\s*m[eê]s/i.exec(draft);
      if (!match) return false;
      const taxa = parseFloat(match[1]!.replace(",", "."));
      if (taxa <= 1.5) return false;
      // Não disparar quando a taxa abusiva é mencionada para ser rejeitada.
      // Janela de 200 chars antes + 200 após o match — se contém termos de rejeição, é crítica, não aplicação.
      const inicio = Math.max(0, match.index - 200);
      const janela = draft.slice(inicio, match.index + 200);
      const estaSendoRejeitada =
        /vedada?|indevid[ao]|abusiv[ao]|ilegal|excessiv[ao]|exclu[ií]|afastar|afastamento|inaplic[aá]vel|extrapola|sem\s+base\s+legal|contrár[íi]/i.test(janela);
      if (estaSendoRejeitada) return false;
      // Sem termos de rejeição → a taxa está sendo aplicada (ou mencionada neutramente) → dispara.
      return true;
    },
  },
  {
    rule: "EC_TITULO_INEXIGIVEL_IGNORADO",
    description: "Impugnação por inexigibilidade do título (art. 525 §1º, I, CPC) não analisada.",
    detect: (draft, ctx) => {
      if (!ctx.tem_impugnacao) return false;
      const temInexigibilidade = /inexigibilidade|art\.\s*525[^,]{0,20}I\b|cite[^.]*nul/i.test(draft);
      const foiAnalisado = /examin[ao]|an[aá]lis[eo]|[ié]\s+[ée]xig[ií]vel|compet[eê]ncia/i.test(draft);
      return temInexigibilidade && !foiAnalisado;
    },
  },
];

// ── Regras não-fatais ─────────────────────────────────────────────────────────

const NON_FATAL_RULES: Array<{
  rule: string;
  description: string;
  detect: (draft: string, ctx: ExecutionContext) => boolean;
}> = [
  {
    rule: "EC_BEM_FAMILIA_PENHORADO",
    description: "Penhora de imóvel sem menção à proteção do bem de família — verificar se o imóvel é residencial único do executado (Lei 8.009/90, art. 833, VIII, CPC). Se for, a penhora é inválida salvo exceções taxativas.",
    detect: (draft, _ctx) => {
      const penhoraImovel =
        /penhora[^.]{0,60}im[oó]vel/i.test(draft) ||
        /im[oó]vel[^.]{0,60}penhor/i.test(draft);
      const temProtecao = /bem\s+de\s+fam[ií]lia|lei\s+8\.009|impenhor[aá]vel|art\.\s*833/i.test(draft);
      return penhoraImovel && !temProtecao;
    },
  },
  {
    rule: "EC_SISBAJUD_SEM_GRADACAO",
    description: "Penhora eletrônica deferida sem observar a ordem de preferência do art. 835 CPC.",
    detect: (draft, _ctx) =>
      /sisbajud|bacenjud|penhora\s+eletr[oô]nica/i.test(draft) &&
      !/art\.\s*835|ordem\s+de\s+prefer[eê]ncia|gradac[aã]o/i.test(draft),
  },
  {
    rule: "EC_RENAJUD_SEM_AVALIACAO",
    description: "Restrição de veículo via RENAJUD deferida sem mencionar a necessidade de avaliação prévia (art. 870 CPC).",
    detect: (draft, _ctx) =>
      /renajud|restri[cç][aã]o\s+veicular/i.test(draft) &&
      !/avalia[cç][aã]o|art\.\s*870|art\.\s*879/i.test(draft),
  },
  {
    rule: "EC_CORRECAO_INDICE_INADEQUADO",
    description: "Índice de correção monetária diferente do IPCA-E — padrão STJ para condenações civis (Tema 905).",
    detect: (draft, _ctx) =>
      /igp-?m|inpc|tr\b|ufir/i.test(draft) &&
      !/ressalva|tese\s+defensiva|requer(?:id)?[ao]|alega/i.test(draft),
  },
  {
    rule: "EC_ASTREINTES_SEM_PARAMETRO",
    description: "Fixação ou cobrança de astreintes sem indicar o parâmetro de razoabilidade (art. 537 §1º CPC).",
    detect: (draft, _ctx) =>
      /astreinte|multa\s+(?:di[aá]ria|cominat[oó]ria|por\s+atraso)/i.test(draft) &&
      !/art\.\s*537|proporcionalidade|razoabilidade|reduz[ij]|modif/i.test(draft),
  },
  {
    rule: "EC_HONORARIOS_FASE_EXECUCAO",
    description: "Honorários da fase de cumprimento não fixados ou sem mencionar os 10% do art. 523 §1º CPC e honorários adicionais do art. 85 CPC.",
    detect: (draft, ctx) => {
      if (ctx.tipo_peca !== "SENTENCA" && ctx.tipo_peca !== "DECISAO") return false;
      const temHonorarios = /honorar/i.test(draft);
      const temArt523 = /art\.\s*523|10\s*%\s*(?:de\s+)?multa/i.test(draft);
      return !temHonorarios || !temArt523;
    },
  },
  {
    rule: "EC_REMESSA_NECESSARIA_FAZENDA",
    description: "Sentença contra Fazenda Pública sem verificar o cabimento de remessa necessária (art. 496 CPC).",
    detect: (draft, ctx) => {
      if (!ctx.is_fazenda_publica || ctx.tipo_peca !== "SENTENCA") return false;
      return !/remessa\s+necess[aá]ria|art\.\s*496|reexame\s+necess[aá]rio/i.test(draft);
    },
  },
  {
    rule: "EC_EXTINCAO_SEM_CANCELAMENTO",
    description: "Extinção do cumprimento por satisfação sem determinar o cancelamento das restrições patrimoniais (SISBAJUD, RENAJUD).",
    detect: (draft, ctx) => {
      if (ctx.tipo_peca !== "SENTENCA") return false;
      const extinto = /extingo|extint[ao]/i.test(draft);
      const temCancelamento = /cancel[ae]|libera[^r]|ofici[ao]|sisbajud|renajud/i.test(draft);
      return extinto && !temCancelamento;
    },
  },
  {
    rule: "EC_PENHORA_FATURAMENTO_SEM_LIMITE",
    description: "Penhora de faturamento (art. 866 CPC) deferida sem fixar percentual máximo.",
    detect: (draft, _ctx) =>
      /penhora\s+(?:de\s+)?faturamento|art\.\s*866/i.test(draft) &&
      !/[0-9]+\s*%|percentual|propor[cç][aã]o/i.test(draft),
  },
  {
    rule: "EC_PRAZO_FAZENDA_INCORRETO",
    description: "Cumprimento contra Fazenda Pública com prazo de 15 dias (rito comum) em vez de 60 dias (art. 535 §3º CPC).",
    detect: (draft, ctx) => {
      if (!ctx.is_fazenda_publica) return false;
      return /15\s*(?:\(quinze\)\s*)?dias\s+(?:para|de)\s+pagamento/i.test(draft);
    },
  },
  {
    rule: "EC_IMPUGNACAO_SEM_EFEITO_SUSPENSIVO",
    description: "Impugnação ao cumprimento de sentença sem análise do efeito suspensivo (art. 525 §6º CPC).",
    detect: (draft, ctx) => {
      if (!ctx.tem_impugnacao) return false;
      return (
        /impugna[cç][aã]o/i.test(draft) &&
        !/efeito\s+suspensivo|art\.\s*525[^,]{0,15}§\s*6|suspens[aã]o\s+da\s+execu[cç][aã]o/i.test(draft)
      );
    },
  },
];

// ── Seções obrigatórias para PETICAO_INICIAL de execução ──────────────────────

const EXECUTION_SECTIONS: Array<{ pattern: RegExp; label: string }> = [
  {
    // DOS FATOS / SÍNTESE FÁTICA / DO CONTRATO (título extrajudicial) /
    // DO TÍTULO EXECUTIVO / DA ORIGEM DO CRÉDITO / DO INADIMPLEMENTO
    pattern:
      /\b(dos?\s+fatos?|s[íi]ntese\s+f[aá]tica|do\s+contrato\b|do\s+t[íi]tulo\s+executivo|da\s+origem\s+do\s+cr[eé]dito|do\s+inadimplemento|do\s+d[eé]bito\s+exeq[üu]endo)\b/i,
    label: "I — DOS FATOS",
  },
  {
    // DO DIREITO / FUNDAMENTOS JURÍDICOS / FUNDAMENTOS DE DIREITO / FUNDAMENTOS LEGAIS /
    // DO REGIME JURÍDICO (APLICÁVEL) / DA FUNDAMENTAÇÃO JURÍDICA / DO CABIMENTO DA EXECUÇÃO
    pattern:
      /\b(do\s+direito|fundamentos?\s+(jur[íi]dicos?|legais?|de\s+direito)|do\s+regime\s+jur[íi]dico|da\s+fundamenta[cç][aã]o\s+jur[íi]dica|do\s+cabimento\s+da\s+execu[cç][aã]o)\b/i,
    label: "II — DO DIREITO",
  },
  {
    // DOS REQUISITOS LEGAIS / REQUISITOS LEGAIS / PRESSUPOSTOS LEGAIS /
    // REQUISITOS DA EXECUÇÃO / heading combinado "REQUISITOS LEGAIS E SUA APLICAÇÃO..."
    pattern: /\b(dos?\s+)?(requisitos?|pressupostos?)\s+(legais?|da\s+execu[cç][aã]o|processuais?)/i,
    label: "III — DOS REQUISITOS LEGAIS",
  },
  {
    // DA APLICAÇÃO AO CASO CONCRETO / APLICAÇÃO AO CASO / APLICAÇÃO AO QUADRO CONCRETO /
    // DA ANÁLISE DO CASO CONCRETO / DO CASO CONCRETO / SUBSUNÇÃO DOS FATOS À NORMA /
    // ENQUADRAMENTO JURÍDICO DO CASO / APLICAÇÃO À SITUAÇÃO DOS AUTOS (título extrajudicial) /
    // DA EXIGIBILIDADE DO CRÉDITO (execução de título extrajudicial — aplica requisitos ao caso)
    pattern:
      /\b(da\s+)?(aplica[cç][aã]o\s+(ao|à)\s+(caso|quadro|situa[cç][aã]o|execu[cç][aã]o)|aplica[cç][aã]o\s+à\s+esp[eé]cie|subsun[cç][aã]o\s+dos?\s+fatos?|enquadramento\s+jur[íi]dico|an[aá]lise\s+do\s+caso\s+concreto|do\s+caso\s+concreto|exigibilidade\s+do\s+cr[eé]dito)\b|aplica[cç][aã]o.{0,60}(?:concreto|autos?)\b/i,
    label: "IV — DA APLICAÇÃO AO CASO CONCRETO",
  },
  {
    pattern: /\bdos?\s+pedidos?\b/i,
    label: "V — DOS PEDIDOS",
  },
];

const EXECUTION_CPC_RE =
  /art(?:igo)?s?\.?\s*(?:523|524|525|526|527|783|784|785|829|854|855|914|915|917|139[\s,]*IV)\b/i;

const EXECUTION_MODALITY_RE =
  /\b(cumprimento\s+de\s+senten[cç]a|execu[cç][aã]o\s+de\s+t[íi]tulo\s+extrajudicial|embargos?\s+[aà]\s+execu[cç][aã]o|impugna[cç][aã]o\s+ao\s+cumprimento|penhora\s+on[\s-]?line|sisbajud|art\.\s*523|art\.\s*784)\b/i;

const EXECUTION_OBJECTION_RE =
  /\b(excesso\s+de\s+execu[cç][aã]o|prescri[cç][aã]o|impenhorabilidade|nulidade\s+do\s+t[íi]tulo|defesa\s+do\s+executado|contra[\s-]?argumento|obje[cç][aã]o|eventual\s+impugna[cç][aã]o|eventual.*embargos?|resist[eê]ncia)\b/i;

const SISBAJUD_RE =
  /\b(sisbajud|bacenjud|penhora\s+eletr[oô]nica|penhora\s+on[\s-]?line|art\.\s*854|bloqueio\s+eletr[oô]nico\s+de\s+ativos?)\b/i;

const QUANTIA_CERTA_RE =
  /\b(execu[cç][aã]o\s+de\s+quantia|cumprimento\s+de\s+senten[cç]a|cobran[cç]a\s+de\s+valor|cobran[cç]a\s+de\s+d[íi]vida|pagamento\s+de\s+quantia)\b/i;

// Detector de peça defensiva (impugnação ou embargos) — usado para flexibilizar seções III/IV
// e suprimir sugestão de SISBAJUD (que não faz sentido para o executado)
const DEFESA_EXEC_RE =
  /\b(impugna[cç][aã]o\s+ao\s+cumprimento|embargos?\s+(à|[aà])\s+execu[cç][aã]o|impugnante\b|embargante\b|excesso\s+de\s+execu[cç][aã]o.*impugn|impugn.*excesso\s+de\s+execu[cç][aã]o)\b/i;

// Seções III equivalentes para impugnação/embargos: tópicos que cumprem a função de
// "requisitos legais" mas com nomenclatura própria da defesa executiva
const IMPUGNACAO_SECTION_III_RE =
  /\b(d[ao]s?\s+)?(limita[cç][aã]o\s+da\s+execu[cç][aã]o|argui[cç][aã]o\s+de\s+excesso|excesso\s+de\s+execu[cç][aã]o|limites?\s+d[oa]?\s+t[íi]tulo|nulidade\s+do\s+excesso|inexigibilidade\s+do\s+t[íi]tulo|prescri[cç][aã]o\s+intercorrente|impenhorabilidade|fundamentos?\s+da\s+impugna[cç][aã]o|fundamentos?\s+dos?\s+embargos|mem[oó]ria\s+de\s+c[aá]lculo)\b/i;

// Seções IV equivalentes para impugnação/embargos: análise concreta dos cálculos/excesso
const IMPUGNACAO_SECTION_IV_RE =
  /\b(d[ao]s?\s+)?(aplica[cç][aã]o\s+correta|an[aá]lise\s+dos?\s+c[aá]lculos?|demonstra[cç][aã]o\s+do\s+excesso|valor\s+correto\s+da\s+execu[cç][aã]o|revis[aã]o\s+do\s+valor|vedac[aã]o\s+ao\s+enriquecimento|crit[eé]rios?\s+de\s+c[aá]lculo|necessidade\s+de\s+efeito\s+suspensivo|efeito\s+suspensivo)\b/i;

// ── ExecutionValidator ────────────────────────────────────────────────────────

export class ExecutionValidator {
  /** Ponto de entrada público — chamado pelo FinalValidator. */
  validate(
    draft: string,
    classification: LegalClassification,
  ): { errors: ValidationError[] } {
    if (!this.isExecutionContext(classification)) {
      return { errors: [] };
    }

    const ctx: ExecutionContext = {
      tipo_peca: classification.tipo_peca,
      is_fazenda_publica: FAZENDA_PUBLICA_RE.test(classification.partes?.reu ?? "") ||
        FAZENDA_PUBLICA_RE.test(classification.assunto_principal ?? ""),
      tem_impugnacao: /impugna[cç][aã]o/i.test(classification.assunto_principal ?? ""),
    };

    const errors: ValidationError[] = [];

    // Regras fatais (estruturais + jurídicas)
    for (const rule of FATAL_RULES) {
      if (rule.detect(draft, ctx)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: true });
      }
    }

    // Regras não-fatais (ressalvas)
    for (const rule of NON_FATAL_RULES) {
      if (rule.detect(draft, ctx)) {
        errors.push({ rule: rule.rule, message: rule.description, fatal: false });
      }
    }

    // Qualidade de PETICAO_INICIAL
    if (classification.tipo_peca === "PETICAO_INICIAL") {
      errors.push(...this.validatePeticaoInicial(draft, ctx));
    }

    return { errors };
  }

  private isExecutionContext(classification: LegalClassification): boolean {
    return EXECUTION_CONTEXT_RE.test(classification.assunto_principal ?? "");
  }

  private validatePeticaoInicial(draft: string, ctx: ExecutionContext): ValidationError[] {
    const errors: ValidationError[] = [];
    // Peça defensiva: impugnação ao cumprimento ou embargos à execução
    const isDefesa = ctx.tem_impugnacao || DEFESA_EXEC_RE.test(draft);

    // 1. Seções obrigatórias I–V
    for (const section of EXECUTION_SECTIONS) {
      let presente = section.pattern.test(draft);

      // Para impugnação/embargos: aceitar nomenclaturas defensivas equivalentes
      if (!presente && isDefesa) {
        if (section.label.startsWith("III")) presente = IMPUGNACAO_SECTION_III_RE.test(draft);
        if (section.label.startsWith("IV"))  presente = IMPUGNACAO_SECTION_IV_RE.test(draft);
      }

      if (!presente) {
        errors.push({
          rule: "EXECUTION_MISSING_SECTION",
          message:
            `PETICAO_INICIAL de execução/cumprimento sem a seção obrigatória: ${section.label} ` +
            `— estrutura exige DOS FATOS / DO DIREITO / DOS REQUISITOS LEGAIS / ` +
            `DA APLICAÇÃO AO CASO CONCRETO / DOS PEDIDOS`,
          fatal: true,
        });
      }
    }

    // 2. Fundamentação CPC de execução
    if (!EXECUTION_CPC_RE.test(draft)) {
      errors.push({
        rule: "EXECUTION_MISSING_CPC_BASIS",
        message:
          "Petição de execução sem referência a artigo do CPC aplicável — " +
          "indicar art. 523 (cumprimento), art. 784 (título extrajudicial), " +
          "art. 854 (SISBAJUD) ou equivalente",
        fatal: false,
      });
    }

    // 3. Modalidade executiva
    if (!EXECUTION_MODALITY_RE.test(draft)) {
      errors.push({
        rule: "EXECUTION_MISSING_MODALITY",
        message:
          "Fundamentação da modalidade executiva ausente — especificar: " +
          "cumprimento de sentença / execução de título extrajudicial / " +
          "embargos / impugnação ao cumprimento",
        fatal: false,
      });
    }

    // 4. Enfrentamento de objeção previsível
    if (!EXECUTION_OBJECTION_RE.test(draft)) {
      errors.push({
        rule: "EXECUTION_MISSING_OBJECTION",
        message:
          "Petição de execução sem enfrentamento de objeção previsível — " +
          "antecipe excesso de execução, prescrição, impenhorabilidade " +
          "ou outra defesa esperada do executado",
        fatal: false,
      });
    }

    // 5. SISBAJUD — apenas para peças do exequente (não para impugnação/embargos)
    if (!isDefesa && QUANTIA_CERTA_RE.test(draft) && !SISBAJUD_RE.test(draft)) {
      errors.push({
        rule: "EXECUTION_SISBAJUD_MISSING",
        message:
          "Execução de quantia sem pedido de SISBAJUD — considerar penhora " +
          "eletrônica on-line (art. 854 CPC) e medidas executivas atípicas " +
          "(art. 139, IV, CPC) como meios preferenciais de satisfação do crédito",
        fatal: false,
      });
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
