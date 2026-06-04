// Avaliação tripartite do resultado de cada armadilha (trap):
//
//   DETECTED  — algum validator emitiu a regra esperada (ideal)
//   AVOIDED   — a regra esperada não foi emitida E o draft não contém
//               o padrão ruim (a IA dodgeou a armadilha)
//   MISSED    — o draft contém o padrão ruim E o validator não detectou
//               (problema real do sistema)
//
// Critério de MISSED para traps determinísticas: verificação direta de
// padrão no draft (ex: art. 201 CF em RPPS, art. 85 CPC em criminal).
//
// Critério de MISSED para traps subjetivas: combinação de score baixo,
// modo degradado e análise de padrões no texto do audit/draft.

import type { CaseResult, TrapKind } from "./case-types.js";

export type TrapOutcome = "DETECTED" | "AVOIDED" | "MISSED";

export function evaluateTrap(trap: TrapKind, result: CaseResult): TrapOutcome {
  const rules = result.validationErrors.map((e) => e.rule);
  const draft = result.draft ?? "";
  const score = result.score ?? 100;
  const mode = result.mode;
  const auditText = result.auditErrors.join(" ").toLowerCase();

  const hasRule = (...names: string[]): boolean => names.some((n) => rules.includes(n));

  switch (trap) {
    case "JURISPRUDENCIA_CONTRARIA": {
      // DETECTED: validator de postura probatória disparou
      if (hasRule("EVIDENCE_STANCE_VIOLATION", "EVIDENCE_STANCE_MATRIX")) return "DETECTED";

      // MISSED: jurisprudência contrária conhecida citada sem distinguishing ou negação
      // Refs de jurs contrárias injetadas nos templates
      const contraJurIds = /\b(RE[\s.]?590[\s.]?260|HC[\s.]?84[\s.]?078|paridade.*(?:após|pos).*ec\s*41|ec\s*41.*paridade)\b/i;
      // Linguagem que nega ou distingue a jur (uso correto)
      const distinguishingOrRejection = /\b(distinguishing|não\s+(?:se\s+)?aplic|inaplicáv|afastar?|sem\s+direito|não\s+tem\s+direito|improcedente|não\s+merece\s+acolhida|indevid)\b/i;

      if (contraJurIds.test(draft) && !distinguishingOrRejection.test(draft)) return "MISSED";

      // MISSED secundário: score degradado indica jur mal aplicada (< 78)
      if (score < 78) return "MISSED";

      return "AVOIDED";
    }

    case "ARTIGO_INCOMPATIVEL": {
      // DETECTED: validator emitiu regra de artigo incompatível
      if (
        hasRule(
          "RPPS_WRONG_ARTICLE",
          "RGPS_WRONG_ARTICLE",
          "WRONG_HONORARIOS_CRIMINAL",
          "WRONG_HONORARIOS",
          "CRIMINAL_ARTICLE_85_CPC",
          "TUTELA_MISSING_PERICULUM_MORA",
          "INVERSAO_ONUS_SEM_FUNDAMENTO",
        )
      ) return "DETECTED";

      // MISSED: padrões diretos no draft
      if (result.area === "RPPS" && /art\.?\s*201\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if (result.area === "RGPS" && /art\.?\s*40\s*(da\s*)?(cf|constitui)/i.test(draft)) return "MISSED";
      if ((result.area === "CRIMINAL" || result.area === "CRIMINAL_MERITO") && /art\.?\s*85\s*(do\s+)?cpc/i.test(draft)) return "MISSED";
      // Trabalhista com art. 85 CPC em vez de art. 791-A CLT
      if (
        result.area === "TRABALHISTA" &&
        /art\.?\s*85\s*(do\s+)?cpc/i.test(draft) &&
        !/art\.?\s*791[-\s]?[aA]/i.test(draft)
      ) return "MISSED";
      // Cível: tutela deferida sem periculum in mora
      if (
        (result.area === "CIVEL_GERAL" || result.area === "CIVEL") &&
        result.documentType === "DECISAO" &&
        /defiro|concedo\s+(a\s+)?liminar|defiro\s+a\s+tutela/i.test(draft) &&
        !/periculum\s+in\s+mora|perigo\s+de\s+dano|urg[eê]ncia\s+da\s+medida/i.test(draft)
      ) return "MISSED";
      // Consumidor: inversão do ônus sem art. 6, VIII, CDC
      if (
        result.area === "CONSUMIDOR" &&
        /invers[aã]o.*[oô]nus/i.test(draft) &&
        !/art\.?\s*6[°º,.]?\s*(inc\.?\s*|inciso\s*)?viii/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "RECURSO_INADEQUADO": {
      // DETECTED: validator emitiu regra de recurso incompatível
      if (hasRule("INCOMPATIBLE_APPEAL", "JEF_JEC_WRONG_APPEAL", "CRIMINAL_WRONG_APPEAL")) return "DETECTED";

      // MISSED: padrões por área
      // Trabalhista: usa apelação em vez de Recurso Ordinário
      if (result.area === "TRABALHISTA" && /\bapela[cç][aã]o\b/i.test(draft) && !/recurso\s+ordin[aá]rio/i.test(draft)) return "MISSED";
      // Criminal: usa apelação cível em vez de apelação criminal
      if (result.area === "CRIMINAL" || result.area === "CRIMINAL_MERITO" && /apela[cç][aã]o\s+c[ií]vel/i.test(draft)) return "MISSED";
      // Previdenciário: usa recurso trabalhista
      if (
        (result.area === "RPPS" || result.area === "RGPS") &&
        /recurso\s+ordin[aá]rio\s+trabalhista|recurso\s+de\s+revista|art\.?\s*895\s+(da\s+)?clt/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "COMPETENCIA_INCORRETA": {
      // DETECTED: validator emitiu regra de tribunal errado
      if (hasRule("WRONG_SUPERIOR_COURT")) return "DETECTED";

      // MISSED: tribunal incompetente citado em cada área
      // Trabalhista → STJ não é competente (é TST)
      if (result.area === "TRABALHISTA" && /\b(stj|superior\s+tribunal\s+de\s+justi[cç]a)\b/i.test(draft)) return "MISSED";
      // Criminal → TST não tem competência
      if (result.area === "CRIMINAL" || result.area === "CRIMINAL_MERITO" && /\b(tst|tribunal\s+superior\s+do\s+trabalho)\b/i.test(draft)) return "MISSED";
      // Previdenciário → TST não tem competência
      if (
        (result.area === "RPPS" || result.area === "RGPS") &&
        /\b(tst|tribunal\s+superior\s+do\s+trabalho)\b/i.test(draft)
      ) return "MISSED";

      return "AVOIDED";
    }

    case "LINGUAGEM_DECISORIA": {
      // DETECTED: validator de estrutura disparou
      if (hasRule("DESPACHO_WITH_DECISION_LANGUAGE")) return "DETECTED";

      // MISSED: despacho com verbo decisório
      if (result.documentType === "DESPACHO" && /\b(defiro|indefiro|julgo|rejeito|acolho|concedo|denego)\b/i.test(draft)) {
        return "MISSED";
      }

      return "AVOIDED";
    }

    case "FATO_INCOMPLETO": {
      // DETECTED: sinais de degradação de modo ou qualidade
      if (mode === "SAFE_SKELETON" || mode === "TEMPLATE_MODEL") return "DETECTED";
      if (score < 70) return "DETECTED";
      if (/fato|prova|insuficient|incomplet|lacuna|omiss/i.test(auditText)) return "DETECTED";

      // MISSED para SENTENCA: relatório muito curto indica omissão fática
      if (result.documentType === "SENTENCA") {
        const relatorioIdx = draft.search(/relat[oó]rio/i);
        const fundIdx = draft.search(/fundamenta[cç][aã]o/i);
        if (relatorioIdx >= 0 && fundIdx > relatorioIdx) {
          const relatorio = draft.slice(relatorioIdx, fundIdx);
          if (relatorio.length < 400) return "MISSED";
        }
        // Draft total muito curto para uma sentença completa
        if (draft.length < 1500) return "MISSED";
      }

      return "AVOIDED";
    }

    case "TESE_EQUIVOCADA": {
      // Limiar ajustado de 75 → 78 para maior sensibilidade
      if (score < 78) return "DETECTED";
      if (/tese|fundament|equivoc|incorret|discut|dubios|controv|inconsist|equivocad/i.test(auditText)) return "DETECTED";
      return "AVOIDED";
    }

    // ── JEF Cível ─────────────────────────────────────────────────────────────

    case "JEF_PERICIA_COMPLEXA": {
      // DETECTED: validator JEF emitiu a regra
      if (hasRule("JEF_PERICIA_COMPLEXA")) return "DETECTED";

      // Verifica se o draft menciona perícia complexa
      const menciona = /per[íi]cia\s+(?:m[eé]dica|cont[aá]bil|de\s+engenharia|estrutural|complex|forense|multidisciplinar|t[eé]cnica|atuarial|grafot[eé]cnica)|laudo\s+pericial|avalia[cç][aã]o\s+(?:m[eé]dica\s+especializada?|multiprofissional|pericial)/i.test(draft);
      if (!menciona) return "AVOIDED";

      // SENTENÇA: só é MISSED se a sentença ORDENA nova perícia.
      // Referência a laudo já existente nos autos = AVOIDED (prova pré-existente).
      if (result.documentType === "SENTENCA") {
        const ordenaNova = /determino\s+(?:a\s+)?(?:realiza[cç][aã]o\s+de\s+)?(?:nova\s+)?per[íi]cia|designo\s+(?:nova\s+)?per[íi]cia|reabro\s+a\s+instru[cç][aã]o|determino\s+a\s+reabertura|designo\s+novo\s+perito|produza-se\s+prova\s+pericial/i.test(draft);
        if (!ordenaNova) return "AVOIDED";
      }

      // AVOIDED: IA reconheceu a questão JEF/perícia e a enfrentou de qualquer forma válida.
      // (a) Linguagem de concessão — admite incompatibilidade ou remete à justiça comum.
      // (b) Linguagem de refutação afirmativa — antecipa a objeção e argumenta pela compatibilidade.
      const aiReconheceu =
        /incompet[êe]ncia\s+(?:absoluta\s+)?(?:do\s+)?juizado|declino\s+da\s+compet[êe]ncia|incompatível\s+com\s+(?:o\s+)?(?:juizado|rito\s+sumar[íi]ssimo)|supera\s+o\s+rito\s+sumar[íi]ssimo|remessa\s+(?:dos\s+autos\s+)?(?:à|ao)\s+(?:var[ao]\s+)?(?:c[íi]vel\s+)?(?:comum|ordin[aá]ri[ao])|n[ãa]o\s+h[áa](?:vendo)?\s+(?:necessidade|demanda)\s+de\s+per[íi]cia|n[ãa]o\s+(?:demanda|requer|necessita|exige)\s+per[íi]cia\s+(?:complex|t[eé]cnica\s+elaborada)|dispensável\s+a?\s*per[íi]cia|sem\s+complexidade\s+incompatível|plenamente\s+dirimida\s+com\s+prova\s+documental|n[ãa]o\s+(?:versa|verse)\s+sobre.{0,60}(?:pericial|per[íi]cia)|per[íi]cia.{0,120}n[ãa]o\s+(?:é\s+)?(?:cabível|necessária|adequada)\s+(?:no|ao)\s+juizado|extingue?-se\s+sem\s+julgamento\s+do\s+m[eé]rito\s+por\s+complexidade|ainda\s+que.{0,80}per[íi]cia\s+t[eé]cnica.{0,120}mat[eé]ria|mat[eé]ria\s+controvertida\s+refere-se\s+essencialmente|per[íi]cia\s+n[ãa]o\s+(?:inviabiliza|compromete|afasta)|n[ãa]o\s+obstante\s+(?:as\s+)?limita[cç][õo]es\s+do\s+procedimento\s+sumar[íi]ssimo|limita[cç][õo]es\s+do\s+rito\s+sumar[íi]ssimo|obje[cç][aã]o.{0,100}per[íi]cia.{0,80}n[ãa]o\s+(?:elide|afasta|obsta|impede)\s+a\s+compet[êe]ncia|possível\s+obje[cç][aã]o.{0,60}complexidade.{0,60}n[ãa]o\s+elide|rito\s+sumar[íi]ssimo\s+n[ãa]o\s+(?:restringe|impede|obsta|veda)|per[íi]cia\s+(?:poderá?|pode)\s+ser\s+conduzida.{0,80}rito|demanda\s+n[ãa]o\s+envolva?\s+mat[eé]ria\s+de\s+alta\s+complexidade|n[ãa]o\s+elide\s+a\s+compet[êe]ncia/i.test(draft);

      if (aiReconheceu) return "AVOIDED";
      return "MISSED";
    }

    case "JEF_VALOR_EXCEDENTE": {
      // DETECTED: validator JEF emitiu a regra
      if (hasRule("JEF_VALOR_EXCEDENTE")) return "DETECTED";
      // MISSED: valor acima de 40 SM sem renúncia expressa
      const temValorAlto =
        /r\$\s*(?:\d{1,3}\.)*[5-9]\d{4}|\b(?:4[1-9]|[5-9]\d|\d{3,})\s+sal[aá]rios?\s+m[íi]nimos?\b/i.test(draft);
      const temRenuncia =
        /renunci[ao]\s+ao\s+excedente|renúncia\s+ao\s+valor\s+excedente|renuncia\s+expressamente/i.test(draft);
      if (temValorAlto && !temRenuncia) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_RECURSO_ERRADO": {
      // DETECTED: validator JEF emitiu a regra
      if (hasRule("JEF_RECURSO_ERRADO", "JEF_JEC_WRONG_APPEAL")) return "DETECTED";
      // MISSED: apelação usada em vez de recurso inominado
      if (
        result.documentType === "RECURSO" &&
        /\bapela[cç][aã]o\b/i.test(draft) &&
        !/recurso\s+inominado/i.test(draft)
      ) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_LEGITIMIDADE_PASSIVA": {
      // DETECTED: audit menciona ilegitimidade ou parte errada
      if (/parte\s+errada|ilegitimidade\s+passiva|polo\s+passivo\s+incorret|ilegítim[ao]/i.test(auditText)) return "DETECTED";
      // MISSED: score muito baixo indica erro na identificação da parte
      if (score < 72) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_TUTELA_SEM_PERICULUM": {
      // DETECTED: validator JEF emitiu a regra
      if (hasRule("JEF_TUTELA_SEM_PERICULUM", "TUTELA_MISSING_PERICULUM_MORA")) return "DETECTED";
      // MISSED: tutela concedida em DECISAO sem mencionar periculum
      if (
        result.documentType === "DECISAO" &&
        /defiro|concedo\s+(?:a\s+)?(?:tutela|liminar)/i.test(draft) &&
        !/periculum|perigo\s+de\s+dano|urg[eê]ncia\s+(?:comprova|demonstra)|dano\s+irrepará/i.test(draft)
      ) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_TUTELA_SEM_FUMUS": {
      if (hasRule("JEF_TUTELA_SEM_FUMUS", "TUTELA_MISSING_ART300")) return "DETECTED";
      const tutelaAto = /defiro|concedo\s+(?:a\s+)?(?:tutela|liminar)|requeiro?\s+(?:a\s+)?tutela|pedido\s+de\s+tutela/i.test(draft);
      const temFumus  = /fumus\s+boni\s+iuris|probabilidade\s+do\s+direito|verossimilhan[cç]a|art\.\s*300|prova\s+(?:documental|inequ[íi]voca)\s+do\s+direito|aparência\s+do\s+direito/i.test(draft);
      if (tutelaAto && !temFumus) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_TUTELA_DESPROPORCIONAL": {
      if (hasRule("JEF_TUTELA_DESPROPORCIONAL")) return "DETECTED";
      const tutelaAto     = /defiro|concedo\s+(?:a\s+)?(?:tutela|liminar)|requeiro?\s+(?:a\s+)?tutela|pedido\s+de\s+tutela/i.test(draft);
      const medidaAmpla   = /bloqueio\s+(?:total\s+)?(?:d[ae]\s+)?conta|suspensão\s+(?:total|integral)\s+(?:d[eo]\s+)?(?:serviço|contrato)|cancelamento\s+(?:total|imediato)\s+(?:d[eo]\s+)?(?:contrato|plano|serviço)|bloqueio\s+d[ae]\s+(?:conta[s]?|ativo[s]?)/i.test(draft);
      const temProporc    = /proporcionalidade|razoabilidade|medida\s+menos\s+gravosa|medida\s+(?:mais\s+)?adequada|proporcional\s+ao\s+(?:caso|valor|dano)|princípio\s+da\s+proporcionalidade/i.test(draft);
      if (tutelaAto && medidaAmpla && !temProporc) return "MISSED";
      return "AVOIDED";
    }

    // ── Recursos nos Juizados (FASE 4.4) ─────────────────────────────────────────

    case "JEF_ENDERECAMENTO_ERRADO": {
      if (hasRule("JEF_ENDERECAMENTO_ERRADO")) return "DETECTED";
      if (result.documentType !== "RECURSO") return "AVOIDED";
      const enderecoErrado =
        /(?:excelentíssim[oa]|egrégi[oa])\s+(?:senhor[a]?\s+)?desembargador[a]?|tribunal\s+de\s+justiça\s+d[oe]|câmara\s+cível|tribunal\s+regional\s+federal/i.test(draft);
      const enderecoCorreto = /turma\s+recursal/i.test(draft);
      if (enderecoErrado && !enderecoCorreto) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_PRAZO_ERRADO": {
      if (hasRule("JEF_PRAZO_ERRADO")) return "DETECTED";
      if (result.documentType !== "RECURSO") return "AVOIDED";
      const prazoCpc = /prazo\s+de\s+(?:quinze|15)\s*(?:\(quinze\)\s*)?dias|15\s+\(quinze\)\s+dias\s+(?:para\s+recorrer|recursais?)|art\.\s*1\.003\s+(?:do\s+)?cpc/i.test(draft);
      const prazoCorreto = /(?:dez|10)\s+(?:\(dez\)\s+)?dias|art\.\s*42\s+(?:da\s+)?lei\s+9\.099|art\.\s*5[oº]\s+(?:da\s+)?lei\s+10\.259/i.test(draft);
      if (prazoCpc && !prazoCorreto) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_PREPARO_ERRADO": {
      if (hasRule("JEF_PREPARO_ERRADO")) return "DETECTED";
      if (result.documentType !== "RECURSO") return "AVOIDED";
      const mentionaPreparo = /preparo\s+recursal|recolhimento\s+do\s+preparo|custas\s+recursais?/i.test(draft);
      if (!mentionaPreparo) return "AVOIDED";
      const preparoCpc = /preparo\s+(?:nos\s+termos\s+d[oa]\s+art\.\s*1\.007|de\s+[123]%|calculado\s+sobre)|art\.\s*1\.007\s+(?:do\s+)?cpc/i.test(draft);
      const preparoCorreto = /lei\s+9\.099|lei\s+10\.259|isento\s+de\s+preparo|dispensado\s+(?:do\s+)?preparo|gratuidade\s+(?:de\s+)?justiça/i.test(draft);
      if (preparoCpc && !preparoCorreto) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_PEDIDO_INCOMPATIVEL": {
      if (hasRule("JEF_PEDIDO_INCOMPATIVEL")) return "DETECTED";
      if (result.documentType !== "RECURSO") return "AVOIDED";
      const pedidoErrado =
        /(?:remetam-se?|remeta-se)\s+os\s+autos\s+ao?\s+(?:tribunal(?!\s+recursal)|t[jrf])|conhecer\s+(?:e\s+dar\s+provimento\s+(?:à|a)\s+)?apela[cç][aã]o(?!\s+(?:inominada|voluntária))|receber\s+(?:o\s+recurso\s+)?como\s+apela[cç][aã]o|câmara\s+cível\s+(?:julgue|aprecie|conheça)/i.test(draft);
      const pedidoCorreto = /turma\s+recursal|recurso\s+inominado\s+(?:seja\s+)?(?:conhecido|provido)|dar\s+provimento\s+ao\s+recurso(?!\s+de\s+apela[cç][aã]o)/i.test(draft);
      if (pedidoErrado && !pedidoCorreto) return "MISSED";
      return "AVOIDED";
    }

    case "JEF_TUTELA_ARTIFICIAL": {
      if (hasRule("JEF_TUTELA_ARTIFICIAL")) return "DETECTED";
      const tutelaAto     = /defiro|concedo\s+(?:a\s+)?(?:tutela|liminar)|requeiro?\s+(?:a\s+)?tutela|pedido\s+de\s+tutela/i.test(draft);
      const temUrgencia   = /urg[eê]n(?:cia|te)|periculum\s+in\s+mora|perigo\s+de\s+dano\s+irrepará/i.test(draft);
      const temPeríodoLongo = /h[aá]\s+(?:mais\s+de\s+)?\d+\s+(?:meses|anos)|desde\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+20(?:2[0-4])|h[aá]\s+(?:dois|três|quatro|cinco|\d+)\s+anos/i.test(draft);
      const temJustificativa = /fato\s+superveniente|nova\s+circunstância|recentemente\s+(?:agravou|piorou)|agravamento\s+recente|inesperadamente|situação\s+(?:nova|recente)/i.test(draft);
      if (tutelaAto && temUrgencia && temPeríodoLongo && !temJustificativa) return "MISSED";
      return "AVOIDED";
    }

    // ── Precedente superado ────────────────────────────────────────────────────

    case "PRECEDENTE_SUPERADO": {
      // DETECTED: audit menciona superação
      if (/superad|revoga|cancelad|atualiz|superven|entendimento\s+anterior/i.test(auditText)) return "DETECTED";
      if (score < 72) return "DETECTED";

      // MISSED: precedente superado citado no draft sem nota de superação
      const superadoRefs = /\b(HC[\s.]?84[\s.]?078|S[úu]mula\s+V[ée]ncer|HC[\s.]?152[\s.]?752)\b/i;
      const superadoNote = /\b(superad|revogad|cancelad|não\s+mais\s+prevalece|entendimento\s+anterior|posterior)\b/i;
      if (superadoRefs.test(draft) && !superadoNote.test(draft)) return "MISSED";

      // Verificação específica do HC 84.078 (execução provisória da pena)
      if (/HC\s*84[\s.]?078/i.test(draft) && !/superad|revoga|cancelad|atualiz/i.test(draft)) return "MISSED";

      return "AVOIDED";
    }
  }
}
