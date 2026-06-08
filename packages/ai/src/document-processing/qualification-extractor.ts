export interface QualificationData {
  nome: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  cpf: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  rg: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  endereco: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  cep: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  cidade: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
  uf: { value: string | null; confidence: 'encontrado' | 'baixa confiança' | 'não encontrado' };
}

export class QualificationExtractor {
  static extract(text: string): QualificationData {
    const data: QualificationData = {
      nome: { value: null, confidence: 'não encontrado' },
      cpf: { value: null, confidence: 'não encontrado' },
      rg: { value: null, confidence: 'não encontrado' },
      endereco: { value: null, confidence: 'não encontrado' },
      cep: { value: null, confidence: 'não encontrado' },
      cidade: { value: null, confidence: 'não encontrado' },
      uf: { value: null, confidence: 'não encontrado' },
    };

    // CPF (000.000.000-00)
    const cpfMatch = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    if (cpfMatch) {
      data.cpf = { value: cpfMatch[0], confidence: 'encontrado' };
    }

    // RG (Heurística básica para RG em SP/PR/etc)
    const rgMatch = text.match(/\b(?:RG|Registro\s*Geral)[^\d]{0,5}(\d{1,2}\.?\d{3}\.?\d{3}-?[a-zA-Z0-9]{1,2})\b/i);
    if (rgMatch) {
      data.rg = { value: rgMatch[1] ?? null, confidence: 'encontrado' };
    } else {
      // Loose RG regex
      const looseRgMatch = text.match(/\b\d{1,2}\.\d{3}\.\d{3}-?[0-9xX]\b/);
      if (looseRgMatch && (!data.cpf.value || data.cpf.value !== looseRgMatch[0])) {
         data.rg = { value: looseRgMatch[0], confidence: 'baixa confiança' };
      }
    }

    // CEP
    const cepMatch = text.match(/\b\d{5}-?\d{3}\b/);
    if (cepMatch) {
      data.cep = { value: cepMatch[0], confidence: 'encontrado' };
    }

    // Endereço (Rua/Av/Logradouro)
    const endMatch = text.match(/\b(?:Rua|Avenida|Av\.|Travessa|Logradouro)\s+[A-Za-z0-9\s,.-]{10,80}\b/i);
    if (endMatch) {
      data.endereco = { value: endMatch[0].trim(), confidence: 'baixa confiança' };
    }

    // Nome
    const nomeMatch = text.match(/([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)[,\s]+(?:brasileir[oa]|estado civil|casad[oa]|solteir[oa]|divorciad[oa])/);
    if (nomeMatch) {
      data.nome = { value: nomeMatch[1] ?? null, confidence: 'baixa confiança' };
    }

    // Cidade e UF
    const ufMatch = text.match(/\b(SP|RJ|MG|ES|RS|SC|PR|MS|MT|GO|DF|TO|BA|SE|AL|PE|PB|RN|CE|PI|MA|PA|AP|AM|RR|AC|RO)\b/i);
    if (ufMatch) {
      data.uf = { value: ufMatch[0].toUpperCase(), confidence: 'baixa confiança' };
    }

    return data;
  }

  static formatToPrompt(data: QualificationData): string {
    let block = `\n--- DADOS EXTRAÍDOS DOS DOCUMENTOS ---\n`;
    
    const fields = [
      { name: "Nome", val: data.nome },
      { name: "CPF", val: data.cpf },
      { name: "RG", val: data.rg },
      { name: "Endereço", val: data.endereco },
      { name: "CEP", val: data.cep },
      { name: "Cidade", val: data.cidade },
      { name: "UF", val: data.uf },
    ];

    for (const f of fields) {
      if (f.val.confidence === 'encontrado' || f.val.confidence === 'baixa confiança') {
        block += `${f.name}: ${f.val.value} (Confiança: ${f.val.confidence})\n`;
      } else {
        block += `${f.name}: Dado não encontrado nos documentos.\n`;
      }
    }
    
    return block;
  }
}
