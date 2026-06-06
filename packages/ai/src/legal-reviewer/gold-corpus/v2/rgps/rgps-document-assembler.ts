/**
 * FASE 9.0.8.10 — RGPS Document Assembler
 *
 * Monta o texto final do documento a partir dos elementos e do mapa de degradação.
 * A estrutura de seções varia por documentType.
 */

import { renderElement } from "../document-element.js";
import { findDegradation } from "../degradation-map.js";
import { DocumentSection } from "../gold-corpus-v2.types.js";
import type { DocumentElement, QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { RgpsDocumentType } from "./rgps-scenario.types.js";

// ─── Mapeamento de seções por documentType ────────────────────────────────────

/** Ordem das seções e seus rótulos por tipo de documento. */
const SECTION_ORDER: Record<RgpsDocumentType, Array<{ section: DocumentSection; label: string }>> = {
  PETICAO_INICIAL: [
    { section: DocumentSection.CABECALHO,   label: ""                  },
    { section: DocumentSection.DOS_FATOS,   label: "DOS FATOS"         },
    { section: DocumentSection.DO_DIREITO,  label: "DO DIREITO"        },
    { section: DocumentSection.DAS_PROVAS,  label: "DAS PROVAS"        },
    { section: DocumentSection.DOS_PEDIDOS, label: "DOS PEDIDOS"       },
    { section: DocumentSection.FUNDAMENTACAO, label: "DA FUNDAMENTAÇÃO" },
    { section: DocumentSection.DISPOSITIVO, label: "DO DISPOSITIVO"    },
  ],
  RECURSO: [
    { section: DocumentSection.CABECALHO,   label: ""                        },
    { section: DocumentSection.DOS_FATOS,   label: "DA DECISÃO RECORRIDA"    },
    { section: DocumentSection.DO_DIREITO,  label: "DAS RAZÕES RECURSAIS"    },
    { section: DocumentSection.DAS_PROVAS,  label: "DAS PROVAS"              },
    { section: DocumentSection.DOS_PEDIDOS, label: "DO PEDIDO RECURSAL"      },
    { section: DocumentSection.FUNDAMENTACAO, label: "DA FUNDAMENTAÇÃO"      },
    { section: DocumentSection.DISPOSITIVO, label: "DO DISPOSITIVO"          },
  ],
  CUMPRIMENTO_SENTENCA: [
    { section: DocumentSection.CABECALHO,     label: ""                         },
    { section: DocumentSection.DOS_FATOS,     label: "DO TÍTULO EXECUTIVO"      },
    { section: DocumentSection.DO_DIREITO,    label: "DOS PARÂMETROS DO JULGADO"},
    { section: DocumentSection.DAS_PROVAS,    label: "DA MEMÓRIA DE CÁLCULO"    },
    { section: DocumentSection.DOS_PEDIDOS,   label: "DOS PEDIDOS EXECUTIVOS"   },
    { section: DocumentSection.FUNDAMENTACAO, label: "DA FUNDAMENTAÇÃO"         },
    { section: DocumentSection.DISPOSITIVO,   label: "DO DISPOSITIVO"           },
  ],
};

// ─── Assembler ────────────────────────────────────────────────────────────────

export function assembleRgpsDocument(
  documentType: RgpsDocumentType,
  elements: DocumentElement[],
  degradationMap: QualityDegradationMap,
): string {
  const sectionOrder = SECTION_ORDER[documentType];
  const parts: string[] = [];

  for (const { section, label } of sectionOrder) {
    const sectionElements = elements.filter((e) => e.section === section);
    if (sectionElements.length === 0) continue;

    const rendered = sectionElements
      .map((e) => renderElement(e, findDegradation(degradationMap, e.id)))
      .filter((text) => text.length > 0)
      .join("\n\n");

    if (rendered.length === 0) continue;

    if (label.length > 0) {
      parts.push(`${label}\n\n${rendered}`);
    } else {
      parts.push(rendered);
    }
  }

  return parts.join("\n\n");
}
