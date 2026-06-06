// validation-corpus-runner.test.ts — FASE 6.1.0
//
// Runner do Corpus de Validação V1.
// Objetivo: medir TP/FP/FN por regra nos 4 validators semânticos.
//
// Não testa validators estruturais, score, classificação ou geração.
// Validators auditados:
//   - coverage.validator      (MISSING_ESSENTIAL_TOPIC)
//   - legal-contradiction.validator (12 regras)
//   - request-dispositive.validator (5 regras)
//   - evidence-conclusion.validator (6 regras)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateCoverage } from "../../src/validators/coverage.validator.js";
import { validateLegalContradictions } from "../../src/validators/legal-contradiction.validator.js";
import { validateRequestDispositive } from "../../src/validators/request-dispositive.validator.js";
import { validateEvidenceConclusion } from "../../src/validators/evidence-conclusion.validator.js";
import { makeClassification } from "../helpers/factories.js";
import type { LegalClassification } from "../../src/pipeline/types.js";

// ── Paths ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const CORPUS_PATH       = path.join(__dirname, "../../../../docs/validation/VALIDATION_CORPUS_V1.txt");
const EXPECTATIONS_PATH = path.join(__dirname, "../../../../docs/validation/VALIDATION_EXPECTATIONS_V1.json");

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CaseExpectation {
  id:                    string;
  domain:                string;
  tipo:                  "CORRETO" | "ERRO_CONTROLADO" | "DIFÍCIL";
  expectedAlerts:        string[];
  classificationOverrides?: Partial<LegalClassification>;
  descricao?:            string;
}

interface Metrics { tp: number; fp: number; fn: number; }

// ── Parser do corpus TXT ─────────────────────────────────────────────────────
// Formato esperado:
//   [CASE-NNN]
//   DOMINIO: ...
//   TIPO: ...
//   EXPECTATIVA: ...
//   DESCRICAO: ...
//
//   TEXTO:
//   (texto livre multilinhas)
//
//   ---

function parseCorpus(txt: string): Map<string, string> {
  const cases = new Map<string, string>();
  const blocks = txt.split(/^---\s*$/m);
  for (const block of blocks) {
    const idMatch = block.match(/\[CASE-(\d+)\]/);
    if (!idMatch) continue;
    const id = `CASE-${idMatch[1].padStart(3, "0")}`;
    const textoMatch = block.match(/^TEXTO:\s*\n([\s\S]+)/m);
    if (!textoMatch) continue;
    cases.set(id, textoMatch[1].trim());
  }
  return cases;
}

// ── Execução dos 4 validators semânticos ──────────────────────────────────────

function runSemanticValidators(draft: string, cls: LegalClassification): string[] {
  const rules: string[] = [];
  for (const err of validateCoverage(draft, cls))          rules.push(err.rule);
  for (const err of validateLegalContradictions(draft))    rules.push(err.rule);
  for (const err of validateRequestDispositive(draft))     rules.push(err.rule);
  for (const err of validateEvidenceConclusion(draft))     rules.push(err.rule);
  return [...new Set(rules)];
}

// ── Coleta de métricas ────────────────────────────────────────────────────────

const metricsMap = new Map<string, Metrics>();

function recordTP(rule: string): void {
  const m = metricsMap.get(rule) ?? { tp: 0, fp: 0, fn: 0 };
  m.tp++; metricsMap.set(rule, m);
}
function recordFP(rule: string): void {
  const m = metricsMap.get(rule) ?? { tp: 0, fp: 0, fn: 0 };
  m.fp++; metricsMap.set(rule, m);
}
function recordFN(rule: string): void {
  const m = metricsMap.get(rule) ?? { tp: 0, fp: 0, fn: 0 };
  m.fn++; metricsMap.set(rule, m);
}

// ── Carga ─────────────────────────────────────────────────────────────────────

const corpusTxt    = readFileSync(CORPUS_PATH, "utf-8");
const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf-8")) as CaseExpectation[];
const corpusMap    = parseCorpus(corpusTxt);

// ── Suite de testes ───────────────────────────────────────────────────────────

describe("Corpus V1 — Validação Jurídica", () => {
  for (const exp of expectations) {
    const draft = corpusMap.get(exp.id);
    if (!draft) throw new Error(`Corpus: caso ${exp.id} não encontrado no TXT`);
    const cls = makeClassification(exp.classificationOverrides ?? {});

    describe(`${exp.id} — ${exp.domain} — ${exp.tipo}`, () => {
      it(exp.descricao ?? "valida alertas emitidos vs. esperados", () => {
        let actual: string[] = [];

        assert.doesNotThrow(
          () => { actual = runSemanticValidators(draft, cls); },
          `${exp.id}: validator lançou exceção inesperada`,
        );
        actual = runSemanticValidators(draft, cls);

        // ── DIFÍCIL: apenas smoke — sem asserção de alerta específico ──────────
        if (exp.tipo === "DIFÍCIL") {
          // Registra para observação, mas não falha.
          return;
        }

        // ── CORRETO: nenhum alerta deve ser emitido ───────────────────────────
        if (exp.tipo === "CORRETO") {
          for (const rule of actual) recordFP(rule);
          assert.deepEqual(
            actual,
            [],
            `${exp.id} CORRETO: alertas inesperados emitidos: [${actual.join(", ")}]`,
          );
          return;
        }

        // ── ERRO_CONTROLADO: alertas esperados devem ser emitidos (TP) ────────
        for (const expectedRule of exp.expectedAlerts) {
          if (actual.includes(expectedRule)) {
            recordTP(expectedRule);
          } else {
            recordFN(expectedRule);
            assert.fail(
              `${exp.id}: alerta esperado '${expectedRule}' NÃO foi emitido.\nEmitidos: [${actual.join(", ")}]`,
            );
          }
        }
        // Alertas além dos esperados são FP (registra, não falha).
        for (const rule of actual) {
          if (!exp.expectedAlerts.includes(rule)) recordFP(rule);
        }
      });
    });
  }

  // ── Sumário final de métricas ────────────────────────────────────────────────
  describe("Métricas TP/FP/FN — Corpus V1", () => {
    it("exibe sumário de precisão/recall por regra", () => {
      const total = { tp: 0, fp: 0, fn: 0 };
      const lines: string[] = ["\n── Corpus V1 — Métricas por regra ─────────────────────────────────────────"];

      for (const [rule, m] of [...metricsMap.entries()].sort()) {
        lines.push(`  ${rule.padEnd(52)} TP=${String(m.tp).padStart(2)}  FP=${String(m.fp).padStart(2)}  FN=${String(m.fn).padStart(2)}`);
        total.tp += m.tp;
        total.fp += m.fp;
        total.fn += m.fn;
      }

      const precision = total.tp + total.fp > 0 ? total.tp / (total.tp + total.fp) : 1;
      const recall    = total.tp + total.fn > 0 ? total.tp / (total.tp + total.fn) : 1;
      const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 1;

      lines.push(`\n  TOTAL            TP=${total.tp}  FP=${total.fp}  FN=${total.fn}`);
      lines.push(`  Precision=${(precision * 100).toFixed(1)}%   Recall=${(recall * 100).toFixed(1)}%   F1=${(f1 * 100).toFixed(1)}%`);
      lines.push("────────────────────────────────────────────────────────────────────────────");

      for (const l of lines) console.log(l);

      assert.equal(total.fn, 0, `${total.fn} alerta(s) esperado(s) não detectado(s) — FN > 0`);
    });
  });
});
