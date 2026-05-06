"""
Microserviço de busca jurisprudencial — wraper FastAPI sobre o motor RAG do Ratio.
Roda em /opt/judicore/services/search/ com PM2 ou systemd.
"""

import asyncio
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

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
