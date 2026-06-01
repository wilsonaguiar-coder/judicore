// Regras específicas de Direito Previdenciário (RPPS e RGPS)

export const RPPS_RULES = {
  descricao: "Regime Próprio de Previdência Social — Servidores Públicos",
  fundamento_constitucional: "art. 40 CF/88",
  artigos_corretos: ["art. 40 CF", "art. 40 §1º CF", "art. 40 §7º CF", "art. 40 §8º CF"],
  artigos_bloqueados: ["art. 201 CF", "art. 201 da CF", "Lei 8.213/91", "art. 7º VI CF"],
  tribunal_competente: "Justiça Federal (se servidor federal) ou Justiça Estadual (se servidor estadual/municipal)",
  notas: [
    "Art. 40 §7º CF — pensão por morte de servidor",
    "Art. 40 §8º CF — irredutibilidade e reajuste dos benefícios de servidor (NÃO art. 7º VI)",
    "Art. 7º VI CF — salário de empregado CLT, PROIBIDO em servidor",
  ],
};

export const RGPS_RULES = {
  descricao: "Regime Geral de Previdência Social — INSS",
  fundamento_constitucional: "art. 201 CF/88",
  lei_principal: "Lei 8.213/91 (Plano de Benefícios da Previdência Social)",
  artigos_corretos: ["art. 201 CF", "Lei 8.213/91", "Decreto 3.048/99"],
  artigos_bloqueados: ["art. 40 CF", "art. 40 da CF"],
  tribunal_competente: "Justiça Federal (regra geral) ou JEF (causas até 60 salários mínimos)",
  beneficios: [
    "Aposentadoria por incapacidade permanente (auxílio-doença → aposentadoria por invalidez — art. 42 Lei 8.213/91)",
    "Aposentadoria programada (art. 201 §7º CF/88)",
    "Auxílio por incapacidade temporária (art. 59 Lei 8.213/91)",
    "Salário-maternidade (art. 71 Lei 8.213/91)",
    "Pensão por morte (art. 74 Lei 8.213/91)",
    "BPC/LOAS (art. 20 Lei 8.742/93)",
  ],
};

export const PREVIDENCIARIO_COMMON_ERRORS = [
  "Citar art. 40 CF em benefício do INSS (RGPS) → usar art. 201 CF",
  "Citar art. 201 CF em benefício de servidor público (RPPS) → usar art. 40 CF",
  "Citar art. 7º VI CF (salário) em benefício previdenciário → usar art. 40 §8º CF (servidor) ou arts. Lei 8.213/91 (INSS)",
  "Usar honorários do CPC em ação previdenciária federal → verificar JEF (sem honorários)",
];
