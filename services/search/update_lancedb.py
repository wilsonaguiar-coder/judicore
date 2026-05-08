"""
Atualização incremental do LanceDB — adiciona acórdãos/informativos STF+STJ de 2026.

Executar no servidor (dentro do venv):
    cd /opt/judicore
    source services/search/venv/bin/activate
    python services/search/update_lancedb.py

Lê GEMINI_API_KEY de services/search/.env e abre o LanceDB em
/opt/judicore/lancedb_store (ou LANCE_DIR se configurado).

Flags opcionais (variáveis de ambiente):
    SINCE_DATE=2026-03-01   -- data de corte STF (padrão: 2026-01-01)
    YEAR=2026               -- ano de referência STJ (padrão: 2026)
    ONLY_STF=1              -- indexar apenas STF
    ONLY_STJ=1              -- indexar apenas STJ
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Carrega .env do diretório do serviço
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ[_k.strip()] = _v.strip()

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_KEY:
    sys.exit("GEMINI_API_KEY não encontrada. Configure services/search/.env")

from google import genai

gemini_client = genai.Client(api_key=GEMINI_KEY)

# project_root: diretório pai de lancedb_store
# Produção: /opt/judicore/services/search/update_lancedb.py → .parent.parent.parent = /opt/judicore
LANCE_DIR_ENV = os.getenv("LANCE_DIR", "")
if LANCE_DIR_ENV:
    project_root = Path(LANCE_DIR_ENV).parent
else:
    project_root = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(Path(__file__).parent))
from juris_update import run_jurisprudencia_incremental_update

since_date = os.getenv("SINCE_DATE", "2026-01-01")
year = int(os.getenv("YEAR", "2026"))
only_stf = os.getenv("ONLY_STF", "") == "1"
only_stj = os.getenv("ONLY_STJ", "") == "1"
include_stf = not only_stj
include_stj = not only_stf
# Chrome/Chromium executable para passar pelo AWS WAF do STF
# Ex: CHROME_PATH=/usr/bin/google-chrome
chrome_path = os.getenv("CHROME_PATH", "/usr/bin/google-chrome") or None

print("=" * 60)
print("LanceDB — Atualização Incremental STF/STJ")
print("=" * 60)
print(f"  project_root : {project_root}")
print(f"  lancedb_store: {project_root / 'lancedb_store'}")
print(f"  since_date   : {since_date}")
print(f"  year         : {year}")
print(f"  include_stf  : {include_stf}")
print(f"  include_stj  : {include_stj}")
print(f"  chrome_path  : {chrome_path}")
print()

result = run_jurisprudencia_incremental_update(
    project_root=project_root,
    gemini_client=gemini_client,
    year=year,
    stf_since_date=since_date,
    stf_visible_browser=False,
    chromium_executable_path=chrome_path,
    include_stf=include_stf,
    include_stj=include_stj,
)

print()
print("=" * 60)
print("RESULTADO")
print("=" * 60)
print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
