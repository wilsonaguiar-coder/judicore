type QualConfidence = 'encontrado' | 'baixa confiança' | 'não encontrado';

export interface QualField {
  value: string | null;
  confidence: QualConfidence;
}

export interface QualificationData {
  nome: QualField;
  cpf: QualField;
  rg: QualField;
  orgaoExpedidor: QualField;
  estadoCivil: QualField;
  profissao: QualField;
  endereco: QualField;
  numero: QualField;
  complemento: QualField;
  bairro: QualField;
  cidade: QualField;
  uf: QualField;
  cep: QualField;
}

const UF_LIST = 'SP|RJ|MG|ES|RS|SC|PR|MS|MT|GO|DF|TO|BA|SE|AL|PE|PB|RN|CE|PI|MA|PA|AP|AM|RR|AC|RO';

function found(value: string): QualField {
  return { value, confidence: 'encontrado' };
}

function lowConf(value: string): QualField {
  return { value, confidence: 'baixa confiança' };
}

function notFound(): QualField {
  return { value: null, confidence: 'não encontrado' };
}

export class QualificationExtractor {
  static extract(text: string): QualificationData {
    const data: QualificationData = {
      nome:           notFound(),
      cpf:            notFound(),
      rg:             notFound(),
      orgaoExpedidor: notFound(),
      estadoCivil:    notFound(),
      profissao:      notFound(),
      endereco:       notFound(),
      numero:         notFound(),
      complemento:    notFound(),
      bairro:         notFound(),
      cidade:         notFound(),
      uf:             notFound(),
      cep:            notFound(),
    };

    // CPF — prioridade 1: prefixo explícito "CPF:" (comum em OCR de CNH/RG)
    // Normaliza os dígitos e reformata para XXX.XXX.XXX-XX
    const cpfPrefixado = text.match(
      /(?:CPF|C\.P\.F\.)\s*[:\s.]{0,3}(\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2})/i
    );
    if (cpfPrefixado) {
      const digits = cpfPrefixado[1].replace(/\D/g, "");
      if (digits.length === 11) {
        data.cpf = found(`${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`);
      }
    }

    // CPF — prioridade 2: formato estrito XXX.XXX.XXX-XX com separadores obrigatórios
    // (evita capturar RENACH de 11 dígitos sem formatação presente na URL do QR Code da CNH)
    if (!data.cpf.value) {
      const cpfFormatado = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
      if (cpfFormatado) {
        data.cpf = found(cpfFormatado[1]);
      }
    }

    // RG com órgão expedidor opcional ("RG 12.345.678-9 SSP/SP")
    const rgFullMatch = text.match(
      /\b(?:RG|R\.G\.|Registro\s*Geral)[^\d]{0,10}(\d{1,2}\.?\d{3}\.?\d{3}-?[a-zA-Z0-9]{1,2})\s*[-\/]?\s*(SSP|DETRAN|SESP|SDS|PM|PC)(?:\/([A-Z]{2}))?/i
    );
    if (rgFullMatch) {
      data.rg = found(rgFullMatch[1]);
      const orgao = rgFullMatch[3] ? `${rgFullMatch[2]}/${rgFullMatch[3]}` : rgFullMatch[2];
      data.orgaoExpedidor = found(orgao.toUpperCase());
    } else {
      const rgMatch = text.match(
        /\b(?:RG|R\.G\.|Registro\s*Geral)[^\d]{0,10}(\d{1,2}\.?\d{3}\.?\d{3}-?[a-zA-Z0-9]{1,2})\b/i
      );
      if (rgMatch) {
        data.rg = found(rgMatch[1]);
      } else {
        const looseRg = text.match(/\b\d{1,2}\.\d{3}\.\d{3}-?[0-9xX]\b/);
        if (looseRg && looseRg[0] !== data.cpf.value) {
          data.rg = lowConf(looseRg[0]);
        }
      }
    }

    // Órgão expedidor avulso (quando não veio colado ao RG)
    if (!data.orgaoExpedidor.value) {
      const orgaoAvulso = text.match(
        /\b(SSP|DETRAN|SESP|SDS|PM|PC)\/([A-Z]{2})\b/
      );
      if (orgaoAvulso) {
        data.orgaoExpedidor = lowConf(orgaoAvulso[0].toUpperCase());
      }
    }

    // Estado civil
    const ecMatch = text.match(
      /\b(casad[oa]|solteir[oa]|viúv[oa]|divorciado?[a]?|separad[oa]|união\s+estável)\b/i
    );
    if (ecMatch) {
      data.estadoCivil = found(ecMatch[0].toLowerCase());
    }

    // Profissão (lista de ocupações comuns)
    const profMatch = text.match(
      /\b(advogad[oa]|médic[oa]|engenheir[oa]|professor[a]?|servidor[a]\s+público[a]?|servidor[a]\s+federal|funcionári[oa]\s+público[a]?|aposentad[oa]|pensionist[a]|comerciante|empresári[oa]|enfermeiro[a]?|técnic[oa]|analista|auditor[a]?|contador[a]?|policial|militar|auxiliar)\b/i
    );
    if (profMatch) {
      data.profissao = lowConf(profMatch[0]);
    }

    // CEP
    const cepMatch = text.match(/\b(\d{5}-\d{3}|\d{8})\b/);
    if (cepMatch) {
      data.cep = found(cepMatch[0]);
    }

    // Endereço completo: logradouro + número + complemento opcional
    const addrPattern = new RegExp(
      '\\b((?:Rua|Avenida|Av\\.?|Alameda|Al\\.?|Praça|Travessa|Trav\\.?|Largo|Estrada|Est\\.?|Rod(?:ovia)?\\.?)\\s+[A-Za-zÀ-ÿ\\s.]+?)\\s*,\\s*(\\d+)(?:\\s*[,\\-]\\s*(.+?))?(?:\\n|\\r|$)',
      'i'
    );
    const addrMatch = text.match(addrPattern);
    if (addrMatch) {
      data.endereco = lowConf(addrMatch[1].trim());
      data.numero   = found(addrMatch[2].trim());

      if (addrMatch[3]) {
        const compCandidato = addrMatch[3].trim();
        if (/^(?:Ap\.?|Apto\.?|Apart\.?|Sala|Bloco|Conj\.?|Cj\.?|Torre|Andar|And\.?|Loja)\b/i.test(compCandidato)) {
          data.complemento = found(compCandidato);
        }
      }
    } else {
      // Fallback: captura endereço sem número estruturado
      const endSimples = text.match(
        /\b(?:Rua|Avenida|Av\.|Travessa|Logradouro)\s+[A-Za-zÀ-ÿ0-9\s,.\-]{10,80}\b/i
      );
      if (endSimples) {
        data.endereco = lowConf(endSimples[0].trim());
      }
    }

    // Bairro — palavra "bairro" explícita
    const bairroExplicito = text.match(/(?:bairro|bto\.?)\s+([A-Za-zÀ-ÿ\s]+?)(?:\n|\r|,|$)/i);
    if (bairroExplicito) {
      data.bairro = found(bairroExplicito[1].trim());
    } else if (addrMatch) {
      // Heurística: primeira linha não-vazia após a linha do endereço,
      // antes de CEP/UF/cidade — candidato a bairro
      const addrLine = addrMatch[0];
      const afterAddr = text.substring(text.indexOf(addrLine) + addrLine.length);
      const linhas = afterAddr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        if (/^\d{5}-?\d{3}$/.test(linha)) break;           // CEP → parar
        if (new RegExp(`^(${UF_LIST})$`, 'i').test(linha)) break; // UF sigla → parar
        if (/\//.test(linha)) break;                        // Cidade/UF → parar
        if (/\bcep\b/i.test(linha)) break;
        if (/^[A-Za-zÀ-ÿ]/.test(linha) && linha.length < 60) {
          data.bairro = lowConf(linha);
          break;
        }
      }
    }

    // Cidade e UF — padrão "Fortaleza/CE" ou "Fortaleza - CE" ou "Fortaleza, CE"
    const cidadeUf = new RegExp(
      `([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\\s]+?)\\s*[\\/\\-,]\\s*(${UF_LIST})\\b`,
      'i'
    );
    const cidadeUfMatch = text.match(cidadeUf);
    if (cidadeUfMatch) {
      data.cidade = lowConf(cidadeUfMatch[1].trim());
      data.uf     = found(cidadeUfMatch[2].toUpperCase());
    } else {
      // Fallback UF isolada
      const ufMatch = new RegExp(`\\b(${UF_LIST})\\b`, 'i').exec(text);
      if (ufMatch) {
        data.uf = lowConf(ufMatch[0].toUpperCase());
      }
    }

    // Nome — prioridade 1: linha inteiramente em MAIÚSCULAS com múltiplas palavras
    // (padrão de RG, CNH, certidões brasileiras)
    const allCapsLine = text.match(
      /^([A-ZÀ-ŸÁÉÍÓÚÂÊÎÔÛÃÕÇÀ]{2,}(?:\s+(?:D[AEO]S?|E|[A-ZÀ-ŸÁÉÍÓÚÂÊÎÔÛÃÕÇÀ]{2,})){1,})\s*$/m
    );
    if (allCapsLine && allCapsLine[1].trim().split(/\s+/).length >= 2) {
      data.nome = lowConf(allCapsLine[1].trim());
    }

    // Nome — prioridade 2: padrão misto ("Maria Aparecida da Silva, brasileira")
    if (!data.nome.value) {
      const nomeMisto = text.match(
        /([A-ZÀ-Ÿ][a-zÀ-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ÿ][a-zÀ-ÿ]+)+)\s*[,\s]+(?:brasileir[oa]|casad[oa]|solteir[oa]|viúv[oa]|divorciado?[a]?)/i
      );
      if (nomeMisto) {
        data.nome = lowConf(nomeMisto[1].trim());
      }
    }

    return data;
  }

  static formatToPrompt(data: QualificationData): string {
    let block = `\n--- DADOS EXTRAÍDOS DOS DOCUMENTOS ---\n`;

    const fields: Array<{ name: string; val: QualField }> = [
      { name: 'Nome',            val: data.nome },
      { name: 'CPF',             val: data.cpf },
      { name: 'RG',              val: data.rg },
      { name: 'Órgão Expedidor', val: data.orgaoExpedidor },
      { name: 'Estado Civil',    val: data.estadoCivil },
      { name: 'Profissão',       val: data.profissao },
      { name: 'Endereço',        val: data.endereco },
      { name: 'Número',          val: data.numero },
      { name: 'Complemento',     val: data.complemento },
      { name: 'Bairro',          val: data.bairro },
      { name: 'Cidade',          val: data.cidade },
      { name: 'UF',              val: data.uf },
      { name: 'CEP',             val: data.cep },
    ];

    for (const f of fields) {
      if (f.val.confidence !== 'não encontrado') {
        block += `${f.name}: ${f.val.value} (Confiança: ${f.val.confidence})\n`;
      } else {
        block += `${f.name}: Dado não encontrado nos documentos.\n`;
      }
    }

    return block;
  }
}
