import type { FastifyInstance } from "fastify";
import {
  FinalValidator,
  AuditReportEngine,
  LegalClassifierService,
  LegalExtractionService,
  LegalAuditService,
} from "@judicore/ai";
import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  TipoPeca,
  TipoJustica,
  RegimeJuridico,
} from "@judicore/ai";
import { extractText } from "../lib/text-extract.js";

// ── Singletons ────────────────────────────────────────────────────────────────

const finalValidator  = new FinalValidator();
const auditEngine     = new AuditReportEngine();
const classifierSvc   = new LegalClassifierService();
const extractorSvc    = new LegalExtractionService();
const auditorSvc      = new LegalAuditService();

// ── Heuristic helpers ─────────────────────────────────────────────────────────

function heuristicClassify(text: string): LegalClassification {
  let tipo_peca: TipoPeca = "PETICAO_INICIAL";
  if (/\b(?:raz[õo]es?\s+(?:de\s+)?recurs|recurs(?:o|ais?)\s+(?:inominado|ordin[aá]rio|de\s+apela[cç][aã]o|especial|extraordin[aá]rio|agrav|apelaç)|apela[cç][aã]o\s+c[íi]vel|agrav(?:o|ando)\s+(?:de\s+instrumento|regiment|regimental)|embargos?\s+(?:de\s+(?:declara[cç][aã]o|divergência)|infring))\b/i.test(text))
    tipo_peca = "RECURSO";
  else if (/\b(?:decido|decisão\s+interlocut[oó]ria|E\s+o\s+relatório\.\s+Decido)\b/i.test(text))
    tipo_peca = "DECISAO";
  else if (/\b(?:julgo\s+(?:procedente|improcedente|parcialmente)|condeno\s+o\s+(?:r[eé]u|executado)|absolvo\s+o\s+r[eé]u|DISPOSITIVO)\b/i.test(text))
    tipo_peca = "SENTENCA";
  else if (/\bdespacho\b/i.test(text))
    tipo_peca = "DESPACHO";

  let regime_juridico: RegimeJuridico = null;
  if (/\b(?:RPPS|regime\s+pr[oó]prio|art\.?\s*40\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)|EC\s*41)\b/i.test(text))
    regime_juridico = "RPPS";
  else if (/\b(?:RGPS|INSS|Lei\s+(?:n[.°º]?\s*)?8\.213|art\.?\s*201\s+(?:da\s+)?(?:CF|Constitui[cç][aã]o)|\bLOAS\b|previd[eê]ncia\s+social)\b/i.test(text))
    regime_juridico = "RGPS";
  else if (/\b(?:CLT|CTPS|Reclamante|Reclamado|TRT\d?|TST|v[íi]nculo\s+empreg[ae]t[íi]cio)\b/i.test(text))
    regime_juridico = "CLT";
  else
    regime_juridico = "CIVIL";

  let tipo_justica: TipoJustica = "ESTADUAL";
  if (/\b(?:juizado\s+especial\s+federal|JEF|lei\s+(?:n[.°º]?\s*)?10\.259)\b/i.test(text))
    tipo_justica = "JEF";
  else if (/\b(?:juizado\s+especial\s+(?:c[íi]vel|criminal)|lei\s+(?:n[.°º]?\s*)?9\.099)\b/i.test(text))
    tipo_justica = "JEC";
  else if (/\b(?:CLT|TRT\d?|TST|Reclamante)\b/i.test(text))
    tipo_justica = "TRABALHO";
  else if (/\b(?:execu[cç][aã]o\s+fiscal|d[íi]vida\s+ativa|CDA)\b/i.test(text))
    tipo_justica = "EXECUCAO_FISCAL";
  else if (/\b(?:crime|criminal|r[eé]u\s+(?:foi|está)|pena\s+de|art\.?\s*\d+.*?\bCP\b)\b/i.test(text))
    tipo_justica = "CRIMINAL";
  else if (/\b(?:TRF\d?|Vara\s+(?:Federal|da\s+Justi[cç]a\s+Federal))\b/i.test(text))
    tipo_justica = "FEDERAL";

  const assunto_principal = detectAssunto(text, tipo_peca, regime_juridico);

  return {
    tipo_justica,
    tipo_peca,
    regime_juridico,
    grau: "PRIMEIRO",
    tribunal_competente: "Não identificado",
    rito: null,
    assunto_principal,
    partes: { autor: "Não identificado", reu: "Não identificado" },
    confianca: 0.6,
  };
}

function detectAssunto(text: string, tipo_peca: TipoPeca, regime: RegimeJuridico): string {
  if (regime === "RPPS") return "Regime Próprio de Previdência Social";
  if (regime === "RGPS") {
    if (/aux[íi]lio[-\s]doen[cç]a/i.test(text)) return "Benefício Previdenciário — Auxílio-doença";
    if (/aposentadori/i.test(text)) return "Benefício Previdenciário — Aposentadoria";
    if (/BPC|LOAS/i.test(text)) return "Benefício de Prestação Continuada";
    return "Benefício Previdenciário";
  }
  if (regime === "CLT") return "Relação de Trabalho";
  if (/execu[cç][aã]o|cumprimento\s+de\s+senten[cç]a|SISBAJUD/i.test(text))
    return "Execução / Cumprimento de Sentença";
  if (/consumidor|CDC|dano\s+moral|rela[cç][aã]o\s+de\s+consumo/i.test(text))
    return "Direito do Consumidor";
  if (tipo_peca === "RECURSO") return "Recurso";
  return "Demanda Judicial";
}

function emptyExtraction(): LegalExtraction {
  return {
    fatos: [],
    pedidos: [],
    questoes_juridicas: [],
    artigos_citados: [],
    jurisprudencias_relevantes: [],
    qualidade_extracao: "PARCIAL",
    motivo_qualidade: "Análise avulsa — extração automática não realizada",
  };
}

function emptyMatrix(): ArgumentationMatrix {
  return { teses: [] };
}

function syntheticAudit(fatalErrors: number, nonFatalErrors: number): LegalAudit {
  const base = 80;
  const score = Math.max(25, Math.min(95, base - fatalErrors * 15 - nonFatalErrors * 2));
  return {
    aprovada: score >= 70 && fatalErrors === 0,
    score,
    erros: [],
    resumo: "Score calculado por análise determinística (modo Rápido)",
    document_confidence: score / 100,
  };
}

// ── Análise Rápida — 0 chamadas de IA ─────────────────────────────────────────

function runRapida(draft: string) {
  const classification = heuristicClassify(draft);
  const extraction     = emptyExtraction();
  const matrix         = emptyMatrix();
  const tmpAudit: LegalAudit = { aprovada: true, score: 75, erros: [], resumo: "" };

  const vr = finalValidator.validate(draft, classification, extraction, matrix, tmpAudit, [], "FINAL_DRAFT", []);

  const fatalCount = vr.errors.filter((e) => e.fatal).length;
  const nfCount    = vr.errors.filter((e) => !e.fatal).length;
  const audit      = syntheticAudit(fatalCount, nfCount);

  const report = auditEngine.generate(draft, vr, classification, extraction, matrix, audit, [], [], undefined);
  return { report, classification };
}

// ── Análise Completa — classificação + extração + auditoria por IA ─────────────

async function runCompleta(draft: string) {
  // 1. Classificação
  let classification: LegalClassification;
  try {
    const { classification: cls } = await classifierSvc.classify(draft.slice(0, 8_000), null, []);
    classification = cls;
  } catch {
    classification = heuristicClassify(draft);
  }

  // 2. Extração
  let extraction: LegalExtraction;
  try {
    const { extraction: ext } = await extractorSvc.extract(draft.slice(0, 12_000), classification, []);
    extraction = ext;
  } catch {
    extraction = emptyExtraction();
  }

  const matrix = emptyMatrix();

  // 3. Validators (placeholder audit para obter errors)
  const tmpAudit: LegalAudit = { aprovada: true, score: 75, erros: [], resumo: "" };
  const vrTmp = finalValidator.validate(draft, classification, extraction, matrix, tmpAudit, [], "FINAL_DRAFT", []);

  // 4. Auditoria IA
  let audit: LegalAudit;
  try {
    const { audit: aud } = await auditorSvc.audit(draft, classification, matrix);
    audit = aud;
  } catch {
    const fatalCount = vrTmp.errors.filter((e) => e.fatal).length;
    const nfCount    = vrTmp.errors.filter((e) => !e.fatal).length;
    audit = syntheticAudit(fatalCount, nfCount);
  }

  // 5. Validators finais com audit correto
  const vr = finalValidator.validate(draft, classification, extraction, matrix, audit, [], "FINAL_DRAFT", []);
  const report = auditEngine.generate(draft, vr, classification, extraction, matrix, audit, [], [], undefined);
  return { report, classification };
}

// ── Fastify route plugin ───────────────────────────────────────────────────────

export async function auditRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.post<{
    Body: { text?: string; mode?: string };
  }>("/analyze", { onRequest: [authenticate] }, async (request, reply) => {
    let draft        = "";
    let mode: "RAPIDA" | "COMPLETA" = "COMPLETA";
    let origem: "UPLOAD" | "TEXTO_COLADO" = "TEXTO_COLADO";
    let fileFormat   = "TXT";
    let originalFilename: string | undefined;

    // ── Parse input (multipart file OR JSON text) ────────────────────────
    try {
      if (request.isMultipart()) {
        for await (const part of request.parts({ limits: { fileSize: 30 * 1024 * 1024 } })) {
          if (part.type === "file") {
            const buf = await part.toBuffer();
            const extracted = await extractText(buf, part.mimetype ?? "text/plain", part.filename);
            draft = extracted.text;
            fileFormat = extracted.format;
            originalFilename = part.filename;
            origem = "UPLOAD";
          } else {
            const val = (part.value as Promise<string> | string);
            const str = typeof val === "string" ? val : await val;
            if (part.fieldname === "mode" && str) mode = str as "RAPIDA" | "COMPLETA";
            if (part.fieldname === "text" && str?.trim()) { draft = str; origem = "TEXTO_COLADO"; }
          }
        }
      } else {
        const body = request.body;
        if (body?.text) { draft = body.text; origem = "TEXTO_COLADO"; }
        if (body?.mode) mode = body.mode as "RAPIDA" | "COMPLETA";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }

    const trimmed = draft.trim();
    if (trimmed.length < 100) {
      return reply.status(400).send({ error: "Texto insuficiente para análise (mínimo 100 caracteres)." });
    }

    // Limita a 80.000 caracteres para não estourar contexto
    const text = trimmed.slice(0, 80_000);

    try {
      const result = mode === "RAPIDA"
        ? runRapida(text)
        : await runCompleta(text);

      return reply.send({
        report: result.report,
        meta: {
          tipoPeca:          result.classification.tipo_peca,
          assuntoPrincipal:  result.classification.assunto_principal,
          regimeJuridico:    result.classification.regime_juridico,
          tipoJustica:       result.classification.tipo_justica,
          fileFormat,
          originalFilename,
          mode,
        },
        origem,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "[audit/analyze] erro");
      return reply.status(500).send({ error: msg });
    }
  });
}
