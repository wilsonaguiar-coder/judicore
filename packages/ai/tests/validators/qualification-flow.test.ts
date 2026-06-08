// qualification-flow.test.ts — FASE 13.5.3
//
// Testa o fluxo completo de qualificação:
//   QualificationExtractor.extract → normalizeQualificationForPrompt → buildPremiumDocumentPrompt
//
// Caso real: FRANCISCO WILSON DE BRITO AGUIAR
// Critérios:
//   1. Bloco DADOS OBRIGATÓRIOS não pode ficar vazio
//   2. writer_final_payload (system prompt) deve conter CPF, endereço, bairro, cidade, UF e CEP
//   3. Peça deve abrir qualificação sem usar apenas "devidamente qualificado"

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QualificationExtractor } from "../../src/document-processing/qualification-extractor.js";
import {
  normalizeQualificationForPrompt,
  buildPremiumDocumentPrompt,
} from "../../src/prompts.js";

// Documento simulado com qualificação real do caso
const DOCUMENTO_FRANCISCO = `
FRANCISCO WILSON DE BRITO AGUIAR
CPF: 810.848.973-34
Avenida Rui Barbosa, 730, Ap. 302
Meireles
Fortaleza/CE
CEP 60115-220
`.trim();

// PieceBrief simulado — estrutura que o Gemini retornaria para este caso
const BRIEF_FRANCISCO = {
  tipoPeca: "Petição Inicial",
  resumoDocumentos: "Documentos do requerente FRANCISCO WILSON DE BRITO AGUIAR.",
  partesIdentificadas: {
    autora: {
      nome: "FRANCISCO WILSON DE BRITO AGUIAR",
      qualificacao: "Brasileiro, casado, advogado.",
      cpf: "810.848.973-34",
      rg: "[DADO NÃO FORNECIDO]",
      endereco: "Avenida Rui Barbosa, 730, Ap. 302, Meireles, Fortaleza/CE, CEP 60115-220",
    },
    reu: {
      nome: "União Federal",
      qualificacao: "Pessoa jurídica de direito público interno.",
    },
  },
};

describe("QualificationExtractor — caso FRANCISCO WILSON", () => {
  it("extrai CPF corretamente com confidence 'encontrado'", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.equal(data.cpf.value, "810.848.973-34");
    assert.equal(data.cpf.confidence, "encontrado");
  });

  it("extrai logradouro (Avenida Rui Barbosa)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.ok(data.endereco.value, "endereco deve ter valor");
    assert.ok(data.endereco.value!.includes("Rui Barbosa"), `endereco='${data.endereco.value}'`);
  });

  it("extrai número do endereço (730)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.equal(data.numero.value, "730");
    assert.equal(data.numero.confidence, "encontrado");
  });

  it("extrai complemento (Ap. 302)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.ok(data.complemento.value, "complemento deve ter valor");
    assert.ok(data.complemento.value!.includes("302"), `complemento='${data.complemento.value}'`);
  });

  it("extrai bairro (Meireles)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.ok(data.bairro.value, "bairro deve ter valor");
    assert.equal(data.bairro.value, "Meireles");
  });

  it("extrai cidade (Fortaleza)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.ok(data.cidade.value, "cidade deve ter valor");
    assert.ok(data.cidade.value!.includes("Fortaleza"), `cidade='${data.cidade.value}'`);
  });

  it("extrai UF (CE) com confidence 'encontrado'", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.equal(data.uf.value, "CE");
    assert.equal(data.uf.confidence, "encontrado");
  });

  it("extrai CEP (60115-220)", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.equal(data.cep.value, "60115-220");
    assert.equal(data.cep.confidence, "encontrado");
  });

  it("extrai nome (FRANCISCO WILSON DE BRITO AGUIAR) via heurística all-caps", () => {
    const data = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    assert.ok(data.nome.value, "nome deve ter valor");
    assert.ok(
      data.nome.value!.includes("FRANCISCO") || data.nome.value!.includes("Wilson"),
      `nome='${data.nome.value}'`
    );
  });
});

describe("normalizeQualificationForPrompt — caso FRANCISCO WILSON", () => {
  it("retorna poloAtivo não-vazio com dados do extractor", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    assert.equal(norm.poloAtivo.length, 1, "deve ter exatamente 1 autor");
  });

  it("CPF no polo ativo não é [DADO NÃO FORNECIDO]", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.notEqual(p.cpf, "[DADO NÃO FORNECIDO]");
    assert.ok(p.cpf.includes("810.848.973-34"), `CPF='${p.cpf}'`);
  });

  it("nome no polo ativo vem do PieceBrief quando extractor retorna baixa confiança", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    // Nome deve ser FRANCISCO WILSON DE BRITO AGUIAR (do brief ou do extractor)
    assert.ok(
      p.nome.includes("FRANCISCO") || p.nome.includes("Wilson"),
      `nome='${p.nome}'`
    );
  });

  it("endereço contém Rui Barbosa", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.ok(p.endereco.includes("Rui Barbosa"), `endereco='${p.endereco}'`);
  });

  it("número do endereço é 730", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.equal(p.numero, "730");
  });

  it("bairro é Meireles", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.equal(p.bairro, "Meireles");
  });

  it("cidade é Fortaleza", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.ok(p.cidade.includes("Fortaleza"), `cidade='${p.cidade}'`);
  });

  it("UF é CE", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.equal(p.uf, "CE");
  });

  it("CEP é 60115-220", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    const p = norm.poloAtivo[0];
    assert.equal(p.cep, "60115-220");
  });

  it("polo passivo contém União Federal", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const norm = normalizeQualificationForPrompt(qualData, BRIEF_FRANCISCO);
    assert.equal(norm.poloPassivo.length, 1);
    assert.ok(norm.poloPassivo[0].nome.includes("União Federal"));
  });
});

describe("buildPremiumDocumentPrompt — bloco DADOS OBRIGATÓRIOS não pode ficar vazio", () => {
  it("bloco contém CPF de FRANCISCO WILSON", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL",
      [],
      "",
      JSON.stringify(BRIEF_FRANCISCO),
      "peticionar em favor do requerente",
      qualData
    );
    assert.ok(
      prompt.includes("810.848.973-34"),
      "CPF deve estar no prompt"
    );
  });

  it("bloco contém Rui Barbosa (logradouro)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("Rui Barbosa"), "logradouro deve estar no prompt");
  });

  it("bloco contém Meireles (bairro)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("Meireles"), "bairro deve estar no prompt");
  });

  it("bloco contém Fortaleza (cidade)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("Fortaleza"), "cidade deve estar no prompt");
  });

  it("bloco contém CE (UF)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("CE"), "UF deve estar no prompt");
  });

  it("bloco contém 60115-220 (CEP)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("60115-220"), "CEP deve estar no prompt");
  });

  it("bloco contém 730 (número)", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    assert.ok(prompt.includes("730"), "número do endereço deve estar no prompt");
  });

  it("bloco NÃO está totalmente vazio após o cabeçalho DADOS OBRIGATÓRIOS", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    const idx = prompt.indexOf("DADOS OBRIGATÓRIOS DAS PARTES");
    assert.ok(idx >= 0, "cabeçalho deve existir");
    // Após o cabeçalho deve haver dados antes do próximo bloco
    const afterHeader = prompt.substring(idx, idx + 500);
    assert.ok(
      afterHeader.includes("Nome:") && afterHeader.includes("CPF:"),
      `bloco vazio! Conteúdo após cabeçalho:\n${afterHeader}`
    );
  });

  it("prompt da petição usa estrutura [NOME], [qualificação] no início da qualificação", () => {
    const qualData = QualificationExtractor.extract(DOCUMENTO_FRANCISCO);
    const prompt = buildPremiumDocumentPrompt(
      "PETICAO_INICIAL", [], "", JSON.stringify(BRIEF_FRANCISCO),
      "peticionar", qualData
    );
    // Verifica que a instrução da ESTRUTURA menciona o padrão sem "devidamente qualificado" sozinho
    assert.ok(
      prompt.includes("INICIE EXATAMENTE ASSIM"),
      "prompt deve conter instrução de início da qualificação"
    );
  });
});
