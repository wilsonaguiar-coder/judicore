# BENCHMARK CONTROLADO: WRITER × LEGALMATRIX

**Process ID:** RPPS-PARIDADE-BENCHMARK
**Modo de Baseline:** MANUAL
**Notas:** Baseline manual extraído da auditoria da Fase 13.0. A métrica 'Depois' utiliza o pipeline exato do LegalMatrixBuilderService processando uma carga mockada representativa da pesquisa (para driblar indisponibilidade da rede).

> **Limitações do Benchmark**: O baseline está no modo MANUAL. Como o pipeline da LegalMatrix "Antiga" (Fase 13.0) foi desativado e substituído pela pesquisa em teses, as métricas de ANTES foram alimentadas de forma estática com base na auditoria histórica documentada.

## 1. LEGAL MATRIX REPORT

| Métrica | Antes | Depois | Delta |
| :--- | :--- | :--- | :--- |
| **Caracteres (Ruído)** | 89000 | 3332 | -96.26% |
| **Total de Teses** | 3 | 3 | - |
| **Dispositivos Legais** | 15 | 2 | -13 |
| **Precedentes** | 12 | 3 | -9 |
| **Duplicações Removidas** | - | 2 | +2 |

## 2. PIECE REPORT (ESTIMATIVA)

- **Caracteres Gerados:** 31800
- **Páginas Estimadas:** 18
