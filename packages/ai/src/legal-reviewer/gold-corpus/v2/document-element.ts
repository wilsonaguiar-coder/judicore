/**
 * FASE 9.0.8.9 — ElementRenderer
 *
 * Função pura que projeta um DocumentElement na string final
 * de acordo com o DegradationMode aplicado.
 *
 * Sem estado, sem I/O, sem efeitos colaterais.
 * O mesmo par (element, degradation) sempre produz o mesmo resultado.
 */

import type { DocumentElement, ElementDegradation } from "./gold-corpus-v2.types.js";

/**
 * Projeta um DocumentElement na string final dado o modo de degradação.
 *
 * | degradation      | resultado                              |
 * |------------------|----------------------------------------|
 * | undefined        | element.fullContent                    |
 * | WEAKEN           | element.lightContent                   |
 * | OMIT             | element.omittedContent                 |
 * | ABSENT           | element.absentContent ?? ""            |
 * | CONTRADICT       | element.absentContent ?? omittedContent|
 */
export function renderElement(
  element: DocumentElement,
  degradation?: ElementDegradation,
): string {
  if (!degradation) return element.fullContent;

  switch (degradation.mode) {
    case "WEAKEN":
      return element.lightContent;
    case "OMIT":
      return element.omittedContent;
    case "ABSENT":
      return element.absentContent ?? "";
    case "CONTRADICT":
      return element.absentContent ?? element.omittedContent;
  }
}
