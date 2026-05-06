"""
Microserviço de busca jurisprudencial — wraper FastAPI sobre o motor RAG do Ratio.
Roda em /opt/judicore/services/search/ com PM2 ou systemd.
"""

import os
import sys
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Permite importar query.py do mesmo diretório
sys.path.insert(0, str(Path(__file__).parent))

# Aponta a base LanceDB para /opt/judicore/lancedb_store (configurável via env)
LANCE_STORE = os.getenv("LANCE_DIR", str(Path(__file__).parent.parent.parent / "lancedb_store"))
os.environ["RATIO_PROJECT_ROOT"] = str(Path(__file__).parent)
# Sobrescreve o LANCE_DIR antes de importar query.py
os.environ.setdefault("LANCE_DIR_OVERRIDE", LANCE_STORE)

import query as rag

# Patch: força o LANCE_DIR do query.py para o caminho configurado
rag.LANCE_DIR = Path(LANCE_STORE)

app = FastAPI(title="Judicore Search", version="1.0.0")

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
        # 1. Embeda a query com Gemini (mesmo modelo usado na ingestão)
        query_vector = rag.embed_query(req.query)

        # 2. Busca híbrida (vector + FTS) no LanceDB
        candidates = rag.search_lancedb(
            query=req.query,
            query_vector=query_vector,
            top_k=80,
            sources=req.sources,
            tribunais=req.tribunais,
            tipos=req.tipos,
            ramos=req.ramos,
            date_from=req.date_from,
            date_to=req.date_to,
        )

        # 3. Reranking: semântico + léxico + recência
        ranked = rag.rerank_results(
            query=req.query,
            results=candidates,
            top_k=req.top_k,
        )
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
            final_score=float(row.get("final_score") or 0.0),
            authority_level=auth_level,
            authority_label=auth_label,
            source_label=str(row.get("source_label") or ""),
        ))

    print(f"[search] query={req.query!r} candidates={len(candidates)} returned={len(results)} elapsed={elapsed:.2f}s")
    return results
