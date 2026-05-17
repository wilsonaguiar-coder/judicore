#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera TXT de preview com as primeiras N decisões extraídas dos PDFs/HTMLs de um tribunal.
Usado para validar extração antes de indexar no Elasticsearch.

Pipeline por arquivo:
  1. Extrai texto bruto do PDF/HTML
  2. Flatten: remove TODAS as quebras de linha → espaço único
  3. Remove cabeçalhos/rodapés recorrentes (header_re por tribunal)
  4. Divide em decisões via citation_re
  5. No primeiro chunk, descarta matéria introdutória

Uso:
    python preview_boletins.py --tribunal tjac
    python preview_boletins.py --tribunal tjac --fields          # mostra campos ES
    python preview_boletins.py --tribunal tjac --n 20 --output preview_tjac.txt
"""

import argparse
import io
import re
import sys
from pathlib import Path
from typing import Optional

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
DEFAULT_INPUT = PROJECT_ROOT / "temp" / "boletins"

# ── Configuração por tribunal ──────────────────────────────────────────────────

_TJBA_PROC_RE  = r'\d{7,9}(?:-\d{2})?\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}'
_TJCE_PROC_RE  = r'\d{7,8}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}'
_TJDFT_PROC_RE = r'(?:\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{20})'

TRIBUNAL_CFG: dict[str, dict] = {
    "tjce": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "citation_at_start": True,
        "header_re": [],
        # Split: detecta início de cada decisão (Processo nº ou Mandado de Segurança nº)
        "citation_re": re.compile(
            r'(?:Mandado\s+de\s+Seguran[çc]a(?:\s+Preventivo)?|Processo)\s+'
            r'n[oº°]?:?\s+' + _TJCE_PROC_RE,
            re.IGNORECASE,
        ),
        # Formato 2026: campos rotulados com dois-pontos, "data do julgamento:"
        "detail_v3": re.compile(
            r'Processo\s+n[oº°]?:\s+'
            r'(?P<processo>' + _TJCE_PROC_RE + r')'
            r';\s*(?:[Óo]rg[aã]o\s+julgador:\s*)?'
            r'(?P<orgao>[^;]+?)\s*;\s*'
            r'[Rr]elator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
            r'(?P<relator>[^;,\n]+?)\s*[;,]\s*'
            r'data\s+do\s+julgamento:\s*'
            r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
            re.IGNORECASE,
        ),
        # Formato 2025/2024 com ponto-e-vírgula e "julgado em"
        "detail_v2": re.compile(
            r'Processo\s+n[oº°]\s+'
            r'(?P<processo>' + _TJCE_PROC_RE + r')'
            r';\s*(?P<orgao>[^;]+?)\s*;\s*'
            r'[Rr]elator(?:a)?\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
            r'(?P<relator>[^,;\n]+?)'
            r'[,;]\s*(?:por\s+unanimidade[,;\s]+)?'
            r'julgado\s+em\s+'
            r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
            re.IGNORECASE,
        ),
        # Formato 2024 antigo: tipo em parênteses, vírgulas
        "detail_v1": re.compile(
            r'Processo\s+n[oº°]\s+'
            r'(?P<processo>' + _TJCE_PROC_RE + r')'
            r'\s*\((?P<tipo>[^)]{3,60})\)\s*,\s*'
            r'(?P<orgao>[^,]+?)\s*,\s*'
            r'[Rr]elator(?:a)?\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
            r'(?P<relator>[^,;\n]+?)'
            r'[,;]\s*(?:por\s+unanimidade[,;\s]+)?'
            r'(?:julgado\s+em|data\s+de\s+julgamento)\s+'
            r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
            re.IGNORECASE,
        ),
        # Mandado de Segurança (sem câmara, sem tipo em parênteses)
        "detail_v0": re.compile(
            r'(?P<label>Mandado\s+de\s+Seguran[çc]a(?:\s+Preventivo)?)\s+n[oº°]\s+'
            r'(?P<processo>' + _TJCE_PROC_RE + r')'
            r'[;,]\s*'
            r'(?:(?P<orgao>[^;,]+?)[;,]\s*)?'
            r'[Rr]elator\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
            r'(?P<relator>[^,;\n]+?)'
            r'[,;]\s*(?:data\s+de\s+julgamento|julgado\s+em)\s+'
            r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
            re.IGNORECASE,
        ),
        "tribunal": "TJCE",
        "area_default": "ESTADUAL",
        "file_patterns": {"informativo": "informativo_*.pdf"},
        "parse_fn": "tjce",
    },
    "tjba": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "citation_at_start": True,
        "header_re": [
            re.compile(
                r'\d{1,3}\s+(?:BAHIA FORENSE ELETRÔNICA'
                r'|REVISTA BAHIA FORENSE(?:\s*-\s*Nº\s*\d+)?)\s*',
            ),
        ],
        # Split regex: lenient – just detects decision boundaries
        "citation_re": re.compile(
            r'\(TJBA\s*[-–]\s*'
            r'[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?'
            r'\s+[Nn][.º°]+\s*' + _TJBA_PROC_RE +
            r'[^)]{0,500}?[Jj]ulgad[oa][^)]{1,80}\)',
            re.DOTALL,
        ),
        # Detail regex: extracts fields (orgão before relator)
        "citation_detail_re": re.compile(
            r'\(TJBA\s*[-–]\s*'
            r'(?P<tipo>[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?)'
            r'\s+n[.º°]+\s*'
            r'(?P<processo>' + _TJBA_PROC_RE + r')'
            r'[.,]?\s*'
            r'(?P<orgao>[^.]{3,100}?)'
            r'[.,]?\s*relator(?:\([aA]\))?a?:?\s*(?:des[aª]?\.?\s*)?'
            r'(?P<relator>[^,.\n)]{3,70}?)[,.]'
            r'\s*julgad[oa][^)]{0,20}?'
            r'(?P<data_julgamento>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2}|(?:19|20)\d{2})'
            r'[^)]{0,40}?\)',
            re.DOTALL | re.IGNORECASE,
        ),
        # Fallback: relator before orgão (some 2020 decisions)
        "citation_detail_re_v2": re.compile(
            r'\(TJBA\s*[-–]\s*'
            r'(?P<tipo>[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?)'
            r'\s+n[.º°]+\s*'
            r'(?P<processo>' + _TJBA_PROC_RE + r')'
            r'[.,]\s*'
            r'relator(?:\([aA]\))?a?:?\s*(?:des[aª]?\.?\s*)?'
            r'(?P<relator>[^,.\n)]{3,70}?),'
            r'\s*(?P<orgao>[^,)]{3,100}?),'
            r'\s*julgad[oa][^)]{0,20}?'
            r'(?P<data_julgamento>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2}|(?:19|20)\d{2})'
            r'[^)]{0,40}?\)',
            re.DOTALL | re.IGNORECASE,
        ),
        "tribunal": "TJBA",
        "area_default": "ESTADUAL",
        "file_patterns": {"revista": "revista_*.pdf"},
        "parse_fn": "tjba",
    },
    "tjac": {
        "spaced_text": True,
        "header_re": [
            # camaras_*: "T RIBU N AL DE JU ST IÇA DO ACRE EMEN T ÁRIO ... CRIMIN AL 10 EMENTÁRIO N° 1..."
            re.compile(
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
            ),
            # tj_*: "Ementário Trimestral de Jurisprudência - Tribunal de Justiça do Acre 8/77"
            re.compile(
                r"Ement[aá]rio\s+(?:Semestral|Trimestral|de\s+Jurisprud[eê]ncia)"
                r".*?(?:Acre|CRIMINAL|CÍVEL)\s+\d+/\d+",
                re.IGNORECASE,
            ),
        ],
        # CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO (J pode ter 1 ou 2 dígitos em processos TJAC)
        "citation_re": re.compile(
            r"\("
            r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?"
            r"\s+n[.º°]?\s*"
            r"\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{3,4}"
            r"[^)]{0,500}?"
            r"(?:[Jj]ulgad[oa]|publicad[oa])\s+(?:em|no)\s+[^)]{3,80}"
            r"\)",
            re.DOTALL,
        ),
        # Regex para extrair campos da citação (usada no modo --fields)
        # Cobre dois formatos:
        #   camaras: (AI n° PROC, Rel.ª Des.ª NAME. ORGAO. Julgado em D.M.YYYY...)
        #   tj_:     (ADin nº PROC, Rel. Des. NAME, Acórdão nº N-TPJUD, julgado em D.M.YYYY...)
        "citation_detail_re": re.compile(
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
        ),
        "tribunal": "TJAC",
        "area_default": "ESTADUAL",
        # Arquivos por tipo (para --fields pegar ambos os estilos)
        "file_patterns": {
            "camaras": "camaras_*.pdf",
            "tj_pleno": "tj_*.pdf",
        },
    },
    "tjdft": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "citation_at_start": False,
        "skip_trim": True,
        "header_re": [
            # Cabeçalho 2024/2025: "Informativo de Jurisprudência: NNª Edição especial... NN"
            re.compile(
                r'Informativo\s+de\s+Jurisprud[eê]ncia\s*[:|–\|].{5,150}\s\d{1,2}(?=\s)',
                re.IGNORECASE,
            ),
            # Cabeçalho 2020-2023: "Informativo de Jurisprudência do TJDFT Edição especial – Xº semestre de YYYY"
            re.compile(
                r'Informativo\s+de\s+Jurisprud[eê]ncia\s+do\s+TJDFT\s+'
                r'Edi[çc][aã]o\s+especial\s*[–-]\s*\S{1,10}\s+semestre\s+de\s+20\d{2}\s*\d*\s*',
                re.IGNORECASE,
            ),
            # Cabeçalho curto 2024 s1 em páginas subsequentes: "NNª Edição especial – ... NN"
            re.compile(
                r'\d+[ª°]\s+Edi[çc][aã]o\s+especial\s*[–-].{5,80}\s\d{1,2}(?=\s)',
                re.IGNORECASE,
            ),
            # Cabeçalho curto 2024/2025 retro em páginas subsequentes: "Edição Especial – Retrospectiva YYYY NN"
            re.compile(
                r'Edi[çc][aã]o\s+[Ee]special\s*[-–]\s*Retrospectiva\s+20\d{2}\s*\d{1,2}(?=\s)',
                re.IGNORECASE,
            ),
            # Corpo editorial: de "Tribunal de Justiça..." ou "Edição Especial" até o disclaimer final
            re.compile(
                r'(?:Tribunal\s+de\s+Justi[çc]a\s+do\s+Distrito\s+Federal|'
                r'Edi[çc][aã]o\s+[Ee]special\s*[-–]|'
                r'\d+[ª°]\s+Edi[çc][aã]o\s+especial)'
                r'.{50,10000}?'
                r'n[aã]o\s+constitu[ei]m\b.{5,200}?'
                r'reposit[oó]rio\s+oficial\s+da\s+jurisprud[eê]ncia\s+\S{2,10}\s+[Tt]ribunal\.?\s*',
                re.IGNORECASE,
            ),
            # Entradas de sumário/índice: texto seguido de pontos e número de página
            re.compile(r'\.{4,}\s*\d{1,3}\s*'),
            # Subheadings retro: "1-Getúlio de Moraes Oliveira (Inf. 511)"
            re.compile(
                r'\d+\s*-\s*[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ\s]+\(Inf\.\s*\d+\)',
            ),
        ],
        "citation_re": re.compile(
            r'Ac[oó]rd[aã]o\s+\d+,\s+'
            + _TJDFT_PROC_RE +
            r',\s+'
            r'Relator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Ju[ií]z[ao]?\s+)?(?:Des[.ªa]*\s+)?'
            r'[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][^,]+,'
            r'[^,]+,'
            r'\s*data\s+de\s+julgamento:\s*\d{1,2}[º°]?/\d{1,2}/\d{4},'
            r'\s*publicado\s+no\s+(?:DJe|PJe):\s*\d{1,2}[º°]?/\d{1,2}/\d{4}\.?'
            r'(?:\s*\(?[Ii]nformativo\s+\d+\)?)?',
            re.IGNORECASE,
        ),
        "detail_re": re.compile(
            r'Ac[oó]rd[aã]o\s+(?P<acordao>\d+),\s+'
            r'(?P<processo>' + _TJDFT_PROC_RE + r'),\s+'
            r'Relator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Ju[ií]z[ao]?\s+)?(?:Des[.ªa]*\s+)?'
            r'(?P<relator>[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][^,]+),'
            r'\s*(?P<orgao>[^,]+),'
            r'\s*data\s+de\s+julgamento:\s*'
            r'(?P<data>\d{1,2}[º°]?/\d{1,2}/\d{4}),'
            r'\s*publicado\s+no\s+(?:DJe|PJe):\s*\d{1,2}[º°]?/\d{1,2}/\d{4}\.?'
            r'(?:\s*\(?[Ii]nformativo\s+(?P<informativo>\d+)\)?)?',
            re.IGNORECASE,
        ),
        "tribunal": "TJDFT",
        "area_default": "ESTADUAL",
        "file_patterns": {"informativo": "edicao_*.pdf"},
        "parse_fn": "tjdft",
    },
}

# ── Área do direito ────────────────────────────────────────────────────────────

_AREA_MAP: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL", re.compile(
        r"penal|criminal|crime\b|homic[íi]dio|roubo|latrocínio|peculato|"
        r"femini|lesão corporal|associação criminosa|habeas.corpus|"
        r"embriaguez|corrupção ativa|tráfico|estelionato|furto|"
        r"Câmara Criminal|Crimes de Trânsito|Crimes Previstos|Estatuto do Idoso",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r|ipva|icms|ipi\b|imposto\b|execu[çc][aã]o fiscal|"
        r"cr[eé]dito tribut|contribui[çc][aã]o social|fgts\b",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\w*\s+p[úu]blico|concurso p[úu]blico|licita[çc][aã]o|"
        r"improbidade|ato administrativo|cargo p[úu]blico|"
        r"gratifica[çc][aã]o|precatório|mandado de segurança|"
        r"teto remuneratório|incidente de resolução de demandas",
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
        r"guarda\s+(?:de\s+)?(?:filho|criança|menor|compartilhad)|paternidade|"
        r"adoção\s+(?:de\s+)?(?:filho|criança|menor|criança)|ação de adoção",
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


# ── Utilitários de extração ────────────────────────────────────────────────────

def parse_date_tjac(raw: str) -> Optional[str]:
    raw = raw.strip()
    # D.M.YYYY ou DD.MM.YYYY
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(20\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    # DD/MM/YYYY ou D/M/YYYY (com ou sem ordinal: 1º/9/2020)
    m = re.search(r"(\d{1,2})[º°]?/(\d{1,2})/(20\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"(20\d{2})", raw)
    return f"{m.group(1)}-01-01" if m else None


def extract_section_title(chunk: str) -> str:
    """Extrai o título de seção jurídica do início do chunk (ex: 'Direito Civil').
    Requer que a 2ª letra seja minúscula para evitar capturar ementas em CAPS."""
    m = re.match(
        r"^([A-Z][a-záéíóúàâêôãõçâêôã][a-záéíóúàâêôãõçüA-Z /\-º°]{4,99}?)\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ]{4})",
        chunk.strip(),
    )
    return m.group(1).strip() if m else ""


def parse_fields_tjac(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai todos os metadados ES de uma decisão TJAC."""
    detail_re = cfg.get("citation_detail_re")
    if not detail_re:
        return None

    m = detail_re.search(chunk)
    if not m:
        return None

    tipo     = m.group("tipo").strip()
    processo = m.group("processo")
    relator  = m.group("relator").strip()
    data_raw = m.group("data").strip()

    # Órgão julgador
    if "TPJUD" in chunk or "TPADM" in chunk:
        orgao = "Tribunal Pleno"
    else:
        om = re.search(
            r"\d[ªº]\s*Câmara\s+(?:Cível|Criminal)|Câmara\s+Criminal",
            chunk,
        )
        orgao = om.group(0).strip() if om else ""

    section = extract_section_title(chunk)
    area    = classify_area(section + " " + chunk[:300])
    data    = parse_date_tjac(data_raw)

    # Ementa = tudo antes do início da citação final
    ementa = chunk[:m.start()].strip()

    return {
        "_id":           f"tjac-{processo}",
        "tribunal":      "TJAC",
        "tipo":          tipo,
        "numero":        processo,
        "relator":       relator,
        "orgaoJulgador": orgao,
        "dataJulgamento": data,
        "area":          area,
        "secao":         section,
        "fonte":         Path(filename).name,
        "ementa":        ementa,
    }


def _classify_secao_tjce(orgao: str) -> str:
    o = orgao.lower()
    if "criminal" in o:
        return "CRIMINAL"
    if "público" in o or "publico" in o:
        return "PÚBLICO"
    if "privado" in o:
        return "PRIVADO"
    if "especial" in o:
        return "ESPECIAL"
    return orgao[:40].strip()


def parse_fields_tjce(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJCE (citação no início do chunk)."""
    v3 = cfg.get("detail_v3")
    v2 = cfg.get("detail_v2")
    v1 = cfg.get("detail_v1")
    v0 = cfg.get("detail_v0")

    m = None
    tipo = "Processo"
    orgao = ""

    for pat, fmt in [(v3, "v3"), (v2, "v2"), (v1, "v1"), (v0, "v0")]:
        if not pat:
            continue
        m = pat.search(chunk)
        if m:
            if fmt == "v0":
                tipo = re.sub(r'\s+', ' ', m.group("label")).strip().title()
            elif fmt == "v1":
                tipo = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
            break

    if not m:
        return None

    processo = m.group("processo")
    relator  = re.sub(r'\s+', ' ', m.group("relator")).strip().title()
    if "orgao" in m.groupdict() and m.group("orgao"):
        orgao = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data = parse_date_tjac(m.group("data"))

    # Ramo/Área do direito
    area_m = re.search(
        r'(?:Ramo|[Áa]rea)\s+do\s+direito\s+(.+?)(?=\bAssunto\b|\bSub[aá]rea\b|\bDestaque\b|$)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    ramo = area_m.group(1).strip()[:200] if area_m else ""

    # Padrão que identifica início de seção de metadados (Legislação/Jurisprudência como label)
    # Jurisprudência só como seção quando seguida de sigla de tribunal (não inline)
    _METASEC = (
        r'\bLegisla[çc][aã]o(?:\s+aplicada)?\s+'
        r'(?:Lei\b|C[oó]digo\b|CF\b|CPC\b|CPP?\b|CLT\b|CDC\b|CTN\b|ECA\b|LINDB\b|'
        r'Decreto\b|Constitui[çc][aã]o\b|Estatuto\b|'
        r'Resolu[çc][aã]o\b|Provimento\b|S[uú]mula\b|\d)'
        r'|Jurisprud[eê]ncia(?:\s+aplicada)?\s+'
        r'(?:STF\b|STJ\b|TJ[A-Z]{2}\b|Superior\b|Federal\b|S[úu]mula\b|Tema\b)'
    )

    # Destaque (ementa concisa)
    dest_m = re.search(
        r'\bDestaque\s+(.+?)(?=\bInforma[çc][aã]o\s+de\s+inteiro\s+teor\b|' + _METASEC + r'|\Z)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    destaque = dest_m.group(1).strip() if dest_m else ""

    # Informação de inteiro teor (texto completo)
    inteiro_m = re.search(
        r'\bInforma[çc][aã]o\s+de\s+inteiro\s+teor\s+(.+?)(?=' + _METASEC + r'|\Z)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    inteiro = inteiro_m.group(1).strip() if inteiro_m else ""

    if destaque and inteiro:
        ementa = destaque + " " + inteiro
    elif destaque:
        ementa = destaque
    elif inteiro:
        ementa = inteiro
    else:
        ementa = chunk[m.end():].strip()

    area  = classify_area(ramo + " " + destaque[:200])
    secao = _classify_secao_tjce(orgao)

    return {
        "_id":            f"tjce-{processo}",
        "tribunal":       "TJCE",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          secao,
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def _normalize_processo_tjdft(proc: str) -> str:
    """Converte 20 dígitos sem separadores → CNJ NNNNNNN-DD.AAAA.J.TT.OOOO."""
    proc = proc.strip()
    if re.match(r'^\d{20}$', proc):
        return f"{proc[:7]}-{proc[7:9]}.{proc[9:13]}.{proc[13]}.{proc[14:16]}.{proc[16:20]}"
    return proc


def _classify_area_tjdft(heading: str) -> str:
    h = heading.lower()
    if "penal" in h or "criminal" in h or "militar" in h:
        return "CRIMINAL"
    if "tribut" in h:
        return "TRIBUTARIO"
    if "administrativo" in h or "previdenci" in h:
        return "ADMINISTRATIVO"
    if "constitucional" in h:
        return "CONSTITUCIONAL"
    if "consumidor" in h:
        return "CONSUMIDOR"
    if "criança" in h or "adolescente" in h or "famíl" in h or "famil" in h:
        return "FAMILIA"
    if "civil" in h or "empresarial" in h:
        return "CIVIL"
    return "ESTADUAL"


_TJDFT_SECAO_RE = re.compile(
    r'^(Direito\s+(?:Administrativo|Civil(?:\s+e\s+Processual\s+Civil)?|'
    r'Constitucional|da\s+Crian[çc]a\s+e\s+do\s+Adolescente|'
    r'do\s+Consumidor|Empresarial|Penal(?:\s+e\s+Processual\s+Penal)?|'
    r'Penal\s+Militar|Previd[eê]nci[aá]rio|Tribut[aá]rio))\s+',
    re.IGNORECASE,
)

# Detecta ementa poluída com sumário/expediente (primeira decisão de retros/s2)
_TJDFT_SECAO_COUNT_RE = re.compile(
    r'Direito\s+(?:Administrativo|Civil|Constitucional|da\s+Crian[çc]a|'
    r'do\s+Consumidor|Empresarial|Penal|Previd[eê]nci[aá]rio|Tribut[aá]rio)',
    re.IGNORECASE,
)

def _tjdft_ementa_is_polluted(text: str) -> bool:
    """Retorna True se a ementa contém sumário/expediente do boletim (front matter)."""
    # Expediente dos boletins retrospectiva: marcadores institucionais
    if re.search(r'NUPIJUR|CODJU', text, re.IGNORECASE):
        return True
    # 4+ seções "Direito X" indicam sumário da publicação
    if len(_TJDFT_SECAO_COUNT_RE.findall(text)) >= 4:
        return True
    return False


def parse_fields_tjdft(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJDFT (citação no FIM do chunk)."""
    detail_re = cfg.get("detail_re")
    if not detail_re:
        return None

    m = detail_re.search(chunk)
    if not m:
        return None

    processo = _normalize_processo_tjdft(m.group("processo"))
    relator_raw = re.sub(r'\s+', ' ', m.group("relator")).strip()
    # Strip honorific/title prefixes: "Designado: Des. ", "Juíza ", "Desª. " etc.
    relator_raw = re.sub(
        r'^(?:Designado\s*:?\s*)?(?:Ju[ií]z[ao]?\s+|Des(?:embargador[ao]?)?\s*[.ª]*\s+)',
        '', relator_raw, flags=re.IGNORECASE,
    ).strip()
    relator  = relator_raw.title()
    orgao    = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data     = parse_date_tjac(m.group("data"))

    ementa_raw = chunk[:m.start()].strip()

    # Pula decisão se a ementa está poluída com sumário ou expediente do boletim
    if _tjdft_ementa_is_polluted(ementa_raw):
        return None

    # Remove residual front-matter markers (Apresentação, Sumário, Índice, bullets)
    ementa_raw = re.sub(r'\bApresenta[çc][aã]o\b.*?(?=\w{8})', ' ', ementa_raw, flags=re.IGNORECASE | re.DOTALL)
    ementa_raw = re.sub(r'\bSumário\b\s*', ' ', ementa_raw, flags=re.IGNORECASE)
    ementa_raw = re.sub(r'\bÍndice\b\s*', ' ', ementa_raw, flags=re.IGNORECASE)
    ementa_raw = re.sub(r'[•·]\s*', ' ', ementa_raw)
    ementa_raw = re.sub(r' {2,}', ' ', ementa_raw).strip()

    sec_m = _TJDFT_SECAO_RE.match(ementa_raw)
    section = sec_m.group(1).strip() if sec_m else ""
    if sec_m:
        ementa_raw = ementa_raw[sec_m.end():].strip()

    area = _classify_area_tjdft(section) if section else classify_area(ementa_raw[:300])

    return {
        "_id":            f"tjdft-{processo}",
        "tribunal":       "TJDFT",
        "tipo":           "Acórdão",
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          section or orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa_raw,
    }


def _classify_secao_tjba(orgao: str) -> str:
    o = orgao.lower()
    if "criminal" in o:
        return "CRIMINAL"
    if "cível" in o or "civel" in o:
        return "CÍVEL"
    if "pleno" in o:
        return "PLENO"
    if "especial" in o:
        return "ESPECIAL"
    return orgao[:40].strip()


def parse_fields_tjba(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJBA (citação no início do chunk)."""
    detail_re = cfg.get("citation_detail_re")
    v2_re     = cfg.get("citation_detail_re_v2")
    if not detail_re:
        return None

    m = detail_re.match(chunk.strip())
    if not m and v2_re:
        m = v2_re.match(chunk.strip())
    if not m:
        return None

    tipo      = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
    processo  = m.group("processo")
    relator   = re.sub(r'\s+', ' ', m.group("relator")).strip().title()
    orgao     = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data_raw  = m.group("data_julgamento").strip()

    ementa_raw = chunk[m.end():].lstrip("). ")
    ementa_raw = re.sub(
        r'^(?:EMENTA\s+EMENTA:\s*|EMENTA:\s*|EMENTA\s+'
        r'|AC[OÓ]RD[ÃA]O\s+[Ee]menta:\s*|AC[OÓ]RD[ÃA]O\s+)',
        '', ementa_raw, flags=re.IGNORECASE,
    ).strip()
    m_bound = re.search(
        r'AC[OÓ]RD[ÃA]O\s+(?:[Vv]istos|[Rr]elatados)'
        r'|ACORDAM\s+os\s+Desembargadores'
        r'|[Vv]istos,?\s+relatados\s+e\s+discutidos\s+estes\s+autos'
        r'|\bRELATÓRIO\b|R E L A T [OÓ] R I O'
        r'|\bDECISÃO PROCLAMADA\b|\bVOTO\b',
        ementa_raw, re.IGNORECASE,
    )
    ementa = ementa_raw[:m_bound.start()].strip() if m_bound else ementa_raw.strip()

    area  = classify_area(ementa[:300])
    secao = _classify_secao_tjba(orgao)
    data  = parse_date_tjac(data_raw)

    return {
        "_id":            f"tjba-{processo}",
        "tribunal":       "TJBA",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          secao,
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


# ── PDF / HTML extraction ──────────────────────────────────────────────────────

def is_spaced_page(text: str) -> bool:
    words = text.split()
    if not words:
        return False
    single_chars = sum(1 for w in words if len(w) == 1)
    return single_chars / len(words) > 0.6


def extract_text_pdf(path: Path, skip_spaced: bool = False) -> str:
    import fitz
    doc = fitz.open(str(path))
    pages = []
    for page in doc:
        t = page.get_text()
        if skip_spaced and is_spaced_page(t):
            continue
        pages.append(t)
    return "\n".join(pages)


def extract_text_pdf_plumber(path: Path) -> str:
    import pdfplumber
    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages)


def extract_text_html(path: Path) -> str:
    from html.parser import HTMLParser

    class _P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)

    p = _P()
    p.feed(path.read_text(encoding="utf-8", errors="replace"))
    return " ".join(p.parts)


# ── Normalização ───────────────────────────────────────────────────────────────

def flatten(text: str, cfg: dict) -> str:
    text = text.replace("\n", " ")
    text = re.sub(r" {2,}", " ", text)
    if cfg.get("hyphen_rejoin"):
        text = re.sub(r"(\w)- (\w)", r"\1\2", text)
    for hre in cfg.get("header_re", []):
        text = hre.sub(" ", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" \.", ".", text)
    return text.strip()


_SECTION_RE = re.compile(
    r"(?<= )([A-Z][a-záéíóúàâêôãõç][^(]{5,100}?[a-záéíóúàâêôãõç])\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ]{6})",
)
_CIT_INDICATOR = re.compile(
    r"[Jj]ulgad[oa]\s+em|[Pp]ublicad[oa]\s+(?:em|no)", re.IGNORECASE
)


def _trim_front_matter(chunk: str) -> str:
    best_pos = None
    for m in _SECTION_RE.finditer(chunk):
        if _CIT_INDICATOR.search(chunk[m.start(): m.start() + 8000]):
            best_pos = m.start()
    return chunk[best_pos:] if best_pos is not None else chunk


def split_decisions(text: str, citation_re: re.Pattern, skip_trim: bool = False) -> list[str]:
    decisions: list[str] = []
    seen: set[str] = set()
    pos = 0
    for i, m in enumerate(citation_re.finditer(text)):
        end = m.end()
        chunk = text[pos:end].strip()
        if i == 0 and not skip_trim:
            chunk = _trim_front_matter(chunk)
        key = m.group().strip()[:120]
        if len(chunk) > 150 and key not in seen:
            decisions.append(chunk)
            seen.add(key)
        pos = end
    return decisions


def split_decisions_start(text: str, citation_re: re.Pattern) -> list[str]:
    """Split text into decisions where the citation is at the START of each chunk."""
    matches = list(citation_re.finditer(text))
    if not matches:
        return []
    seen: set[str] = set()
    chunks: list[str] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[m.start():end].strip()
        key = chunk[:120]
        if len(chunk) > 200 and key not in seen:
            chunks.append(chunk)
            seen.add(key)
    return chunks


def process_file(f: Path, cfg: dict) -> list[str]:
    if f.suffix.lower() == ".pdf":
        if cfg.get("use_pdfplumber"):
            raw = extract_text_pdf_plumber(f)
        else:
            raw = extract_text_pdf(f, skip_spaced=cfg.get("spaced_text", False))
    elif f.suffix.lower() in (".html", ".htm"):
        raw = extract_text_html(f)
    else:
        return []
    text = flatten(raw, cfg)
    if cfg.get("citation_at_start"):
        return split_decisions_start(text, cfg["citation_re"])
    return split_decisions(text, cfg["citation_re"], skip_trim=cfg.get("skip_trim", False))


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tribunal", required=True)
    ap.add_argument("--n", type=int, default=20, help="Total de decisões no preview")
    ap.add_argument("--input", default=str(DEFAULT_INPUT))
    ap.add_argument("--output", default="")
    ap.add_argument(
        "--fields", action="store_true",
        help="Exibe todos os campos ES (modo auditoria de metadados)",
    )
    ap.add_argument(
        "--full", action="store_true",
        help="Junto com --fields: exibe ementa completa sem truncar",
    )
    args = ap.parse_args()

    sigla = args.tribunal.lower()
    if sigla not in TRIBUNAL_CFG:
        known = ", ".join(sorted(TRIBUNAL_CFG))
        sys.exit(f"Tribunal '{sigla}' não configurado. Disponíveis: {known}")

    cfg = TRIBUNAL_CFG[sigla]
    folder = Path(args.input) / sigla
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    output_path = Path(args.output) if args.output else SCRIPT_DIR / f"preview_{sigla}.txt"

    # ── Modo --fields: coleta N/n_groups de cada tipo de PDF ────────────────────
    if args.fields and "file_patterns" in cfg:
        import fnmatch
        all_files = sorted(folder.iterdir())

        groups: dict[str, list[Path]] = {}
        for label, pat in cfg["file_patterns"].items():
            groups[label] = [f for f in all_files if fnmatch.fnmatch(f.name, pat)]

        per_group = max(1, args.n // max(1, len(groups)))
        preview_items: list[tuple[str, str, dict]] = []  # (label, chunk, fields)

        _pfn = {
            "tjba":  parse_fields_tjba,
            "tjce":  parse_fields_tjce,
            "tjdft": parse_fields_tjdft,
        }.get(sigla, parse_fields_tjac)

        for label, files in groups.items():
            per_file = max(1, per_group // max(1, len(files)))
            group_collected = 0
            for f in files:
                if group_collected >= per_group:
                    break
                print(f"  [{label}] Lendo {f.name}...")
                decisions = process_file(f, cfg)
                print(f"    → {len(decisions)} decisões")
                file_collected = 0
                for d in decisions:
                    if file_collected >= per_file or group_collected >= per_group:
                        break
                    fields = _pfn(d, f.name, cfg)
                    if fields:
                        preview_items.append((label, d, fields))
                        file_collected += 1
                        group_collected += 1

        with output_path.open("w", encoding="utf-8") as out:
            out.write(f"PREVIEW — {cfg['tribunal']} — {len(preview_items)} decisões (campos ES)\n")
            out.write("=" * 70 + "\n\n")
            for i, (label, chunk, fld) in enumerate(preview_items, 1):
                out.write(f"{'─'*60}\n")
                out.write(f"[{i:02d}] tipo_pdf      : {label}\n")
                out.write(f"      _id          : {fld['_id']}\n")
                out.write(f"      tribunal     : {fld['tribunal']}\n")
                out.write(f"      tipo         : {fld['tipo']}\n")
                out.write(f"      numero       : {fld['numero']}\n")
                out.write(f"      relator      : {fld['relator']}\n")
                out.write(f"      orgaoJulgador: {fld['orgaoJulgador']}\n")
                out.write(f"      dataJulgamento: {fld['dataJulgamento']}\n")
                out.write(f"      area         : {fld['area']}\n")
                out.write(f"      secao        : {fld['secao']}\n")
                out.write(f"      fonte        : {fld['fonte']}\n")
                ementa_out = fld['ementa'] if args.full else (fld['ementa'][:500] + ('...' if len(fld['ementa']) > 500 else ''))
                out.write(f"      ementa       : {ementa_out}\n\n")
        print(f"\nGerado: {output_path}")
        return

    # ── Modo padrão: N decisões em ordem alfabética ────────────────────────────
    all_decisions: list[str] = []
    for f in sorted(folder.iterdir()):
        if len(all_decisions) >= args.n:
            break
        print(f"  Lendo {f.name}...")
        decisions = process_file(f, cfg)
        print(f"    → {len(decisions)} decisões extraídas")
        all_decisions.extend(decisions)

    preview = all_decisions[: args.n]
    print(f"\nTotal: {len(all_decisions)} decisões | Escrevendo {len(preview)} em {output_path}")

    with output_path.open("w", encoding="utf-8") as out:
        out.write(f"PREVIEW — {cfg['tribunal']} — primeiras {len(preview)} decisões\n")
        out.write("=" * 70 + "\n\n")
        for i, d in enumerate(preview, 1):
            out.write(f"{'─'*60}\n[{i:02d}] {d}\n\n")

    print("Arquivo gerado:", output_path)


if __name__ == "__main__":
    main()
