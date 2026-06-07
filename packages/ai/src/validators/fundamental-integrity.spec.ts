import { FundamentalIntegrityValidator } from "./fundamental-integrity.validator.js";

describe("FundamentalIntegrityValidator", () => {
  let validator: FundamentalIntegrityValidator;

  beforeEach(() => {
    validator = new FundamentalIntegrityValidator();
  });

  it("1. Detecta 'restou comprovado' sem premissa", () => {
    const draft = "Analisando os autos, restou comprovado que a parte autora tem razão.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.expression).toMatch(/restou comprovado/i);
  });

  it("2. Detecta 'todos os requisitos foram preenchidos' sem dados", () => {
    const draft = "O autor ajuizou a ação. Todos os requisitos foram preenchidos. Defiro o pedido.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL");
  });

  it("3. Detecta 'documentação comprova' sem documentos", () => {
    const draft = "A documentação comprova os fatos alegados.";
    const findings = validator.validate(draft, "PETICAO_INICIAL");
    expect(findings.length).toBeGreaterThan(0);
  });

  it("4. Permite conclusão precedida de CNIS e data", () => {
    const draft = "O extrato do CNIS juntado aos autos registra vínculos até 15/03/2022. Portanto, restou comprovado o tempo de contribuição.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBe(0);
  });

  it("5. Permite conclusão precedida de laudo e ID", () => {
    const draft = "Conforme o laudo pericial (ID 123456), há incapacidade total. Ficou demonstrado o direito ao benefício.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBe(0);
  });

  it("6. Permite conclusão precedida de contrato e comprovante", () => {
    const draft = "O contrato assinado pelas partes e o comprovante juntado nos autos indicam o pagamento. É incontroverso o adimplemento.";
    const findings = validator.validate(draft, "DECISAO");
    expect(findings.length).toBe(0);
  });

  it("7. Classifica como FATAL conclusão sem premissa próxima ao dispositivo", () => {
    // Make a long text so it falls in the last third
    const padding = "A ".repeat(400);
    const draft = padding + " Sendo assim, restou comprovado o direito. DISPOSITIVO: julgo procedente.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL");
  });

  it("8. Classifica como WARNING conclusão genérica introdutória", () => {
    // Long text so it falls in the first third, no fatal terms
    const draft = "Inicialmente, verifica-se que a questão é simples. " + "A ".repeat(400);
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("9. Não gerar falso positivo quando houver suporte concreto", () => {
    const draft = "O depoimento da testemunha corroborou a jornada. Ficou demonstrado que fazia horas extras.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBe(0);
  });

  it("10. Artigo legal genérico sozinho não serve como suporte", () => {
    const draft = "Nos termos do art. 5º da CF, restou comprovado o direito do requerente.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0); // Should fail because art 5 alone is not concrete support
  });

  it("11. Despacho sem carga decisória gera no máximo WARNING", () => {
    const draft = "O autor juntou documentos. Verifica-se que a manifestação foi tempestiva. Aguarde-se.";
    const findings = validator.validate(draft, "DESPACHO");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("12. Despacho com 'defiro/indefiro' pode gerar FATAL", () => {
    const draft = "O autor pede urgência. Verifica-se que estão presentes os requisitos. Defiro o pedido liminar.";
    const findings = validator.validate(draft, "DESPACHO");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // Has decision load "Defiro"
  });

  it("13. Conclusão sobre prescrição sem data anterior gera FATAL", () => {
    const draft = "A ação foi ajuizada tardiamente. Restou comprovado que ocorreu a prescrição.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // Has "prescrição" which is fatal context
  });

  it("14. Conclusão sobre carência sem CNIS/períodos/número gera FATAL", () => {
    const draft = "O autor quer o benefício. Restou comprovado o cumprimento da carência e qualidade de segurado.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // "carência" and "qualidade de segurado"
  });

  it("15. Conclusão sobre incapacidade sem laudo/atestado/perícia gera FATAL", () => {
    const draft = "As alegações do autor são fortes. Ficou demonstrada a incapacidade laboral.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // "incapacidade"
  });

  it("16. Conclusão sobre dano moral sem fato concreto gera FATAL", () => {
    const draft = "Houve muito transtorno ao autor. É incontroverso o dano moral suportado.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // "dano moral"
  });

  it("17. Conclusão sobre vínculo empregatício sem CTPS/contrato gera FATAL", () => {
    const draft = "O autor trabalhava no local. A prova produzida evidencia o vínculo empregatício.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.severity).toBe("FATAL"); // "vínculo empregatício"
  });

  it("18. Documento com prova concreta próxima passa sem falso positivo", () => {
    const draft = "Conforme CTPS anotada com admissão em 01/01/2020. A prova produzida evidencia o vínculo empregatício.";
    const findings = validator.validate(draft, "SENTENCA");
    expect(findings.length).toBe(0); // Valid concrete supports: CTPS, data
  });
  
  it("19. Fallback handled safely", () => {
    // Pass null instead of string to force internal error in regex execution
    const findings = validator.validate(null as any, "SENTENCA");
    expect(findings.length).toBe(1);
    expect(findings[0]?.code).toBe("FUNDAMENTAL_INTEGRITY_INTERNAL_ERROR");
    expect(findings[0]?.severity).toBe("WARNING");
  });
});
