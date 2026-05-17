#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins de Jurisprudência do TJAC no Elasticsearch.

Dois formatos de PDF:
  camaras_*  — Câmaras Cíveis e Criminal  (cabeçalho espaçado, citação com ponto)
  tj_*       — Tribunal Pleno             (cabeçalho normal, citação com vírgula)

Pipeline por arquivo:
  1. Extrai texto do PDF (ignora páginas 100% espaçadas)
  2. Flatten: remove todas as quebras de linha → espaço único
  3. Remove cabeçalhos recorrentes (header_re)
  4. Divide em decisões via citation_re
  5. Descarta matéria introdutória do primeiro chunk

Uso:
    python tjac_ingest_es.py
    python tjac_ingest_es.py --dry-run
    python tjac_ingest_es.py --reset
    python tjac_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
from elasticsearch import Elasticsearch, helpers

# ── Caminhos ──────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
PDF_FOLDER   = PROJECT_ROOT / "temp" / "boletins" / "tjac"
CHECKPOINT   = SCRIPT_DIR / "tjac_ingest_checkpoint.json"
LOG_FILE     = SCRIPT_DIR / "tjac_ingest_es.log"
ES_INDEX     = "jurisprudencia"

# ── Regexes TJAC ──────────────────────────────────────────────────────────────

# Cabeçalho camaras_* após flatten (fonte espaçada pela extração do PDF)
# Cobre SEMEST RAL (semestral), MEN SAL (mensal), TRIM EST RAL (trimestral)
_HEADER_CAMARAS = re.compile(
    r"T RIBU N AL DE JU ST [IÍ][CÇ]A DO ACRE "
    r"EMEN T [AÁ]RIO DE JU RISPRU D[EÊ]N CIA "
    r"(?:SEMEST RAL|MEN SAL|TRIM EST RAL|AN UAL)"
    r"[^)]{5,80}?"
    r"CRIMIN AL "
    r"\d{1,3} "
    r"EMENT[AÁ]RIO N[°º][ ]*\d+"
    r"[^)]{5,60}?"
    r"20\d\d",
    re.IGNORECASE,
)

# Cabeçalho tj_* normal
_HEADER_TJ = re.compile(
    r"Ement[aá]rio\s+(?:Semestral|Trimestral|de\s+Jurisprud[eê]ncia)"
    r".*?(?:Acre|CRIMINAL|CÍVEL)\s+\d+/\d+",
    re.IGNORECASE,
)

# Citação no final de cada decisão (ambos os formatos)
# CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO  (J pode ser 1 ou 2 dígitos no TJAC)
CITATION_RE = re.compile(
    r"\("
    r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?"
    r"\s+n[.º°]?\s*"
    r"\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{3,4}"
    r"[^)]{0,500}?"
    r"(?:[Jj]ulgad[oa]|publicad[oa])\s+(?:em|no)\s+[^)]{3,80}"
    r"\)",
    re.DOTALL,
)

# Extração de campos da citação
CITATION_DETAIL_RE = re.compile(
    r"\((?P<tipo>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{0,30}?)"
    r"\s+n[.º°]?\s*"
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{3,4})"
    r"[^)]{0,150}?"
    r"[Rr]el\.?\S?\s*[Dd]es\.?\S?\s+"
    r"(?P<relator>[A-ZÀ-ÿ][^.,)]{3,60}?)(?=[,.])"
    r"[^)]{0,300}?"
    r"[Jj]ulgad[oa]\s+em\s+"
    r"(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})"
    r"[^)]{0,200}?\)",
    re.DOTALL,
)

# Padrão para título de seção (Mixed Case) antes de ementa em CAPS
_SECTION_RE = re.compile(
    r"(?<= )([A-Z][a-záéíóúàâêôãõç][^(]{5,100}?[a-záéíóúàâêôãõç])\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ]{6})",
)
_CIT_INDICATOR = re.compile(
    r"[Jj]ulgad[oa]\s+em|[Pp]ublicad[oa]\s+(?:em|no)", re.IGNORECASE
)

# ── Área do direito ────────────────────────────────────────────────────────────

_AREA_MAP: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL", re.compile(
        r"penal|criminal|crime\b|homic[íi]dio|roubo|latrocínio|peculato|"
        r"femini|lesão corporal|associação criminosa|habeas.corpus|"
        r"embriaguez|corrupção ativa|tráfico|estelionato|furto|"
        r"Câmara Criminal|Crimes de Trânsito|Estatuto do Idoso",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r|ipva|icms|ipi\b|imposto\b|execu[çc][aã]o fiscal|"
        r"cr[eé]dito tribut|contribui[çc][aã]o social|fgts\b",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor p[úu]blico|concurso p[úu]blico|licita[çc][aã]o|"
        r"improbidade|ato administrativo|cargo p[úu]blico|"
        r"gratifica[çc][aã]o|precatório|mandado de segurança",
        re.IGNORECASE,
    )),
    ("CONSTITUCIONAL", re.compile(
        r"adin\b|adpf\b|adc\b|ação direta de inconstitucionalidade|"
        r"inconstitucionalidade\s+(?:formal|material|da\s+lei|da\s+norma)|"
        r"controle de constitucionalidade|Direito Constitucional",
        re.IGNORECASE,
    )),
    ("CONSUMIDOR", re.compile(
        r"consumidor|energia el[eé]trica|fatura|plano de saúde|"
        r"cadastro de inadimplentes|serasa\b|negativação",
        re.IGNORECASE,
    )),
    ("FAMILIA", re.compile(
        r"fam[íi]lia|uni[aã]o est[aá]vel|div[oó]rcio|alimentos|"
        r"guarda\s+(?:de\s+)?(?:filho|criança|menor|compartilhad)|adoção|paternidade",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"\bcivil\b|indeniza[çc][aã]o|responsabilidade|contrato|"
        r"poss[ea]|usucapi|loca[çc][aã]o|obriga[çc][aã]o|"
        r"rescis[oó]ria|rescindenda|despejo|seguro\b",
        re.IGNORECASE,
    )),
]


def classify_area(text: str) -> str:
    for area, pat in _AREA_MAP:
        if pat.search(text):
            return area
    return "OUTRO"


# ── Extração de texto ──────────────────────────────────────────────────────────

def _is_spaced_page(text: str) -> bool:
    words = text.split()
    if not words:
        return False
    return sum(1 for w in words if len(w) == 1) / len(words) > 0.6


def _extract_pdf(path: Path) -> str:
    doc = fitz.open(str(path))
    pages = [p.get_text() for p in doc if not _is_spaced_page(p.get_text())]
    doc.close()
    return "\n".join(pages)


# ── Pipeline flatten + split ───────────────────────────────────────────────────

def _flatten(text: str) -> str:
    text = text.replace("\n", " ")
    text = re.sub(r" {2,}", " ", text)
    for hre in (_HEADER_CAMARAS, _HEADER_TJ):
        text = hre.sub(" ", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" \.", ".", text)
    return text.strip()


def _trim_front_matter(chunk: str) -> str:
    best_pos = None
    for m in _SECTION_RE.finditer(chunk):
        if _CIT_INDICATOR.search(chunk[m.start(): m.start() + 8000]):
            best_pos = m.start()
    return chunk[best_pos:] if best_pos is not None else chunk


def _split_decisions(text: str) -> list[str]:
    decisions: list[str] = []
    seen: set[str] = set()
    pos = 0
    for i, m in enumerate(CITATION_RE.finditer(text)):
        chunk = text[pos:m.end()].strip()
        if i == 0:
            chunk = _trim_front_matter(chunk)
        key = m.group().strip()[:120]
        if len(chunk) > 150 and key not in seen:
            decisions.append(chunk)
            seen.add(key)
        pos = m.end()
    return decisions


# Formato 2025 tj_*: metadados aparecem como cabeçalho antes do conteúdo
# Estrutura: TIPO PROCESSO ... Relator: Des. NAME Julgado em DATE Publicado no DJe...
_HEADER_2025_RE = re.compile(
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{3,4})"
    r".{0,500}?"
    r"Relator:\s+Des\.?[ªa]?\s+"
    r"(?P<relator>[A-ZÀ-ÿ][A-Za-zÀ-ÿ\s]{3,50}?)"
    r"Julgado\s+em\s+"
    r"(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})"
    r".{0,200}?"
    r"Publicado\s+no\s+DJe",
    re.DOTALL | re.IGNORECASE,
)

# Remove cabeçalho de página do ementário 2025
_PAGE_HDR_2025 = re.compile(
    r"Ement[aá]rio\s+Semestral\s+de\s+Jurisprud[eê]ncia\s*[–-]\s*"
    r"Tribunal\s+de\s+Justi[çc]a\s+do\s+Estado\s+do\s+Acre\s+\d+/\d+",
    re.IGNORECASE,
)


def _split_decisions_2025(text: str) -> list[str]:
    """Formato 2025: cabeçalho com processo+relator+data ANTES do conteúdo."""
    headers = list(_HEADER_2025_RE.finditer(text))
    if not headers:
        return []
    chunks = []
    for i, hm in enumerate(headers):
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        chunk = text[hm.start():end].strip()
        chunk = _PAGE_HDR_2025.sub(" ", chunk)
        chunk = re.sub(r" {2,}", " ", chunk)
        if len(chunk) > 200:
            chunks.append(chunk)
    return chunks


def _parse_decision_2025(chunk: str, filename: str) -> Optional[dict]:
    """Extrai campos de uma decisão no formato 2025 (cabeçalho)."""
    hm = _HEADER_2025_RE.search(chunk)
    if not hm:
        return None

    processo = hm.group("processo")
    relator  = hm.group("relator").strip()
    data     = _parse_date(hm.group("data"))

    # Tipo: palavra(s) antes do processo no cabeçalho
    pre = chunk[:hm.start("processo")].strip()
    tipo_m = re.search(r"([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40}?)$", pre)
    tipo = tipo_m.group(1).strip() if tipo_m else "AIT"

    # Ementa: conteúdo após o cabeçalho (remove header de página 2025)
    ementa = chunk[hm.end():].strip()
    # Prefere o bloco após a tag "EMENTA" se existir
    ementa_tag = re.search(r"\bEMENTA\b", ementa)
    if ementa_tag:
        ementa = ementa[ementa_tag.end():].strip()

    section = _extract_section(ementa)
    area    = classify_area(section + " " + ementa[:300])

    return {
        "_id":            f"tjac-{processo}",
        "tribunal":       "TJAC",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  "Tribunal Pleno",
        "dataJulgamento": data,
        "area":           area,
        "secao":          section,
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


# ── Parse de campos ────────────────────────────────────────────────────────────

def _parse_date(raw: str) -> Optional[str]:
    raw = raw.strip()
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(20\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"(\d{2})/(\d{2})/(20\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    m = re.search(r"(20\d{2})", raw)
    return f"{m.group(1)}-01-01" if m else None


def _extract_section(chunk: str) -> str:
    m = re.match(
        r"^([A-Z][a-záéíóúàâêôãõç][a-záéíóúàâêôãõçüA-Z /\-º°]{4,99}?)\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ]{4})",
        chunk.strip(),
    )
    return m.group(1).strip() if m else ""


def _parse_decision(chunk: str, filename: str) -> Optional[dict]:
    m = CITATION_DETAIL_RE.search(chunk)
    if not m:
        return None

    tipo     = m.group("tipo").strip()
    processo = m.group("processo")
    relator  = m.group("relator").strip()
    data     = _parse_date(m.group("data"))

    if "TPJUD" in chunk or "TPADM" in chunk:
        orgao = "Tribunal Pleno"
    else:
        om = re.search(r"\d[ªº]\s*Câmara\s+(?:Cível|Criminal)|Câmara\s+Criminal", chunk)
        orgao = om.group(0).strip() if om else ""

    section = _extract_section(chunk)
    area    = classify_area(section + " " + chunk[:300])
    ementa  = chunk[:m.start()].strip()

    return {
        "_id":            f"tjac-{processo}",
        "tribunal":       "TJAC",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          section,
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def process_file(path: Path) -> list[dict]:
    raw  = _extract_pdf(path)
    flat = _flatten(raw)

    chunks = _split_decisions(flat)
    if chunks:
        parse_fn = _parse_decision
    else:
        chunks   = _split_decisions_2025(flat)
        parse_fn = _parse_decision_2025  # type: ignore[assignment]

    docs = []
    seen: set[str] = set()
    for chunk in chunks:
        doc = parse_fn(chunk, path.name)
        if doc and doc["_id"] not in seen:
            docs.append(doc)
            seen.add(doc["_id"])
    return docs


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set:
    if not CHECKPOINT.exists():
        return set()
    try:
        return set(json.loads(CHECKPOINT.read_text(encoding="utf-8")).get("done", []))
    except Exception:
        return set()


def save_checkpoint(done: set) -> None:
    CHECKPOINT.write_text(
        json.dumps({"done": list(done)}, ensure_ascii=False),
        encoding="utf-8",
    )


# ── ES Bulk ───────────────────────────────────────────────────────────────────

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
                log.warning(f"  ES erro: {err}")
    except Exception as e:
        log.error(f"Bulk insert falhou: {e}")


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
    ap = argparse.ArgumentParser(description="Ingestão TJAC boletins → Elasticsearch")
    ap.add_argument("--folder",  default=str(PDF_FOLDER))
    ap.add_argument("--batch",   type=int, default=50)
    ap.add_argument("--es-url",  default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF em: {folder}")

    if args.reset and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es   = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0,
                "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TJAC -> ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    log.info("DRY-RUN: não indexa no ES" if args.dry_run else f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for pdf in pdfs:
        if pdf.name in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"{pdf.name}")
            docs = process_file(pdf)
            log.info(f"  -> {len(docs)} decisoes")

            if not docs:
                log.warning(f"  AVISO: 0 decisoes em {pdf.name}")

            counters["decisions"] += len(docs)

            if args.dry_run:
                for d in docs[:2]:
                    log.info(f"  [dry] {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
                    log.info(f"        ementa: {d['ementa'][:200]}")
            else:
                buffer.extend(docs)
                if len(buffer) >= args.batch:
                    bulk_insert(es, buffer, counters)
                    buffer.clear()

            done.add(pdf.name)
            save_checkpoint(done)
            counters["pdfs"] += 1

        except Exception as e:
            log.error(f"{pdf.name}: {e}")
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
