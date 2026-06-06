# CALIBRATION GUIDE

Este documento estabelece as diretrizes e infraestrutura permanente de calibração do **JudiAudit**. Todo o desenvolvimento futuro dos validadores jurídicos semânticos deve se pautar por estas métricas para não degradar a qualidade do produto já homologado.

## 1. O que é TP (True Positive)
É quando o sistema **corretamente emite um alerta** sobre um erro que realmente existe na peça simulada (esperado em um caso `ERRO_CONTROLADO`). Mostra que a regra funciona e detecta a deficiência jurídica com sucesso.

## 2. O que é FP (False Positive)
É quando o sistema **emite um alerta indevidamente**, indicando um erro ou contradição em um caso que na verdade está juridicamente são e completo (um caso `CORRETO`), ou emite um alerta não esperado por erro de compreensão.

## 3. O que é FN (False Negative)
É quando o sistema **deixa de emitir o alerta** obrigatório em um caso `ERRO_CONTROLADO`. Significa que o erro passou despercebido pelos validadores e a peça seria auditada incorretamente como limpa.

## 4. Como interpretar Precision
**Precision (Precisão)** = `TP / (TP + FP)`.
Mede a confiabilidade dos alertas. Se a precisão for de 100%, significa que cada alerta gerado pelo JudiAudit tem razão de ser (sem falsos positivos "gritando" erro onde não existe).

## 5. Como interpretar Recall
**Recall (Revocação)** = `TP / (TP + FN)`.
Mede a sensibilidade de cobertura. Se o recall for de 100%, significa que o JudiAudit conseguiu detectar todos os problemas jurídicos contidos no benchmark sem deixar "passar nada".

## 6. Como interpretar F1
**F1-Score** = `2 * (Precision * Recall) / (Precision + Recall)`.
Média harmônica que avalia a acurácia geral do validador. É a principal métrica final para entender se há um bom equilíbrio entre não gerar falso positivo e não deixar falso negativo.

## 7. Quando recalibrar
A recalibração e atualização do `CALIBRATION_HISTORY.md` devem ocorrer sempre que:
1. Uma **nova regra** for adicionada aos validadores.
2. Uma **regra existente for alterada** para tratar um FP ou FN (Hardening).
3. O corpus oficial (`VALIDATION_CORPUS`) sofrer atualização (ex: evolução de V1 para V2).

## 8. Fluxo Recomendado

Para garantir a estabilidade semântica do sistema, siga a esteira:

```text
Mudança de validator
       ↓
  Rodar corpus (npx vitest run packages/ai/tests/validators/calibration-report.test.ts)
       ↓
Comparar métricas
       ↓
   Homologar
```

## 9. Quality Gates

Os testes de calibração executam a avaliação semântica global de forma não bloqueante (não param o build), servindo para observabilidade. Contudo, as seguintes faixas definem o padrão do MVP:

* **Faixa Verde**
  * Precision >= 95%
  * Recall >= 95%
* **Faixa Amarela**
  * Precision >= 90%
  * Recall >= 90%
* **Faixa Vermelha**
  * Abaixo disso (Exige intervenção antes do próximo deploy produtivo)

## 10. MVP Quality Status

**Corpus:** VALIDATION_CORPUS_V1

**STATUS:** **VERDE**

**Porque:**
Atingimos marca de calibração cirúrgica nos testes oficiais:
* Precision 100%
* Recall 100%

O VALIDATION_CORPUS_V1 é o benchmark oficial e permanente do JudiAudit em regime contínuo.
