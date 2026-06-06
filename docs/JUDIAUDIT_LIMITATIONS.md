# JudiAudit — Limitações do Sistema (FASE 6.0.0)

> Documento de transparência técnica e jurídica do sistema JudiAudit.  
> Versão: MVP 6.0.0 | Data: 2026-06-05

---

## 1. O sistema não usa IA para validação

O JudiAudit é um sistema de **regras determinísticas**. As validações são executadas por expressões regulares, comparadores de texto e lógica programática estática. Nenhum modelo de linguagem (LLM) é invocado durante a fase de auditoria.

A geração de minutas (etapa upstream) usa IA, mas o sistema de auditoria é completamente separado e determinístico.

---

## 2. Opera por regras determinísticas

Cada regra é codificada explicitamente em TypeScript. Um alerta é emitido se e somente se os padrões textuais configurados forem encontrados ou ausentes. Não há aprendizado, adaptação ou inferência.

Consequência: o sistema é previsível, auditável e rastreável — mas não possui capacidade de generalização além dos padrões explicitamente programados.

---

## 3. Não substitui análise jurídica humana

O JudiAudit é uma ferramenta de apoio. Ele **não** emite pareceres jurídicos, **não** substitui a revisão de advogado ou magistrado, e **não** tem responsabilidade profissional sobre os alertas gerados.

Alertas com `fatal: false` são sinalizações para revisão humana, não bloqueios automáticos. Alertas com `fatal: true` indicam problemas estruturais ou normativos graves, mas a decisão final é sempre do operador jurídico.

---

## 4. Pode não detectar argumentos implícitos

O sistema detecta padrões textuais **explícitos**. Argumentos jurídicos implícitos, subentendidos ou expressos indiretamente podem não ser capturados.

Exemplos de limitações de detecção implícita:
- Prescrição reconhecida por referência indireta sem as palavras-chave mapeadas
- Contradição fundamentação × dispositivo com terminologia atípica
- Dependência econômica alegada em termos distintos dos padrões cadastrados

---

## 5. Pode não detectar relações semânticas complexas

O JudiAudit não possui capacidade de compreensão semântica. Ele não consegue:
- Inferir o sentido de frases ambíguas
- Detectar sinonímia não mapeada
- Avaliar coerência argumentativa em nível semântico profundo
- Identificar lógica jurídica implícita ou argumentação circular

Todas as detecções dependem de correspondência com padrões pré-definidos (regex + lógica booleana).

---

## 6. Coverage limitado — domínios atualmente mapeados

O módulo de Coverage (`MISSING_ESSENTIAL_TOPIC`) detecta omissão de tema essencial apenas nos seguintes domínios:

| Domínio | Temas essenciais mapeados |
|---------|--------------------------|
| RGPS | Requisitos do benefício (carência, qualidade de segurado, fato gerador) |
| Tributário | Anulação de débito fiscal (fato gerador, lançamento, decadência/prescrição, defesa) |
| Família | Guarda (melhor interesse, convivência, alimentos, regulamentação de visitas) |
| Consumidor | Dano moral / restituição (relação de consumo, defeito, nexo, quantum) |
| RPPS | Benefício estatutário (regime jurídico, EC 41, requisitos) |
| Trabalhista | Vínculo / rescisão / horas extras (subordinação, onerosidade, pessoalidade, verbas) |
| Ambiental | Dano / nexo / reparação (responsabilidade objetiva, dano ambiental, nexo causal) |
| Criminal | Tipicidade / autoria / materialidade / dosimetria |
| Fazenda Pública | Ato administrativo / concurso / mandado de segurança |

**CIVEL_GERAL permanece fallback residual.** Processos classificados como CIVEL_GERAL não recebem verificação de cobertura de temas essenciais — apenas as demais regras (estruturais, normativas, contradições) são aplicadas.

---

## 7. Limitações específicas por módulo

### Legal Contradiction (`legal-contradiction.validator.ts`)
- Detecta apenas contradições cujos padrões estejam mapeados nas 12 regras implementadas
- Contradições semânticas sutis ou fraseadas de forma atípica podem não ser detectadas

### Request × Dispositive (`request-dispositive.validator.ts`)
- Pedidos explicitamente formulados com verbos mapeados (`requer`, `pede`, `postula`, `pleiteia`)
- Pedidos implícitos ou formulados com termos não mapeados podem ser ignorados
- Rejeição global (`julgo improcedentes todos os pedidos`) desativa os alertas de pedido não enfrentado

### Evidence × Conclusion (`evidence-conclusion.validator.ts`)
- Funciona apenas quando a prova e a conclusão utilizam terminologia próxima dos padrões mapeados
- Possui proteção contra prova negativa (`evidenceNegRe`), mas o mecanismo depende de vocabulário explícito

### Coverage (`coverage.validator.ts`)
- Baseado em contagem de presença/ausência de sinais textuais para cada tema
- Não avalia profundidade ou qualidade do tratamento do tema

---

## 8. Ausência de validação cruzada entre domínios

O sistema valida cada regra de forma independente. Não existe módulo de validação que raciocine sobre a coerência entre múltiplos domínios simultaneamente (ex.: RGPS + Criminal ao mesmo tempo).

---

## 9. Não validado para todos os ritos especiais

Ritos processuais não mapeados explicitamente (ex.: arbitragem, processos administrativos, procedimentos especiais do CPC) podem não acionar as regras corretas ou podem gerar falsos positivos.

---

*Este documento deve ser revisado a cada nova fase de desenvolvimento que adicione ou remova domínios, regras ou capacidades de detecção.*
