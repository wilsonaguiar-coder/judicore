"""
Microserviço de busca jurisprudencial — wraper FastAPI sobre o motor RAG do Ratio.
Roda em /opt/judicore/services/search/ com PM2 ou systemd.
"""

import asyncio
import os
import re
import sqlite3
import sys
import time
import threading
import urllib.request
import json as _json
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Permite importar query.py do mesmo diretório
sys.path.insert(0, str(Path(__file__).parent))

# Lê o .env manualmente — load_dotenv não funciona em alguns contextos PM2
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ[_k.strip()] = _v.strip()

# Aponta a base LanceDB para /opt/judicore/lancedb_store (configurável via env)
LANCE_STORE = os.getenv("LANCE_DIR", str(Path(__file__).parent.parent.parent / "lancedb_store"))
os.environ["RATIO_PROJECT_ROOT"] = str(Path(__file__).parent)

import query as rag

# Patch: força variáveis que o query.py lê no nível de módulo
rag.LANCE_DIR = Path(LANCE_STORE)
rag.GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
rag._CLIENT = None  # força recriar o client com a chave correta


# Por padrão o Ratio só busca "ratio" (STF/STJ). Incluímos "tjsp" explicitamente.
_DEFAULT_SOURCES = ["ratio", "tjsp"]


def _search_merged(req: "SearchRequest", query_vector: list) -> list:
    """Quando múltiplos tribunais são selecionados, busca cada um separadamente
    para garantir representação de todos, depois ordena por _rrf_score."""
    sources = req.sources or _DEFAULT_SOURCES
    tribunais = req.tribunais or []
    if len(tribunais) <= 1:
        return rag.search_lancedb(
            query=req.query,
            query_vector=query_vector,
            top_k=req.top_k,
            sources=sources,
            tribunais=tribunais or None,
            tipos=req.tipos,
            ramos=req.ramos,
            date_from=req.date_from,
            date_to=req.date_to,
        )

    per_trib = max(3, -(-req.top_k // len(tribunais)))  # ceil division
    seen: set[str] = set()
    merged: list = []
    for trib in tribunais:
        rows = rag.search_lancedb(
            query=req.query,
            query_vector=query_vector,
            top_k=per_trib,
            sources=sources,
            tribunais=[trib],
            tipos=req.tipos,
            ramos=req.ramos,
            date_from=req.date_from,
            date_to=req.date_to,
        )
        for row in rows:
            doc_id = str(row.get("doc_id") or id(row))
            if doc_id not in seen:
                seen.add(doc_id)
                merged.append(row)
    merged.sort(key=lambda x: float(x.get("_rrf_score") or x.get("score") or 0.0), reverse=True)
    return merged


_API_URL = os.getenv("API_URL", "http://127.0.0.1:3001")
_INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", os.getenv("JWT_SECRET", ""))

def _log_usage_async(input_tokens: int, model: str = "text-embedding-004", operation: str = "embed"):
    """Registra uso do Gemini na API Node em thread separada (fire-and-forget)."""
    def _post():
        try:
            payload = _json.dumps({
                "service": "gemini",
                "model": model,
                "operation": operation,
                "inputTokens": input_tokens,
                "outputTokens": 0,
            }).encode()
            req = urllib.request.Request(
                f"{_API_URL}/admin/usage/log",
                data=payload,
                headers={"Content-Type": "application/json", "x-internal-secret": _INTERNAL_SECRET},
                method="POST",
            )
            resp = urllib.request.urlopen(req, timeout=3)
            if resp.status not in (200, 201):
                print(f"[usage] aviso: status inesperado {resp.status} ao registrar uso Gemini")
        except Exception as exc:
            print(f"[usage] erro ao registrar uso Gemini (API_URL={_API_URL}): {exc}")
    threading.Thread(target=_post, daemon=True).start()


def _warmup_sync():
    try:
        vec = rag.embed_query("jurisprudência")
        rag.search_lancedb(query="jurisprudência", query_vector=vec, top_k=1)
        print("[startup] warmup LanceDB concluído")
    except Exception as exc:
        print(f"[startup] warmup falhou (não crítico): {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _warmup_sync)
    yield


app = FastAPI(title="Judicore Search", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    tribunais: Optional[list[str]] = None
    tipos: Optional[list[str]] = None
    ramos: Optional[list[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    top_k: int = 11
    sources: Optional[list[str]] = None  # ["ratio", "tjsp"] ou None = todos


class SearchResult(BaseModel):
    doc_id: str
    tribunal: str
    tipo: str
    processo: str
    relator: str
    orgao_julgador: str
    data_julgamento: str
    ementa: str
    texto_integral: Optional[str]
    inteiro_teor_url: Optional[str]
    final_score: float
    authority_level: str
    authority_label: str
    source_label: str


_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# ── Cursor persistente ─────────────────────────────────────────────────────
# Salva em <LANCE_DIR>/.update_cursor.json → {"stf": "2026-05-10", "stj": "..."}
_CURSOR_FILE = Path(LANCE_STORE) / ".update_cursor.json"


def _read_cursor() -> dict:
    try:
        if _CURSOR_FILE.exists():
            return _json.loads(_CURSOR_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def _write_cursor(updates: dict) -> None:
    try:
        current = _read_cursor()
        current.update(updates)
        _CURSOR_FILE.write_text(_json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[cursor] erro ao salvar: {e}")


# ── Job store (in-memory) ──────────────────────────────────────────────────
_jobs: dict[str, dict[str, Any]] = {}


def _parse_date_flexible(s: str) -> datetime | None:
    s = str(s or "").strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try: return datetime(int(m[1]), int(m[2]), int(m[3]))
        except: pass
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        try: return datetime(int(m[3]), int(m[2]), int(m[1]))
        except: pass
    return None


def _query_lancedb_total() -> int:
    """Retorna o total de documentos na tabela LanceDB jurisprudencia."""
    try:
        import lancedb
        db = lancedb.connect(str(rag.LANCE_DIR))
        tbl = db.open_table("jurisprudencia")
        return int(tbl.count_rows())
    except Exception:
        return 0


def _query_last_date(tribunal: str) -> str:
    """Retorna a última data de julgamento indexada para o tribunal, nunca futura."""
    try:
        import lancedb
        db = lancedb.connect(str(rag.LANCE_DIR))
        tbl = db.open_table("jurisprudencia")
        rows = (
            tbl.search()
               .where(f"tribunal = '{tribunal}'")
               .select(["data_julgamento"])
               .limit(5_000_000)
               .to_list()
        )
        today = datetime.combine(date.today(), datetime.min.time())
        dates = [
            d for r in rows
            if (d := _parse_date_flexible(r.get("data_julgamento", ""))) and d <= today
        ]
        return max(dates).strftime("%Y-%m-%d") if dates else ""
    except Exception:
        return ""


def _stj_docs_dir() -> Path:
    internal = _PROJECT_ROOT / "_internal"
    data_base = internal / "data" if (internal / "data").is_dir() else _PROJECT_ROOT / "data"
    return data_base / "stj_informativos" / "docs"


def _stj_db_path() -> Path:
    internal = _PROJECT_ROOT / "_internal"
    data_base = internal / "data" if (internal / "data").is_dir() else _PROJECT_ROOT / "data"
    return data_base / "stj_informativos" / "stj_informativos.db"


def _query_stj_last_edition() -> int | None:
    """Retorna o maior número de informativo STJ já processado no SQLite."""
    db = _stj_db_path()
    if not db.exists():
        return None
    try:
        conn = sqlite3.connect(str(db))
        row = conn.execute(
            "SELECT MAX(CAST(informativo_numero AS INTEGER)) FROM stj_informativos"
        ).fetchone()
        conn.close()
        return int(row[0]) if row and row[0] is not None else None
    except Exception:
        return None


def _query_stj_pdf_editions() -> list[int]:
    """Lista os números de edição disponíveis como PDF em disco."""
    docs = _stj_docs_dir()
    if not docs.exists():
        return []
    editions = []
    for p in docs.glob("Informativo_*.pdf"):
        m = re.search(r"Informativo_(\d+)\.pdf", p.name)
        if m:
            editions.append(int(m.group(1)))
    return sorted(editions)


def _run_update_job(job_id: str, sources: list[str], since_date: str, year: int, skip_browser: bool = False) -> None:
    job = _jobs[job_id]
    job["status"] = "running"
    job["started_at"] = datetime.now().isoformat()
    job["progress"] = []

    def on_progress(stage: str, message: str, fields: dict) -> None:
        job["progress"].append({"stage": stage, "message": message, **fields})

    try:
        from google import genai as _genai
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        gemini_client = _genai.Client(api_key=gemini_key)

        from juris_update import run_jurisprudencia_incremental_update
        result = run_jurisprudencia_incremental_update(
            project_root=_PROJECT_ROOT,
            gemini_client=gemini_client,
            year=year,
            include_stf="stf" in sources,
            include_stj="stj" in sources,
            stf_since_date=since_date,
            stf_visible_browser=False,
            chromium_executable_path=None if skip_browser else (os.environ.get("CHROME_PATH", "/usr/bin/google-chrome") or None),
            strict_completeness=False,
            progress_cb=on_progress,
        )
        job["status"] = "completed"
        job["result"] = result
        # Cap latest_dates at today — evita datas futuras de docs com data errada
        today = date.today()
        raw_latest = result.get("latest_dates", {})
        capped: dict = {}
        for trib, ds in raw_latest.items():
            d = _parse_date_flexible(str(ds or ""))
            if d:
                capped[trib] = min(d.date(), today).strftime("%Y-%m-%d")
        job["latest_dates"] = capped
        # Cursor: próxima atualização começa 3 dias antes de hoje
        cursor_date = (today - timedelta(days=3)).strftime("%Y-%m-%d")
        _write_cursor({s: cursor_date for s in sources})
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        job["finished_at"] = datetime.now().isoformat()


# ── Models ─────────────────────────────────────────────────────────────────

class UpdateRequest(BaseModel):
    sources: list[str] = ["stf", "stj"]
    since_date: Optional[str] = None  # YYYY-MM-DD; None = auto-detect
    year: Optional[int] = None         # default: ano corrente
    skip_browser: bool = False         # True = não abre Chrome (STJ só usa PDFs em disco)


# ── Endpoints de update/status ─────────────────────────────────────────────

@app.get("/index-info")
def index_info():
    """Retorna última data indexada e cursor de próxima atualização por tribunal."""
    cursor = _read_cursor()
    return {
        "stf": _query_last_date("STF"),
        "stj": _query_last_date("STJ"),
        "next_since": {
            "stf": cursor.get("stf", ""),
            "stj": cursor.get("stj", ""),
        },
        "stj_last_edition": _query_stj_last_edition(),
        "stj_pdf_editions": _query_stj_pdf_editions(),
        "total": _query_lancedb_total(),
    }


@app.post("/stj/upload")
async def stj_upload_pdfs(files: list[UploadFile] = File(...)):
    """Recebe PDFs de informativos STJ e salva em disco para indexação posterior."""
    docs_dir = _stj_docs_dir()
    docs_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    skipped = []
    errors = []

    for upload in files:
        name = upload.filename or ""
        m = re.search(r"(\d{3,5})", name)
        if not m:
            errors.append({"file": name, "reason": "Nome não contém número de edição"})
            continue

        edition = int(m.group(1))
        dest = docs_dir / f"Informativo_{edition:04d}.pdf"
        try:
            content = await upload.read()
            if content[:4] != b"%PDF":
                errors.append({"file": name, "reason": "Arquivo não é um PDF válido"})
                continue
            dest.write_bytes(content)
            saved.append(edition)
        except Exception as exc:
            errors.append({"file": name, "reason": str(exc)})

    return {
        "saved": sorted(saved),
        "skipped": skipped,
        "errors": errors,
        "pdf_editions_on_disk": _query_stj_pdf_editions(),
    }


@app.post("/update")
def start_update(req: UpdateRequest):
    sources = [s.lower() for s in (req.sources or ["stf", "stj"]) if s.lower() in ("stf", "stj")]
    if not sources:
        raise HTTPException(status_code=400, detail="Informe ao menos uma fonte: stf, stj")

    year = req.year or date.today().year

    # since_date: usa o que o usuário informou, ou cursor persistido, ou vazio
    # (vazio → juris_update.py usa 1º de janeiro do ano corrente)
    if req.since_date:
        since_date = req.since_date
    else:
        cursor = _read_cursor()
        since_date = next((cursor[s] for s in sources if cursor.get(s)), "")

    skip_browser = req.skip_browser

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "id": job_id,
        "sources": sources,
        "since_date": since_date,
        "year": year,
        "status": "pending",
        "progress": [],
        "result": None,
        "latest_dates": {},
        "error": None,
        "started_at": None,
        "finished_at": None,
    }

    threading.Thread(target=_run_update_job, args=(job_id, sources, since_date, year, skip_browser), daemon=True).start()
    return {"id": job_id, "sources": sources, "since_date": since_date, "year": year, "status": "pending"}


@app.get("/update/{job_id}")
def get_update_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    # retorna sem o histórico completo de progresso para não sobrecarregar
    last_progress = job["progress"][-1] if job["progress"] else None
    return {
        "id": job["id"],
        "sources": job["sources"],
        "since_date": job["since_date"],
        "year": job["year"],
        "status": job["status"],
        "last_progress": last_progress,
        "progress_count": len(job["progress"]),
        "latest_dates": job["latest_dates"],
        "error": job["error"],
        "started_at": job["started_at"],
        "finished_at": job["finished_at"],
    }


@app.get("/health")
def health():
    return {"status": "ok", "lance_dir": str(rag.LANCE_DIR)}


@app.post("/search", response_model=list[SearchResult])
def search(req: SearchRequest):
    if len(req.query.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query muito curta (mínimo 3 caracteres)")

    t0 = time.perf_counter()

    try:
        query_vector = rag.embed_query(req.query)
        # Estimativa de tokens: ~4 chars por token (aprox GPT/Gemini)
        estimated_tokens = max(1, len(req.query) // 4)
        _log_usage_async(estimated_tokens)
        candidates = _search_merged(req, query_vector)
        if req.date_from:
            cutoff = _parse_date_flexible(req.date_from)
            if cutoff:
                candidates = [
                    r for r in candidates
                    if (d := _parse_date_flexible(str(r.get("data_julgamento") or ""))) is not None and d >= cutoff
                ]
        ranked = candidates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    elapsed = time.perf_counter() - t0

    results = []
    for row in ranked:
        auth_score, auth_level, auth_label = rag.classify_authority(row)
        results.append(SearchResult(
            doc_id=str(row.get("doc_id") or ""),
            tribunal=str(row.get("tribunal") or ""),
            tipo=str(row.get("tipo") or ""),
            processo=str(row.get("processo") or ""),
            relator=str(row.get("relator") or ""),
            orgao_julgador=str(row.get("orgao_julgador") or ""),
            data_julgamento=str(row.get("data_julgamento") or ""),
            ementa=str(row.get("texto_busca") or "")[:500],
            texto_integral=str(row.get("texto_integral") or "") or None,
            inteiro_teor_url=str(row.get("inteiro_teor_url") or "") or None,
            final_score=float(row.get("final_score") or row.get("_rrf_score") or row.get("score") or 0.0),
            authority_level=auth_level,
            authority_label=auth_label,
            source_label=str(row.get("source_label") or ""),
        ))

    print(f"[search] query={req.query!r} candidates={len(candidates)} returned={len(results)} elapsed={elapsed:.2f}s")
    return results
