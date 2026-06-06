import type { DomainKnowledgePack } from "./domain-knowledge.types.js";
import { genericLegalKnowledgePack } from "./packs/generic.pack.js";
import { rgpsKnowledgePack } from "./packs/rgps.pack.js";
import { rppsKnowledgePack } from "./packs/rpps.pack.js";
import { trabalhistaKnowledgePack } from "./packs/trabalhista.pack.js";
import { tributarioKnowledgePack } from "./packs/tributario.pack.js";
import { familiaKnowledgePack } from "./packs/familia.pack.js";
import { consumidorKnowledgePack } from "./packs/consumidor.pack.js";
import { criminalKnowledgePack } from "./packs/criminal.pack.js";
import { fazendaPublicaKnowledgePack } from "./packs/fazenda-publica.pack.js";
import { ambientalKnowledgePack } from "./packs/ambiental.pack.js";
import { civelGeralKnowledgePack } from "./packs/civel-geral.pack.js";
import { juizadoEspecialKnowledgePack } from "./packs/juizado-especial.pack.js";

/** Mapeamento canônico: chave normalizada → pack. */
const REGISTRY: Record<string, DomainKnowledgePack> = {
  // Previdenciário RGPS
  RGPS:           rgpsKnowledgePack,
  PREVIDENCIARIO: rgpsKnowledgePack,

  // Previdenciário RPPS
  RPPS: rppsKnowledgePack,

  // Trabalhista
  TRABALHISTA: trabalhistaKnowledgePack,
  TRABALHO:    trabalhistaKnowledgePack,

  // Tributário
  TRIBUTARIO:  tributarioKnowledgePack,
  TRIBUTÁRIO:  tributarioKnowledgePack,
  FISCAL:      tributarioKnowledgePack,

  // Família
  FAMILIA:     familiaKnowledgePack,
  FAMÍLIA:     familiaKnowledgePack,
  FAMILIAR:    familiaKnowledgePack,

  // Consumidor
  CONSUMIDOR:  consumidorKnowledgePack,
  CDC:         consumidorKnowledgePack,

  // Criminal
  CRIMINAL:    criminalKnowledgePack,
  PENAL:       criminalKnowledgePack,

  // Fazenda Pública
  FAZENDA_PUBLICA:  fazendaPublicaKnowledgePack,
  FAZENDA_PÚBLICA:  fazendaPublicaKnowledgePack,
  FAZENDA:          fazendaPublicaKnowledgePack,
  ADMINISTRATIVO:   fazendaPublicaKnowledgePack,

  // Ambiental
  AMBIENTAL: ambientalKnowledgePack,

  // Cível Geral
  CIVEL:       civelGeralKnowledgePack,
  CÍVEL:       civelGeralKnowledgePack,
  CIVEL_GERAL: civelGeralKnowledgePack,
  CIVIL:       civelGeralKnowledgePack,

  // Juizado Especial
  JUIZADO_ESPECIAL:  juizadoEspecialKnowledgePack,
  JUIZADO:           juizadoEspecialKnowledgePack,
  JEC:               juizadoEspecialKnowledgePack,
  JEF:               juizadoEspecialKnowledgePack,
  JECRIM:            juizadoEspecialKnowledgePack,
};

/** Normaliza o domain para lookup no registro. */
function normalizeKey(domain: string): string {
  return domain.trim().toUpperCase().replace(/\s+/g, "_");
}

export class DomainKnowledgeRegistry {
  /**
   * Retorna o pack do domínio solicitado.
   * Se o domínio não for reconhecido, retorna o pack genérico.
   */
  static get(domain: string | undefined): DomainKnowledgePack {
    if (!domain) return genericLegalKnowledgePack;
    return REGISTRY[normalizeKey(domain)] ?? genericLegalKnowledgePack;
  }

  /** Verifica se há um pack especializado para o domínio (útil para telemetria). */
  static has(domain: string | undefined): boolean {
    if (!domain) return false;
    return normalizeKey(domain) in REGISTRY;
  }

  /** Lista todos os domínios registrados com seus packs. */
  static listAll(): DomainKnowledgePack[] {
    return [...new Set(Object.values(REGISTRY)), genericLegalKnowledgePack];
  }

  /**
   * Registra um pack adicional sem alterar o núcleo do reviewer.
   * Permite extensão por packs externos sem modificar este arquivo.
   */
  static register(pack: DomainKnowledgePack, aliases: string[] = []): void {
    const keys = [pack.domain, ...aliases].map(normalizeKey);
    for (const key of keys) {
      REGISTRY[key] = pack;
    }
  }
}
