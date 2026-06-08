export interface StyleValidationResult {
  score: number;
  warnings: string[];
}

export class StyleLinter {
  // Proibições absolutas (causam perda de 10 pontos cada)
  private static readonly BANNED_EXPRESSIONS = [
    "vem, respeitosamente",
    "vem perante vossa excelência",
    "vem à presença de vossa excelência",
    "vem a presença de vossa excelência",
    "data maxima venia",
    "nobre julgador",
    "douto juízo",
    "merece prosperar",
    "não merece prosperar",
    "patente que",
    "resta demonstrado",
    "resta comprovado",
    "conforme amplamente demonstrado",
    "diante do exposto, requer",
    "ante o exposto, requer",
    "pelo exposto, requer",
    "requer-se",
    "termos em que,",
    "termos em que",
    "pede deferimento",
    "pede deferimento."
  ];

  // Expressões toleradas, mas punidas se repetidas > 1 vez (causam perda de 5 pontos por excesso)
  private static readonly REPETITIVE_EXPRESSIONS = [
    "cumpre destacar",
    "cumpre observar",
    "cumpre registrar",
    "importa destacar",
    "importa salientar",
    "vale destacar",
    "vale ressaltar",
    "nesse contexto",
    "nesse sentido"
  ];

  public static validateStyle(piece: string): StyleValidationResult {
    let score = 100;
    const warnings: string[] = [];
    const textLower = piece.toLowerCase();

    // 1. Validar Banidas
    for (const exp of this.BANNED_EXPRESSIONS) {
      if (textLower.includes(exp)) {
        score -= 10;
        warnings.push(`[ERRO GRAVE] Expressão proibida detectada: "${exp}"`);
      }
    }

    // 2. Validar Repetitivas
    for (const exp of this.REPETITIVE_EXPRESSIONS) {
      const occurrences = this.countOccurrences(textLower, exp);
      if (occurrences > 1) {
        score -= (occurrences - 1) * 5;
        warnings.push(`[REPETIÇÃO] Expressão "${exp}" utilizada ${occurrences} vezes (ideal: 0 ou 1)`);
      }
    }

    // Normaliza o score para não ser negativo
    if (score < 0) score = 0;

    return { score, warnings };
  }

  private static countOccurrences(text: string, searchStr: string): number {
    let count = 0;
    let pos = text.indexOf(searchStr);
    while (pos !== -1) {
      count++;
      pos = text.indexOf(searchStr, pos + searchStr.length);
    }
    return count;
  }
}
