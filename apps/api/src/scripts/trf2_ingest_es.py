#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Informativos de Jurisprudência (INFOJUR) do TRF2 no Elasticsearch.

Formato dos PDFs: INFOJUR NNN — cada decisão possui:
  [TIPO] [–|-|Nº]? [NUMERO_CNJ]
  [JULGADO INÉDITO | referência a edição anterior]
  Decisão em DD/MM/YYYY - Disponibilização no ...
  Relator: [Título] NOME
  Relator para Acórdão: [Título] NOME - [TURMA]   (opcional)
  volta
  [EMENTA - primeira linha após 'volta']
  [texto completo da decisão...]

Uso:
    python trf2_ingest_es.py [--folder e:/judicore/temp/trf2]
    python trf2_ingest_es.py --dry-run
    python trf2_ingest_es.py --reset
    python trf2_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
from elasticsearch import Elasticsearch, helpers

# ── Configuração ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent  # e:/judicore
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "trf2"
CHECKPOINT_FILE = SCRIPT_DIR / "trf2_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "trf2_ingest_es.log"
EMENTAS_FILE = PROJECT_ROOT / "trf2_ementas.json"
ES_INDEX = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

# Cabeçalho de cada decisão: TIPO seguido do número CNJ
# Ex: "APELAÇÃO CÍVEL – 0023586-43.2013.4.02.5101"
# Ex: "AGRAVO DE INSTRUMENTO Nº 5001309-75.2020.4.02.0000"
# Ex: "TRF2: AC 0015074-73.2020.4.02.5001"  ← apenas citação de referência, ignorada
HEADER_RE = re.compile(
    r"(?:^|\n)[ \t]*"
    r"([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][^\n]{2,70}?)"
    r"\s*[–\-—]?\s*(?:Nº\s*)?"
    r"(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})",
    re.MULTILINE,
)

DATA_RE = re.compile(r"Decis[aã]o\s+em\s+(\d{2}/\d{2}/\d{4})", re.IGNORECASE)

EDITION_RE = re.compile(r"informativo-de-jurisprudencia-(\d+)", re.IGNORECASE)

# Classificação de área pelo cabeçalho da ementa (primeiros 200 chars)
# As ementas do TRF2 quase sempre começam com o assunto em caps: "TRIBUTÁRIO.", "PENAL E PROCESSUAL PENAL.", etc.
_EMENTA_HEAD_AREA: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL",       re.compile(r"\b(?:penal|criminal|processo\s+penal|habeas[\s\-]corpus)\b", re.IGNORECASE)),
    ("PREVIDENCIARIO", re.compile(r"\bprevid[eê]nci[aá]ri[oa]\b", re.IGNORECASE)),
    ("TRIBUTARIO",     re.compile(r"\btribut[aá]ri[oa]\b", re.IGNORECASE)),
    ("ADMINISTRATIVO", re.compile(r"\b(?:administrativo|improbidade|militar)\b", re.IGNORECASE)),
    ("AMBIENTAL",      re.compile(r"\bambiental\b", re.IGNORECASE)),
    ("CIVIL",          re.compile(r"\bcivil\b", re.IGNORECASE)),
]

# Fallback: classificação por palavras-chave no texto completo
AREA_RULES: list[tuple[str, re.Pattern]] = [
    ("PREVIDENCIARIO", re.compile(
        r"previd[eê]nci|aposen(?:tad|tor)|inss\b|pens[aã]o\s+por\s+morte|"
        r"aux[íi]lio[- ]doen|invalidez\b|segurado\b|sal[aá]rio[- ]matern|RGPS",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r[io]|imposto\b|icms\b|iss\b|ipi\b|pis\b|cofins\b|"
        r"execu[çc][aã]o\s+fiscal|cr[eé]dito\s+tribut|contribui[çc][aã]o\s+(?:social|previd)|"
        r"\birrf?\b|\birpj\b|\bcsll\b",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\s+p[úu]blico|concurso\s+p[úu]blico|licita[çc][aã]o\b|"
        r"improbidade\b|ato\s+administrativo|cargo\s+p[úu]blico|fun[çc][aã]o\s+p[úu]blica|"
        r"desapropria[çc][aã]o\b",
        re.IGNORECASE,
    )),
    ("CRIMINAL", re.compile(
        r"\bcrime\b|\bpenal\b|\bpena\s|\br[eé]u\b|den[úu]ncia\b|habeas.corpus|"
        r"contrabando\b|estelionato\b|homic[íi]dio\b|tr[aá]fico\b|corrup[çc][aã]o\b|"
        r"furto\b|roubo\b|lavagem\s+de\s+dinheiro",
        re.IGNORECASE,
    )),
    ("AMBIENTAL", re.compile(
        r"ambiental\b|meio\s+ambiente|licen[çc]a\s+ambiental|desmatamento\b|"
        r"ibama\b|[aá]rea\s+de\s+preserva[çc][aã]o",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"responsabilidade\s+civil|indeniza[çc][aã]o\s|usucapi[aã]o\b|"
        r"loca[çc][aã]o\b|propriedade\s|poss(?:e|eiro)\b|valores\s+mobili[aá]rios",
        re.IGNORECASE,
    )),
]

_VISTOS_RE = re.compile(r"^[Vv]istos\s+e\s+relatados", re.IGNORECASE)

MESES_PT = {
    "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03",
    "abril": "04", "maio": "05", "junho": "06", "julho": "07",
    "agosto": "08", "setembro": "09", "outubro": "10",
    "novembro": "11", "dezembro": "12",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(raw: str) -> Optional[str]:
    raw = raw.replace("\n", " ").strip()
    dates = re.findall(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if dates:
        d, mo, y = dates[-1]
        return f"{y}-{mo}-{d}"
    dates = re.findall(r"(\d{2})/(\d{2})/(\d{2})\b", raw)
    if dates:
        d, mo, y = dates[-1]
        y_full = f"20{y}" if int(y) < 50 else f"19{y}"
        return f"{y_full}-{mo}-{d}"
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", raw, re.IGNORECASE)
    if m:
        d, mes, y = m.groups()
        mo = MESES_PT.get(mes.lower())
        if mo:
            return f"{y}-{mo}-{int(d):02d}"
    m = re.search(r"\b(20\d{2})\b", raw)
    if m:
        return f"{m.group(1)}-01-01"
    return None


def classify_area(text: str) -> str:
    for area, pattern in AREA_RULES:
        if pattern.search(text):
            return area
    return "OUTRO"


def classify_area_from_ementa(ementa: str) -> str:
    """Classifica pela cabeçalho da ementa (primeiros 200 chars); fallback para texto completo."""
    head = ementa[:200]
    for area, pat in _EMENTA_HEAD_AREA:
        if pat.search(head):
            return area
    return classify_area(ementa)


def clean_title_prefix(content: str) -> str:
    """Remove prefixo de título: 'Desembargador(a) Federal', 'Juiz(a) Federal Convocado/a', etc."""
    # Remove título completo incluindo variantes com "Convocado(a)"
    return re.sub(
        r"^(?:Des(?:embargador[a]?)?\.?|Ju[íi]z[a]?)\.?\s+(?:Federal\s+)?(?:Convocad[oa]\s+)?",
        "",
        content,
        flags=re.IGNORECASE,
    ).strip()


def split_name_turma(content: str) -> tuple[str, str]:
    """
    Divide 'NOME - Turma' em (nome, turma).
    Aceita ' - ', '- ' (sem espaço antes) e '-' simples antes de dígito ordinal.
    """
    # Padrão: NAME seguido de (espaço opcional) dash (espaço) TURMA
    m = re.search(r"\s*-\s+(.+)$", content)
    if m:
        turma = m.group(1).strip()
        name = content[: m.start()].strip()
        return name, turma
    return content.strip(), ""


def extract_relator_turma(block: str) -> tuple[str, str]:
    """
    Extrai relator (quem assinou o acórdão) e órgão julgador do bloco de cabeçalho.
    Prefere 'Relator para Acórdão' sobre 'Relator' quando ambos existirem.
    """
    rpa_name = rpa_turma = rel_name = rel_turma = ""

    # Limita a análise ao trecho antes de 'volta'
    volta_pos = block.lower().find("volta")
    header_chunk = block[: volta_pos + 5 if volta_pos >= 0 else 600]

    for line in header_chunk.split("\n"):
        line = line.strip()
        if not line:
            continue

        if re.match(r"[Rr]elator\s+para\s+[Aa]c[oó]rd[aã]o\s*:", line):
            content = re.sub(r"^[Rr]elator\s+para\s+[Aa]c[oó]rd[aã]o\s*:\s*", "", line)
            content = clean_title_prefix(content)
            name, turma_part = split_name_turma(content)
            rpa_name, rpa_turma = name, turma_part

        elif re.match(r"[Rr]elator\s*:", line) and not re.match(r"[Rr]elator\s+para", line):
            content = re.sub(r"^[Rr]elator\s*:\s*", "", line)
            content = clean_title_prefix(content)
            name, turma_part = split_name_turma(content)
            rel_name, rel_turma = name, turma_part

    # Relator para Acórdão tem prioridade
    if rpa_name:
        return rpa_name, rpa_turma or rel_turma
    return rel_name, rel_turma


def pdf_to_text(path: str) -> str:
    doc = fitz.open(path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


def clean_block(text: str) -> str:
    # Remove cabeçalhos INFOJUR e rodapés de página
    text = re.sub(r"(?im)^INFOJUR\s+N[Oo°º]\s*\d+[^\n]*\n?", "", text)
    text = re.sub(r"(?im)^Coordenadoria de Gest[aã]o Documental e Mem[oó]ria[^\n]*\n?", "", text)
    # Remove números de página isolados
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$\n?", "", text)
    # Remove contador "Documento N" do fim de cada decisão
    text = re.sub(r"\s*\bDocumento\s+\d+\b\s*", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalize(text: str) -> str:
    """Remove quebras de linha e espaços duplos."""
    return re.sub(r" {2,}", " ", re.sub(r"\s*\n\s*", " ", re.sub(r"-\s*\n\s*", "", text))).strip()


def extract_edition(filename: str) -> Optional[str]:
    m = EDITION_RE.search(filename)
    return m.group(1) if m else None


# ── Parsing principal ─────────────────────────────────────────────────────────

def extract_decisions(text: str, filename: str, ementas: dict | None = None) -> list[dict]:
    """
    Divide o texto do INFOJUR TRF2 em decisões individuais.

    Cada decisão começa com [TIPO] [NUMERO_CNJ] e termina antes do próximo
    cabeçalho. Entradas de referência (sem 'volta' + 'Decisão em') são ignoradas.
    """
    edition = extract_edition(filename)
    matches = list(HEADER_RE.finditer(text))
    decisions = []

    for i, m in enumerate(matches):
        block_start = m.start()
        block_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = clean_block(text[block_start:block_end])

        # Ignora citações de referência (não têm 'Decisão em' nem 'volta')
        header_chunk = block[:700]
        if not DATA_RE.search(header_chunk):
            continue
        if "volta" not in header_chunk.lower():
            continue

        processo = m.group(2)

        # Data de julgamento
        data_m = DATA_RE.search(header_chunk)
        data = parse_date(data_m.group(1)) if data_m else None

        # Relator e turma
        relator, turma = extract_relator_turma(header_chunk)

        # Ementa: preferir lookup no JSON de ementas buscadas do eproc
        ementa_from_json = (ementas or {}).get(processo, "")
        if ementa_from_json and not ementa_from_json.startswith("[ERRO"):
            ementa = ementa_from_json
        else:
            ementa_from_json = ""

        # Texto do corpo: extraído após 'volta' para conteudoIntegral e ementa fallback
        volta_pos = block.lower().find("volta")
        if volta_pos >= 0:
            after_volta = block[volta_pos + 5:]
            if not ementa_from_json:
                body_m = re.search(
                    r"(?m)^(?:[Cc]uida-se\s+de|[Tt]rata-se\s+de|[Nn]o\s+caso\s+dos\s+autos|"
                    r"[Ee]m\s+que\s+pese|[Vv]ersa\s+os\s+autos|[Aa]nalisando\s+os\s+autos)",
                    after_volta,
                )
                if body_m:
                    ementa_raw = after_volta[:body_m.start()].strip()
                else:
                    ementa_raw = after_volta.strip().split("\n")[0].strip()
                ementa = _normalize(ementa_raw)
            decision_text = _normalize(after_volta[:80_000])
        else:
            if not ementa_from_json:
                ementa = ""
            decision_text = _normalize(block[:80_000])

        # Descarta decisões muito curtas: editoriais, avisos processuais, resumos sem fundamentação
        if len(decision_text) < 500:
            continue

        # Ementa = texto completo para todos os casos sem JSON (garante conteúdo para busca)
        if not ementa_from_json:
            ementa = decision_text

        doc = {
            "_id": f"trf2-{processo}",
            "tribunal": "TRF2",
            "numero": processo,
            "ementa": ementa,
            "relator": relator,
            "dataJulgamento": data,
            "area": classify_area_from_ementa(ementa),
            "orgaoJulgador": turma,
            "url": f"https://www.trf2.jus.br/trf2/consultas-e-servicos/infojur-informativos-de-jurisprudencia-do-trf2",
            "conteudoIntegral": decision_text,
        }
        decisions.append(doc)

    return decisions


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set[str]:
    if CHECKPOINT_FILE.exists():
        try:
            return set(json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT_FILE.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2), encoding="utf-8")


# ── ES bulk insert ────────────────────────────────────────────────────────────

def bulk_insert(es: Elasticsearch, docs: list[dict], counters: dict) -> None:
    actions = [
        {"_index": ES_INDEX, "_id": d["_id"], **{k: v for k, v in d.items() if k != "_id"}}
        for d in docs
    ]
    try:
        ok, errors = helpers.bulk(es, actions, raise_on_error=False)
        counters["indexed"] += ok
        counters["es_errors"] += len(errors) if errors else 0
        if errors:
            for err in errors[:3]:
                log.warning(f"  ⚠️  ES erro: {err}")
    except Exception as e:
        log.error(f"❌ Bulk insert falhou: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingestão TRF2 INFOJUR → Elasticsearch")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER), help="Pasta com PDFs do TRF2")
    parser.add_argument("--batch", type=int, default=50, help="Docs por bulk insert")
    parser.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset", action="store_true", help="Remove checkpoint e reprocessa tudo")
    parser.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa no ES")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"❌ Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"❌ Nenhum PDF em: {folder}")

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("🗑️  Checkpoint removido")

    ementas: dict = {}
    if EMENTAS_FILE.exists():
        ementas = json.loads(EMENTAS_FILE.read_text(encoding="utf-8"))
        log.info(f"Ementas carregadas: {sum(1 for v in ementas.values() if v and not v.startswith('[ERRO'))}/{len(ementas)}")

    done = load_checkpoint()
    es = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0, "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TRF2 → ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    if args.dry_run:
        log.info("⚠️  DRY-RUN: não indexa no ES")
    else:
        log.info(f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for pdf_path in pdfs:
        fname = pdf_path.name

        if fname in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"📄 {fname}")
            text = pdf_to_text(str(pdf_path))
            decisions = extract_decisions(text, fname, ementas)
            counters["decisions"] += len(decisions)
            log.info(f"  → {len(decisions)} decisões extraídas")

            if args.dry_run:
                for d in decisions[:2]:
                    log.info(f"  [dry-run] {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
                    log.info(f"            ementa: {d['ementa'][:120]}")
            else:
                buffer.extend(decisions)
                if len(buffer) >= args.batch:
                    bulk_insert(es, buffer, counters)
                    buffer.clear()

            done.add(fname)
            save_checkpoint(done)
            counters["pdfs"] += 1

        except Exception as e:
            log.error(f"❌ {fname}: {e}")
            counters["failed"] += 1

    if not args.dry_run and buffer:
        bulk_insert(es, buffer, counters)

    log.info("=" * 60)
    log.info(f"Concluído: {counters['pdfs']} PDFs | {counters['decisions']} decisões")
    log.info(f"  Indexados  : {counters['indexed']}")
    log.info(f"  Pulados    : {counters['skipped']}")
    log.info(f"  Falhas PDF : {counters['failed']}")
    log.info(f"  Erros ES   : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
