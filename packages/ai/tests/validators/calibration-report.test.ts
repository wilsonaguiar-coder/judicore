// calibration-report.test.ts — FASE 6.2.0
//
// Calibration Framework Runner.
// Executa o benchmark oficial (VALIDATION_CORPUS_V1) para produzir um relatório estruturado.
// Não deve bloquear build (sem asserções de erro baseadas em FN/FP).
// Apenas reporta métricas: TP, FP, FN, Precision, Recall, F1.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";
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

// ── Execução dos validators ───────────────────────────────────────────────────

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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Calibration Framework — Relatório Contínuo", () => {
  it("executa benchmark e produz resumo estruturado", () => {
    for (const exp of expectations) {
      const draft = corpusMap.get(exp.id);
      if (!draft) continue;
      const cls = makeClassification(exp.classificationOverrides ?? {});

      const actual = runSemanticValidators(draft, cls);

      // Casos DIFÍCIL não entram no cálculo de métricas principais, pois são apenas para medir tendência.
      if (exp.tipo === "DIFÍCIL") {
        continue;
      }

      if (exp.tipo === "CORRETO") {
        for (const rule of actual) recordFP(rule);
        continue;
      }

      // ERRO_CONTROLADO
      for (const expectedRule of exp.expectedAlerts) {
        if (actual.includes(expectedRule)) {
          recordTP(expectedRule);
        } else {
          recordFN(expectedRule);
        }
      }
      
      for (const rule of actual) {
        if (!exp.expectedAlerts.includes(rule)) recordFP(rule);
      }
    }

    const total = { tp: 0, fp: 0, fn: 0 };
    for (const m of metricsMap.values()) {
      total.tp += m.tp;
      total.fp += m.fp;
      total.fn += m.fn;
    }

    const precision = total.tp + total.fp > 0 ? total.tp / (total.tp + total.fp) : 1;
    const recall    = total.tp + total.fn > 0 ? total.tp / (total.tp + total.fn) : 1;
    const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 1;

    const report = {
      corpus: "VALIDATION_CORPUS_V1",
      tp: total.tp,
      fp: total.fp,
      fn: total.fn,
      precision: parseFloat((precision * 100).toFixed(1)),
      recall: parseFloat((recall * 100).toFixed(1)),
      f1: parseFloat((f1 * 100).toFixed(1)),
    };

    console.log(JSON.stringify(report, null, 2));
  });
});
