import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuditService } from "../../src/audit/audit.service.js";
import type { LegalClassification } from "../../src/pipeline/types.js";

describe("JudiCore ↔ JudiAudit Integração Básica", () => {
  const auditService = new AuditService();

  const mockClassification: LegalClassification = {
    tipo_peca: "SENTENCA",
    regime_juridico: "RGPS",
    tipo_justica: "FEDERAL",
    assunto_principal: "Aposentadoria por Invalidez",
    polo_ativo: "Segurado",
    polo_passivo: "INSS",
    confianca: 0.95,
  };

  it("1. Peça válida deve retornar AuditReport sem erros fatais", () => {
    const draftV1 = `
      SENTENÇA
      
      RELATÓRIO
      Trata-se de ação previdenciária em que a parte autora requer a concessão de aposentadoria por invalidez.
      A autarquia foi devidamente citada e apresentou contestação.
      Realizada perícia médica, o laudo atestou incapacidade total e permanente.
      
      FUNDAMENTAÇÃO
      A qualidade de segurado e a carência restaram incontroversas.
      O laudo pericial confirmou a incapacidade laborativa total e definitiva, preenchendo os requisitos do art. 42 da Lei 8.213/91.
      
      DISPOSITIVO
      Ante o exposto, JULGO PROCEDENTE o pedido para condenar o INSS a implantar o benefício de aposentadoria por invalidez.
    `;

    const result = auditService.auditGeneratedDocument("doc-1", draftV1, mockClassification);

    assert.ok(result.audit, "AuditReport deve estar presente");
    assert.equal(result.audit.status, "APROVADA", "Peça válida deve ser aprovada");
    assert.equal(result.audit.fatalErrors.length, 0, "Não deve conter erros fatais");
  });

  it("2. Peça com erro (Contradição) deve retornar AuditReport com alertas", () => {
    const draftComErro = `
      RELATÓRIO
      O segurado ajuizou ação previdenciária pleiteando auxílio por incapacidade temporária. Foram juntados relatórios médicos, exames e atestados. O INSS defendeu que a documentação não seria suficiente para afastar a conclusão administrativa.
      
      FUNDAMENTAÇÃO
      A prova central é o laudo pericial. A perícia médica judicial registrou incapacidade laboral total e temporária para a atividade habitual, com início provável antes da DER. O perito concluiu que a doença impede esforço físico, permanência prolongada em pé e movimentos repetitivos, recomendando afastamento por período mínimo de doze meses. A perícia médica é detalhada, coerente com os exames e responde aos quesitos essenciais.
      Assim, a prova técnica reconhece incapacidade laboral relevante. A qualidade de segurado consta do CNIS e a carência também foi cumprida. Em termos probatórios, o conjunto dos autos favorece a concessão do benefício por incapacidade.
      
      DISPOSITIVO
      Ante o exposto, julgo improcedente o pedido, pois não faz jus ao benefício por incapacidade. Revogo eventual tutela e deixo de determinar implantação, diante da ausência de incapacidade reconhecida para fins previdenciários.

      A minuta examina o caso a partir dos documentos ordinários do processo e da narrativa constante dos autos. A análise é feita de modo objetivo, com delimitação dos fatos relevantes, identificação da controvérsia e exame dos pontos necessários ao julgamento. As referências processuais são fictícias e foram redigidas apenas para validação do JudiAudit, sem nomes reais, sem dados pessoais verdadeiros e sem qualquer vinculação a processo existente. O texto busca manter linguagem jurídica plausível, com relatório sintético, fundamentação e dispositivo, evitando placeholders e evitando elementos externos ao domínio RGPS. As conclusões abaixo devem ser lidas como peça simulada para fins de teste automatizado.
      [PREENCHER 1] [PREENCHER 2] [PREENCHER 3]
    `;

    const result = auditService.auditGeneratedDocument("doc-2", draftComErro, mockClassification);

    assert.ok(result.audit, "AuditReport deve estar presente");
    assert.equal(result.audit.status, "REPROVADA", "Peça com erros fatais deve ser reprovada");
    assert.ok(result.audit.fatalErrors.length > 0 || result.audit.nonFatalErrors.length > 0, "Deve conter alertas");

    const allErrors = [...result.audit.fatalErrors, ...result.audit.nonFatalErrors];
    assert.ok(allErrors.some(e => e.titulo.includes("Contradição")), "Alertas devem apontar contradição de evidência vs conclusão");
  });

  it("3. Peça vazia deve retornar AuditReport válido sem crash", () => {
    const draftVazio = "   ";

    // Não deve lançar exceção
    let result;
    assert.doesNotThrow(() => {
      result = auditService.auditGeneratedDocument("doc-3", draftVazio, mockClassification);
    }, "Não deve ocorrer crash ao analisar peça vazia");

    assert.ok(result!.audit, "AuditReport deve estar presente");
    assert.equal(result!.audit.status, "REPROVADA", "Peça vazia deve ser reprovada estruturalmente");
  });
});
