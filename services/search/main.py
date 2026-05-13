"""
Microserviço de busca jurisprudencial — wraper FastAPI sobre o motor RAG do Ratio.
Roda em /opt/judicore/services/search/ com PM2 ou systemd.
"""

import asyncio
import os
import re
import sys
import time
import threading
import urllib.request
import json as _json
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
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

def _log_usage_async(input_tokens: int):
    """Registra uso do Gemini na API Node em thread separada (fire-and-forget)."""
    def _post():
        try:
            payload = _json.dumps({
                "service": "gemini",
                "model": "text-embedding-004",
                "operation": "embed",
                "inputTokens": input_tokens,
                "outputTokens": 0,
            }).encode()
            req = urllib.request.Request(
                f"{_API_URL}/admin/usage/log",
                data=payload,
                headers={"Content-Type": "application/json", "x-internal-secret": _INTERNAL_SECRET},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=2)
        except Exception:
            pass
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


def _run_update_job(job_id: str, sources: list[str], since_date: str, year: int) -> None:
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
            chromium_executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome") or None,
            strict_completeness=False,
            progress_cb=on_progress,
        )
        job["status"] = "completed"
        job["result"] = result
        job["latest_dates"] = result.get("latest_dates", {})
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


# ── Endpoints de update/status ─────────────────────────────────────────────

@app.get("/index-info")
def index_info():
    """Retorna última data indexada por tribunal (nunca futura)."""
    return {
        "stf": _query_last_date("STF"),
        "stj": _query_last_date("STJ"),
    }


@app.post("/update")
def start_update(req: UpdateRequest):
    sources = [s.lower() for s in (req.sources or ["stf", "stj"]) if s.lower() in ("stf", "stj")]
    if not sources:
        raise HTTPException(status_code=400, detail="Informe ao menos uma fonte: stf, stj")

    year = req.year or date.today().year

    # since_date: explícito > auto-detect (capeado em hoje)
    if req.since_date:
        since_date = req.since_date
    else:
        # usa a menor data entre os tribunais selecionados para não perder nada
        dates = [_query_last_date(t.upper()) for t in sources]
        dates = [d for d in dates if d]
        since_date = min(dates) if dates else f"{year}-01-01"

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

    threading.Thread(target=_run_update_job, args=(job_id, sources, since_date, year), daemon=True).start()
    return {"job_id": job_id, "sources": sources, "since_date": since_date, "year": year}


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
        _log_usage_async(max(1, len(req.query.split())))
        candidates = _search_merged(req, query_vector)
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
