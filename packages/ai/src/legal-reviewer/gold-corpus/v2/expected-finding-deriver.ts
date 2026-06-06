/**
 * FASE 9.0.8.9 — ExpectedFindingDeriver
 *
 * Deriva a lista de expectedFindings a partir das degradações aplicadas,
 * garantindo alinhamento de vocabulário entre documento gerado e findings:
 * o omissionDescription de cada elemento é exatamente o texto do finding,
 * e esse texto usa vocabulário que aparece no documento (omittedContent / lightContent).
 *
 * Regras:
 * - WEAKEN não gera finding (enfraquecimento sutil, sem omissão explícita).
 * - OMIT, ABSENT, CONTRADICT → finding via element.omissionDescription.
 * - ElementId sem correspondência é silenciosamente ignorado.
 * - Ordem dos findings segue a ordem de degradations.
 */

import type { DocumentElement, ElementDegradation } from "./gold-corpus-v2.types.js";

export function deriveExpectedFindings(
  degradations: ElementDegradation[],
  elements: DocumentElement[],
): string[] {
  const elementMap = new Map<string, DocumentElement>(
    elements.map((e) => [e.id, e]),
  );

  const findings: string[] = [];

  for (const d of degradations) {
    if (d.mode === "WEAKEN") continue;
    const el = elementMap.get(d.elementId);
    if (el !== undefined) {
      findings.push(el.omissionDescription);
    }
  }

  return findings;
}
