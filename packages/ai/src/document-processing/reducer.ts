// Pipeline determinístico de redução de contexto (Sem IA)

export interface IContextReducer {
  process(text: string, docType?: string, maxChars?: number): string;
}

export class ContextReducer implements IContextReducer {
  
  public process(text: string, docType?: string, maxChars: number = 100000): string {
    let reduced = this.cleanFormatting(text);
    reduced = this.prioritizeSections(reduced, maxChars);
    return reduced;
  }

  private cleanFormatting(text: string): string {
    // 1. Remove excesso de quebras de linha
    let cleaned = text.replace(/\n{3,}/g, '\n\n');
    
    // 2. Remove espaços múltiplos
    cleaned = cleaned.replace(/ {2,}/g, ' ');

    // 3. Remove cabeçalhos e rodapés repetitivos, números de página, etc.
    cleaned = cleaned.replace(/P[áa]gina\s+\d+\s+de\s+\d+/gi, '');
    cleaned = cleaned.replace(/Fls?\.?\s*\d+/gi, '');
    
    return cleaned.trim();
  }

  private prioritizeSections(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;

    const keywords = [
      "qualificação", "dos fatos", "do direito", "dos pedidos", 
      "relatório", "fundamentação", "dispositivo", "razões recursais",
      "pedido", "documentos pessoais", "endereço"
    ];

    const lines = text.split('\n');
    const priorityLines: string[] = [];
    const otherLines: string[] = [];

    let currentSectionPriority = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      // Checa se a linha se parece com um cabeçalho prioritário
      const isHeader = keywords.some(k => lower.includes(k)) && line.length < 150;
      
      if (isHeader) {
        currentSectionPriority = true;
      } else if (lower.match(/^[ivx\d]+[\.\-\)\s]+(da|do|das|dos)\s+/i) && line.length < 100) { 
        // Se for um novo cabeçalho numerado que não casou com keywords, tira prioridade
        currentSectionPriority = false; 
      }

      if (currentSectionPriority) {
        priorityLines.push(line);
      } else {
        otherLines.push(line);
      }
    }

    let result = priorityLines.join('\n');
    if (result.length > maxChars) {
      return result.substring(0, maxChars) + "\n...[TRUNCADO]";
    }

    // Se sobrou espaço, injeta o restante dos trechos de forma truncada
    const remaining = maxChars - result.length;
    if (remaining > 100 && otherLines.length > 0) {
      const otherStr = otherLines.join('\n').trim();
      if (otherStr.length > 0) {
        result += "\n\n--- DEMAIS TRECHOS ---\n" + otherStr.substring(0, remaining - 50) + "\n...[TRUNCADO]";
      }
    }

    return result.trim();
  }
}
