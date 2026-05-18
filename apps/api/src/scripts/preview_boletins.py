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
_TJGO_PROC_RE  = r'(?:\d{7}[-. ]\s*\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{15})'
_TJES_PROC_RE  = r'(?:\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}|\d{10,13})'

# TJPA: número de processo CNJ (novo e antigo formato)
_TJPA_PROC_NUM = r'\d{4,10}-\d{2}\.\d{4}\.[\d.]{3,12}'

# TJPA V2 (2022+): citação no FIM — (TJPA – TIPO – [Nº] PROCESSO – Relator(a): NOME – ÓRGÃO – Julgado/Documento em DD/MM/AAAA)
_TJPA_CIT_RE = re.compile(
    r'\(TJPA\s*[–\-]\s*'
    r'(?P<tipo>[^–\-()\n]{3,80}?)\s*[–\-]\s*'
    r'(?:N[°º]?\s*)?'
    r'(?P<numero>' + _TJPA_PROC_NUM + r')'
    r'\s*[–\-]\s*Relator\(a\)\s*:\s*'
    r'(?P<relator>[^–\-()\n]{3,80}?)\s*[–\-]\s*'
    r'(?P<orgao>[^–\-()\n]{3,60}?)\s*[–\-]\s*'
    r'(?:Julgado|Documento|Publica[çc][ãa]o)\s*(?:em\s*)?'
    r'(?P<data>\d{1,2}/\d{1,2}/\d{4})'
    r'[^)]*\)',
    re.IGNORECASE,
)

# TJPA V1 (2020): marcador de início de cada decisão
_TJPA_V1_START_RE = re.compile(r'AC[ÓO]RD[ÃA]O\s+N[°º.]?\s*\d+', re.IGNORECASE)

# TJPA V2: marcador de ID PJE (antes de cada ementa)
_TJPA_PJE_ID_RE = re.compile(r'\d{7,8}\s*-\s*Ac[oó]rd[aã]o\s+PJE', re.IGNORECASE)

# TJPI: número CNJ tolerante a artefatos PyMuPDF (espaços, ponto duplo, dígito extra)
_TJPI_PROC_NUM = (
    r'\d{5,9}'          # raiz (normalmente 7 dígitos; 8 por artefato de duplicação)
    r'\s*[-–]\s*'       # traço (pode ter espaços)
    r'\d{2}'            # dígitos verificadores
    r'[.\s]{1,3}'       # separador: `.`, `..` ou `. ` (artefato de duplicação)
    r'\d{4,5}'          # ano (pode ter 5 dígitos por artefato)
    r'[.\s]{1,3}'       # separador
    r'\d'               # segmento de justiça (8)
    r'[.\s]{1,3}'       # separador
    r'\d{2}'            # código do tribunal (18=PI)
    r'[.\s]{1,3}'       # separador
    r'\d{1,3}'          # início do código de origem
    r'\s*\d{0,3}'       # possível continuação separada por espaço
)

# TJPI V1 (2021-2023, jun-2025): citação no FIM
# (TIPO - NUMERO - ÓRGÃO - Relator: NAME - [Julgamento:] DD/MM/YYYY)
_TJPI_V1_CIT_RE = re.compile(
    r'\(?(?!TJPI\s*[-–])'
    r'(?P<v1_tipo>[^-()]{3,80}?)'
    r'\s*-\s*'
    r'(?P<v1_num>' + _TJPI_PROC_NUM + r')'
    r'\s*-\s*'
    r'(?P<v1_orgao>[^-()]{3,80}?)'
    r'\s*-\s*'
    r'Rela{1,2}tor\s*:\s*'                 # aceita "Relaator" (artefato PyMuPDF)
    r'(?P<v1_rel>[^-()]{3,80}?)'
    r'\s*-{1,2}\s*'                         # aceita "--" (artefato PyMuPDF)
    r'(?:Julgamento\s*:\s*)?'
    r'(?P<v1_data>\d{1,2}/\d{1,2}/\d{2,6})'
    r'[^)]{0,20}\)',
    re.IGNORECASE,
)

# TJPI V2 (outnov-2024, outnov-2024-jun-2025): citação no FIM
# (TJPI - TIPO NUMERO - Relator: NAME - ÓRGÃO - [Data] DD/MM/YYYY)
_TJPI_V2_CIT_RE = re.compile(
    r'\(*TJPI+\s*[-–]\s*'
    r'(?P<v2_tipo>[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÜ][^\d()]{2,70}?)'
    r'\s+'
    r'(?P<v2_num>' + _TJPI_PROC_NUM + r')'
    r'\s*[-–]\s*'
    r'Rela{1,2}tor\s*:\s*'                 # aceita "Relaator" (artefato PyMuPDF)
    r'(?P<v2_rel>[^-()]{3,80}?)'
    r'\s*[-–]\s*'
    r'(?P<v2_orgao>[^-()]{3,80}?)'
    r'\s*[-–]\s*'
    r'(?:D{1,2}ata\s*)?'                   # aceita "DData" (artefato PyMuPDF)
    r'(?P<v2_data>\d{1,2}/\d{1,2}/\d{2,6})'
    r'[^)]{0,20}\)*',
    re.IGNORECASE,
)

# Regex combinado para split_decisions (alternação V1|V2)
_TJPI_SPLIT_RE = re.compile(
    r'(?:' + _TJPI_V1_CIT_RE.pattern + r'|' + _TJPI_V2_CIT_RE.pattern + r')',
    re.IGNORECASE,
)

# ── TJRN ──────────────────────────────────────────────────────────────────────
# Número CNJ do TJRN: 8.20 (ex: 0809990-81.2022.8.20.0000)
_TJRN_PROC_NUM = r'\d{7}\s*[-–]\s*\d{2}\.?\s*\d{4}\.8\.20\.\d{4}'

# TJRN: citação entre parênteses com número 8.20 e suporte a () aninhado nível 1
# Usa (?:[^()]*\([^()]*\))*[^()]* para evitar backtracking catastrófico:
# as alternativas [^()] e \([^()]*\) são mutuamente exclusivas, tornando o parse linear.
_TJRN_SPLIT_RE = re.compile(
    r'\('
    r'(?:[^()]*\([^()]*\))*[^()]*'       # prefixo com () nível-1 opcionais
    r'(?:' + _TJRN_PROC_NUM + r')'       # número CNJ 8.20
    r'(?:[^()]*\([^()]*\))*[^()]*'       # sufixo com () nível-1 opcionais
    r'\)',
    re.IGNORECASE,
)

# ── TJRR ──────────────────────────────────────────────────────────────────────
# Número CNJ do TJRR: 8.23 (ex: 9000312-06.2020.8.23.0000)
_TJRR_PROC_NUM = r'\d{7}\s*-\s*\d{2}\.?\s*\d{4}\.8\.23\.\d{4}'
_TJRR_PROC_NUM_RE = re.compile(_TJRR_PROC_NUM)

# TJRR: tipo deve começar com uma palavra-chave processual (evita contaminação de cabeçalho)
_TJRR_TIPO_RE = re.compile(
    r'(?:A[çc][aã]o|Agravo|Mandado|Habeas|Recurso|Revis[aã]o|Incidente|'
    r'Conflito|Diss[íi]dio|Pedido|Apela[çc][aã]o|Argui[çc][aã]o|'
    r'Embargos?|Exce[çc][aã]o|Queixa|Reclama[çc][aã]o|Declarat[oó]rios?)'
    r'(?:\s+[A-Za-záéíóúàâêôãõçÀ-ÿ]{2,}){0,6}',
    re.IGNORECASE,
)

# TJMG: número no formato 1.NNNN.NN.NNNNNN-N/NNN (pode ter espaço antes do traço)
_TJMG_PROC_RE  = r'1\.\d{4}\.\d{2}\.\d{5,6}\s*[-]\s*\d/\d{3}'

# TJMG: citação no FIM de cada decisão — (TJMG – Tipo Número, Rel. Des. NAME, Órgão, j. em DD/MM/YYYY...)
_TJMG_CIT_RE = re.compile(
    r'\(TJMG\s*[-–]\s*'
    r'(?:\d+\s+)?'                                   # artefato de página: "6 "
    r'[A-Za-záéíóúàâêôãõçÀ-ÿ][^)]{3,100}?'         # tipo (sem fechar paren)
    r'(?:' + _TJMG_PROC_RE + r')'                   # número do processo
    r'[^)]{10,280}?'                                 # nome, órgão etc (lazy)
    r'j\.\s*em\s*\d{1,2}[/.]\d{1,2}[/.]\d{2,4}'   # j. em data
    r'[^)]*\)',
    re.IGNORECASE,
)

# TJMG: regex de campos para parse_fields_tjmg
_TJMG_DETAIL_RE = re.compile(
    r'\(TJMG\s*[-–]\s*'
    r'(?:\d+\s+)?'                                             # artefato de página
    r'(?P<tipo>[A-Za-záéíóúàâêôãõçÀ-ÿ][A-Za-záéíóúàâêôãõçÀ-ÿ°/.\s\-–]+?)'
    r'\s*(?:n[°º]?\s*\d+\s+)?'                               # "n° 4" opcional
    r'(?P<numero>' + _TJMG_PROC_RE + r')'
    r'[^,]*,'                                                  # até a primeira vírgula
    r'\s*Rel(?:ator[ae]?)?[.ª°]*\s*(?:\([aA]\)\s*)?:?\s*'   # Rel./Relator(a):
    r'(?:Des(?:embargador[ao]?)?[.ª°]*\s+)?'                  # Des. opcional
    r'(?P<relator>[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][^,]+?),'
    r'\s*(?P<orgao>[^,]+?),'
    r'\s*j\.\s*em\s*'
    r'(?P<data>\d{1,2}[/.]\d{1,2}[/.]\d{2,4})'
    r'[^)]*\)',
    re.IGNORECASE,
)

# TJES V1: citação no FIM (2020-2023) — (TJES, Classe: TYPE, PROC, Relator: ..., Data de Julgamento: DD/MM/YYYY[...])
_TJES_V1_CIT_RE = re.compile(
    r'\(TJES,\s*Classe:[^)]*Data\s+de\s+Julgamento:\s*\d{2}/\d{2}/\d{4}[^)]*\)',
    re.IGNORECASE,
)

# TJES V1 detail: extrai campos da citação (para parse_fields_tjes)
_TJES_V1_DETAIL_RE = re.compile(
    r'\(TJES,\s*Classe:\s*(?P<tipo>[^,]+?),\s*'
    r'(?P<numero>' + _TJES_PROC_RE + r'),\s*'
    r'Relator(?:a)?:\s*(?P<relator>[^,]+?),\s*'
    r'[Óo]rg[aã]o\s+julgador:\s*(?P<orgao>[^,]+?),\s*'
    r'Data\s+de\s+Julgamento:\s*(?P<data>\d{2}/\d{2}/\d{4})[^)]*\)',
    re.IGNORECASE | re.DOTALL,
)

# TJES V2: bloco de metadados no FIM (2024) — Data:/Órgão julgador:/Número:/Magistrado:/Classe:/Assunto:
# Usado antes do flatten para split; o mesmo padrão funciona pós-flatten com \s+ em vez de \n
_TJES_V2_META_RE = re.compile(
    r'Data:\s+(?P<data>\d{1,2}/[A-Za-z]{3}/\d{4})\s*\n'
    r'[Óo]rg[aã]o\s+julgador:\s*(?P<orgao>[^\n]+?)\s*\n'
    r'N[uú]mero:\s*(?P<numero>' + _TJES_PROC_RE + r')[^\n]*\n'
    r'Magistrado:\s*(?P<relator>[^\n]+?)\s*\n'
    r'Classe:\s*(?P<tipo>[^\n]+?)\s*\n'
    r'Assunto:\s*(?P<assunto>[^\n]+)',
    re.IGNORECASE,
)

_MESES_EN_ABBR = {
    'jan': '01', 'fev': '02', 'feb': '02', 'mar': '03', 'apr': '04', 'abr': '04',
    'may': '05', 'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08', 'ago': '08',
    'sep': '09', 'set': '09', 'oct': '10', 'out': '10', 'nov': '11', 'dec': '12', 'dez': '12',
}

# TJGO Format 1: citação no FIM entre parênteses
# (TYPE – PROC [– ORGAO] – [Relator|Decisão]: [Des.] NAME – Julgamento: YYYY)
_TJGO_V1_CIT_RE = re.compile(
    r'\('
    r'[A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s–\-]{2,120}?'
    r'\s*[–\-]\s*'
    r'(?:' + _TJGO_PROC_RE + r')'
    r'[^)]{0,350}?'
    r'[–\-]\s*[Jj]ulgamento\s*:\s*(?:19|20)\d{2}'
    r'\)',
    re.DOTALL,
)

# TJGO Format 2: cabeçalho no INÍCIO — [N. ]TYPE n[°º] PROC ... EMENTA:
# A âncora em EMENTA: elimina citações internas de jurisprudência.
# Negative lookahead impede match de "Relatora Apelação" (fim de assinatura).
_TJGO_V2_CIT_RE = re.compile(
    r'(?:\d{1,3}\.\s+)?'
    r'(?!Relator[ae]?[\s,.\-])'
    r'[A-Z\xc0-\xd6\xd8-\xde][A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s]{2,80}?'
    r'\s+n[\xb0\xba]\s*'
    r'(?:' + _TJGO_PROC_RE + r')'
    r'.{0,900}?'
    r'EMENTA\s*:',
    re.IGNORECASE | re.DOTALL,
)

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
    "tjgo": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "dual_format": True,
        "header_re": [
            # Cobre todas as variações:
            # "INFORMATIVO DE JURISPRUDÊNCIA 2022"
            # "INFORMATIVO DE JURISPRUDÊNCIA 2 2022"  (nº de página inline)
            # "2 INFORMATIVO DE JURISPRUDÊNCIA SETEMBRO.2025"
            # "INFORMATIVO DE JURISPRUDÊNCIA SETEMBRO 2025"
            re.compile(
                r'(?:\d{1,3}\s+)?INFORMATIVO\s+DE\s+JURISPRUD[EÊ]NCIA'
                r'(?:\s+\d{1,3})?\s+(?:[A-Z\xc0-\xff]+\.?\s*)?(?:19|20)\d{2}',
                re.IGNORECASE,
            ),
        ],
        "citation_re":    _TJGO_V1_CIT_RE,   # Format 1: citação no fim
        "citation_re_v2": _TJGO_V2_CIT_RE,   # Format 2: cabeçalho no início
        "tribunal":       "TJGO",
        "area_default":   "ESTADUAL",
        "file_patterns":  {"informativo": "informativo_*.pdf"},
        "parse_fn":       "tjgo",
        "min_ementa_len": 300,
    },
    "tjes": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "tribunal": "TJES",
        "area_default": "ESTADUAL",
        "file_patterns": {"ementario": "ementario_*.pdf"},
        "parse_fn": "tjes",
        "min_ementa_len": 80,
        "header_re": [
            # "REVISTA EMENTÁRIO DE JURISPRUDÊNCIA TRIMESTRAL\njaneiro • fevereiro • março • 2020"
            re.compile(
                r'REVISTA\s+EMENT[AÁ]RIO\s+DE\s+JURISPRUD[EÊ]NCIA\s+TRIMESTRAL[^\n]*\n[^\n]*\n',
                re.IGNORECASE,
            ),
            # Rodapé: "~ 8 ~" ou ". 9 ." ou "TRIBUNAL DE JUSTIÇA DO ESPÍRITO SANTO"
            re.compile(
                r'(?:~\s*\d+\s*~|[•·\.\-]\s*\d+\s*[•·\.\-])\s*\n',
                re.IGNORECASE,
            ),
            re.compile(
                r'TRIBUNAL\s+DE\s+JUSTI[ÇC]A\s+DO\s+ESP[IÍ]RITO\s+SANTO\s*\n',
                re.IGNORECASE,
            ),
        ],
        "citation_re": _TJES_V1_CIT_RE,
    },
    "tjmg": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "tribunal": "TJMG",
        "area_default": "ESTADUAL",
        "file_patterns": {"boletim": "boletim_*.pdf"},
        "parse_fn": "tjmg",
        "min_ementa_len": 80,
        "header_re": [],
        "citation_re": _TJMG_CIT_RE,
        "detail_re": _TJMG_DETAIL_RE,
    },
    "tjpa": {
        "use_pdfplumber": True,
        "hyphen_rejoin": True,
        "tribunal": "TJPA",
        "area_default": "ESTADUAL",
        "file_patterns": {"informativo": "informativo_*.pdf"},
        "parse_fn": "tjpa",
        "min_ementa_len": 300,
        "citation_re": _TJPA_CIT_RE,
    },
    "tjpi": {
        "tribunal": "TJPI",
        "area_default": "ESTADUAL",
        "file_patterns": {"boletim": "*.pdf"},
        "parse_fn": "tjpi",
        "min_ementa_len": 300,
        "citation_re": _TJPI_SPLIT_RE,
    },
    "tjrn": {
        "tribunal": "TJRN",
        "area_default": "ESTADUAL",
        "file_patterns": {"informativo": "informativo_*.pdf"},
        "parse_fn": "tjrn",
        "min_ementa_len": 200,
        "citation_re": _TJRN_SPLIT_RE,
        "header_re": [
            # "INFORMATIVO DE JURISPRUDÊNCIA DO TJRN • EDIÇÃO 001" — usa • (bullet), não traço
            # Consome também número de página prefixado/sufixado: "6 INFORMATIVO..." / "...001 8"
            re.compile(
                r'(?:\d+\s+)?INFORMATIVO\s+DE\s+JURISPRUD[ÊE]NCIA\s+DO\s+TJRN'
                r'\s*[•–\-]\s*EDI[ÇC][ÃA]O\s+\d{3}'
                r'(?:\s+\d+)?',
                re.IGNORECASE,
            ),
            # Itens do sumário (capa): "TRIBUNAL PLENO.....5", "SEÇÃO CÍVEL____29", "1a. CÂMARA CÍVEL___40"
            re.compile(
                r'(?:TRIBUNAL\s+PLENO|SE[ÇC][ÃA]O\s+C[ÍI]VEL'
                r'|[123](?:ª|a)?\.?\s*C[ÂA]MARA\s+C[ÍI]VEL'
                r'|C[ÂA]MARA\s+CRIMINAL|TURMAS?\s+RECURSAIS?)\s*[._]{2,}\s*\d+',
                re.IGNORECASE,
            ),
            # Palavra "Sumário" / "SUMÁRIO" da capa
            re.compile(r'\bSum[aá]rio\b', re.IGNORECASE),
            # Data da capa: "Natal, 14 de junho de 2023" (ano pode ter sido consumido antes)
            re.compile(
                r'Natal,?\s+\d+\s+de\s+\w+\s+de\s*(?:20\d{2})?',
                re.IGNORECASE,
            ),
            # Seção "DIRIGENTES" (diretoria do tribunal na capa)
            re.compile(
                r'DIRIGENTES\s+(?:Presidente|Vice|Corregedor|Ouvidor)'
                r'(?:.(?!(?:[A-Z][a-záéíóúàâêôãõç]|\d{7})))*',
                re.IGNORECASE | re.DOTALL,
            ),
            # Composição do colegiado (2+ "Des./Desª. Nome" consecutivos na capa)
            re.compile(
                r'(?:Desª?\.\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ]+'
                r'(?:\s+[A-Za-záéíóúàâêôãõçÀ-ÿA-Z]+){1,4}\s*){2,}',
            ),
        ],
    },
    "tjrr": {
        "tribunal": "TJRR",
        "area_default": "ESTADUAL",
        "file_patterns": {"informativo": "informativo_*.pdf"},
        "parse_fn": "tjrr",
        "min_ementa_len": 100,
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
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{mo:02d}-{d:02d}"
    # DD/MM/YYYY ou D/M/YYYY (com ou sem ordinal: 1º/9/2020)
    m = re.search(r"(\d{1,2})[º°]?/(\d{1,2})/(20\d{2})", raw)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{mo:02d}-{d:02d}"
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


# ── TJGO ──────────────────────────────────────────────────────────────────────

# Detail regex for Format 1 field extraction
_TJGO_V1_DETAIL_RE = re.compile(
    r'\('
    r'(?P<tipo>[A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s–\-]{2,120}?)'
    r'\s*[–\-]\s*'
    r'(?P<processo>' + _TJGO_PROC_RE + r')'
    r'(?P<middle>[^)]{0,350}?)'
    r'[–\-]\s*(?:[Rr]elator[ae]?(?:\s+em\s+substitui\xc3\xa7\xc3\xa3o)?|[Dd]ecis\xc3\xa3o)\s*:?\s*'
    r'(?:Des(?:embargador[ao]?)?\s+)?'
    r'(?P<relator>[A-Z\xc0-\xd6\xd8-\xde][^–\-)]{3,80}?)'
    r'(?:\s*[–\-]\s*Redator\s*:?\s*[^–\-)]{3,80}?)?'
    r'\s*[–\-]\s*[Jj]ulgamento\s*:\s*'
    r'(?P<ano>(?:19|20)\d{2})'
    r'\)',
    re.DOTALL | re.IGNORECASE,
)

_MESES_PT = {
    'janeiro': '01', 'fevereiro': '02', 'mar\xe7o': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
}


def _parse_date_tjgo_sig(chunk: str) -> Optional[str]:
    """Extrai data da assinatura 'Goiânia, DD de MÊS de YYYY'."""
    m = re.search(
        r'Goi[â\xe2]nia(?:/GO)?,\s*(\d{1,2})\s+de\s+([a-z\xe0-\xff]+)\s+de\s+((?:19|20)\d{2})',
        chunk, re.IGNORECASE,
    )
    if not m:
        return None
    d, mes, y = m.group(1), m.group(2).lower(), m.group(3)
    mo = _MESES_PT.get(mes)
    return f"{y}-{mo}-{int(d):02d}" if mo else f"{y}-01-01"


def _normalize_proc_tjgo(proc: str) -> str:
    """Normaliza número de processo TJGO: espaços internos e ponto→hífen."""
    proc = re.sub(r'\s', '', proc)
    m = re.match(r'^(\d{7})\.(\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$', proc)
    return f"{m.group(1)}-{m.group(2)}" if m else proc


def parse_fields_tjgo(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJGO (detecta formato V1/end-citation ou V2/start-citation)."""
    # Tenta Format 1: citação no FIM entre parênteses
    m1 = _TJGO_V1_DETAIL_RE.search(chunk)
    if m1 and len(chunk) - m1.start() < 800:
        tipo = re.sub(r'\s+', ' ', m1.group("tipo")).strip().title()
        processo = _normalize_proc_tjgo(m1.group("processo"))
        ano = m1.group("ano")
        data = f"{ano}-01-01"
        relator_raw = re.sub(r'[\s–\-]+', ' ', m1.group("relator")).strip()
        relator_raw = re.sub(
            r'^(?:em\s+substitui[çc][aã]o\s*:?\s*)?(?:des(?:embargador[ao]?)?\s+)?',
            '', relator_raw, flags=re.IGNORECASE,
        ).strip()
        relator = relator_raw.title()
        # Extrai órgão do trecho entre número e "Relator"
        middle = re.sub(r'\s+', ' ', m1.group("middle")).strip(" –-")
        # Remove processo e qualquer prefixo restante
        orgao = re.sub(r'^[^A-Za-z\xc0-\xff]*', '', middle).strip()
        orgao = re.sub(r'\s*[–\-]\s*$', '', orgao).strip()
        ementa = chunk[:m1.start()].strip()
        # Remove prefixo: residuo de cabeçalho e número de processo do início
        ementa = re.sub(r'^.{0,80}?' + _TJGO_PROC_RE + r'\s*[-–]\s*', '', ementa, count=1).strip()
        area = classify_area(ementa[:300])
        min_len = cfg.get("min_ementa_len", 0)
        if min_len and len(ementa) < min_len:
            return None
        return {
            "_id":            f"tjgo-{processo}",
            "tribunal":       "TJGO",
            "tipo":           tipo,
            "numero":         processo,
            "relator":        relator,
            "orgaoJulgador":  orgao,
            "dataJulgamento": data,
            "area":           area,
            "secao":          orgao[:40],
            "fonte":          Path(filename).name,
            "ementa":         ementa,
        }

    # Format 2: citação no INÍCIO — TYPE nº PROC [header fields] EMENTA: ...
    proc_m = re.search(_TJGO_PROC_RE, chunk)
    if not proc_m:
        return None
    processo = _normalize_proc_tjgo(proc_m.group(0))

    # Tipo: palavras antes de nº/n° PROC
    tipo_m = re.match(
        r'(?:\d{1,3}\.\s+)?(?P<tipo>[A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s]{2,80}?)\s+n[\xb0\xba]\s*' + _TJGO_PROC_RE,
        chunk, re.IGNORECASE,
    )
    tipo = re.sub(r'\s+', ' ', tipo_m.group("tipo")).strip().title() if tipo_m else "Acórdão"
    # Remove fragmento "Elator[a]" — resíduo de "Relator[a]" da decisão anterior
    tipo = re.sub(r'^[Ee]lator[ae]?\s+', '', tipo).strip()
    # Despachos administrativos (PROAD, etc.) não têm valor jurídico — descartar
    if re.search(r'\bDespacho\b|\bPROAD\b', tipo, re.IGNORECASE):
        return None

    # Relator: "Relator[a]: [Des./Desª.] NAME"
    _V2_STOP = r'EMENTA|Redator|Comarca|Reclamante|Reclamada|Apelante|Apelado|Agravante|Agravado|Impetrante|Paciente|Autora?|R\xe9u|Representa[dn]'
    rel_m = re.search(
        r'[Rr]elator[ae]?\s*:\s*(?:Des(?:embargador[ao]?|[a\xaa])?\s*\.?\s+)?'
        r'(?P<rel>[A-Za-z\xc0-\xff][^,;\n]{3,70}?)'
        r'(?=\s*(?:[,;]|\s+(?:' + _V2_STOP + r'))|\Z)',
        chunk[:900],
    )
    relator = re.sub(r'\s+', ' ', rel_m.group("rel")).strip().title() if rel_m else ""
    relator = re.sub(r'\s*[–\-]\s*Ju[ií]z\b.*', '', relator, flags=re.IGNORECASE).strip()

    # Órgão julgador: busca apenas entre o processo e o início das partes
    _party_m = re.search(
        r'\b(?:Reclamante|Reclamada|Apelante|Apelado|Agravante|Agravado|'
        r'Autora?|R[eé]us?|Impetrante|Paciente|Representa[nd]te|Representa[nd]o)\s*:',
        chunk[:700], re.IGNORECASE,
    )
    _header_area = chunk[:_party_m.start()] if _party_m else chunk[:350]
    orgao_m = re.search(
        r'(?P<orgao>(?:\d+[ª\xba°]?\s+)?'
        r'(?:C[aâ]mara|Turma)[^\n,;–\-]{0,80}?'
        r'|[Óó]rg[aã]o\s+Especial[^\n,;–\-]{0,60}?)',
        _header_area, re.IGNORECASE,
    )
    orgao = re.sub(r'\s+', ' ', orgao_m.group("orgao")).strip() if orgao_m else ""

    # Ementa: texto entre "EMENTA:" e primeira seção estruturada ou corpo do acórdão
    ementa_m = re.search(
        r'EMENTA\s*:?\s*(.+?)(?=\s+(?:I{1,3}[VX]?|[1-9])\.\s+[A-Z\xc0-\xff]'
        r'|\s+[Ii]\.?\s+(?:CASO|QUEST\xc3\x83O|RAZ\xc3\x95ES|DISPOSITIVO)'
        r'|\s+RELAT[O\xd3]RIO\b|\s+Vistos[,\s]|\s+VOTO\b|\s+AC\xd3RD\xc3O\b'
        r'|\Z)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    if ementa_m:
        ementa = re.sub(r'\s+', ' ', ementa_m.group(1)).strip()
    else:
        ementa = re.sub(r'\s+', ' ', chunk[proc_m.end():proc_m.end() + 1500]).strip()
    # Remove cabeçalhos de página PDF embutidos (ex: "62 INFORMATIVO DE JURISPRUDÊNCIA MARÇO 2026")
    for h_re in cfg.get("header_re", []):
        ementa = h_re.sub(' ', ementa)
    ementa = re.sub(r'\s+', ' ', ementa).strip()

    # Data: assinatura "Goiânia, DD de MÊS de YYYY" ou ano do nome do arquivo
    data = _parse_date_tjgo_sig(chunk)
    if not data:
        ym = re.search(r'((?:19|20)\d{2})', Path(filename).stem)
        data = f"{ym.group(1)}-01-01" if ym else None

    area = classify_area(ementa[:300])

    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    return {
        "_id":            f"tjgo-{processo}",
        "tribunal":       "TJGO",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def _parse_date_tjes(raw: str) -> Optional[str]:
    """Converte DD/MM/YYYY ou DD/Mon/YYYY para YYYY-MM-DD."""
    m = re.match(r'(\d{1,2})/(\d{2})/(\d{4})', raw.strip())
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.match(r'(\d{1,2})/([A-Za-z]{3})/(\d{4})', raw.strip())
    if m:
        d, mon, y = m.groups()
        mo = _MESES_EN_ABBR.get(mon.lower())
        return f"{y}-{mo}-{int(d):02d}" if mo else f"{y}-01-01"
    return None


def _fix_doubled_text(text: str) -> str:
    """Corrige artefato de extração PDF onde cada caractere aparece duplicado.

    Ex: TTRRIIBBUUNNAALL DDEE JJUUSSTTIIÇÇAA → TRIBUNAL DE JUSTIÇA
    """
    def _undouble(m: re.Match) -> str:
        s = m.group(0)
        if len(s) % 2 == 0 and all(s[i] == s[i + 1] for i in range(0, len(s), 2)):
            return s[::2]
        return s
    return re.sub(r'[A-Z\xc0-\xd6\xd8-\xde]{4,}', _undouble, text)


_TJES_SUMARIO_RE = re.compile(
    r'(?:'
    r'\.{3,}\s*\d{1,3}'                                           # "......130"
    r'|[A-Z\xc0-\xd6\xd8-\xde]{4,}[A-Z\xc0-\xd6\xd8-\xde\s–\-]{0,80}'
    r'\s+\d{2,3}(?=\s+[A-Z\xc0-\xd6\xd8-\xde])'                 # "TRIBUTÁRIO 142 IMPOSTO"
    r')',
)


def _tjes_trim_front_matter(text: str) -> str:
    """Remove o sumário/índice/capa que precede as decisões no texto V1 TJES.

    Localiza o último padrão de sumário (entrada com número de página) na
    região ANTES da primeira citação e descarta tudo antes dele.
    """
    first_cit = _TJES_V1_CIT_RE.search(text)
    if not first_cit:
        return text
    pre = text[:first_cit.start()]
    last_end = 0
    for m in _TJES_SUMARIO_RE.finditer(pre):
        last_end = m.end()
    if last_end > 0:
        text = text[last_end:].lstrip()
    return text


def _tjes_trim_body_front_matter(body: str) -> str:
    """Remove capa/composição/sumário do início de um body V2 (texto já flattened).

    Usado no primeiro chunk V2, cujo body contém todo o front matter antes da
    primeira decisão propriamente dita.
    """
    last_end = 0
    for m in _TJES_SUMARIO_RE.finditer(body):
        last_end = m.end()
    if last_end > 0:
        body = body[last_end:].lstrip()
    return body


_TJES_AREA_KW = (
    r'(?:ADMINISTRATIVO|TRIBUT[AÁ]RIO|CRIMINAL|CIVIL|CONSUMIDOR|'
    r'CONSTITUCIONAL|PREVIDENCI[AÁ]RIO|FAM[IÍ]LIA|TRABALHISTA|'
    r'AMBIENTAL|COMERCIAL|ELEITORAL|PROCESSO|DIREITO)'
)


def _extract_ementa_tjes(body: str) -> str:
    """Extrai ementa de um chunk TJES (V1 ou V2).

    Após _process_file_tjes remover o bulk do front matter, ainda podem restar
    fragmentos de sumário no início do body (cauda do último entry de índice).
    Esta função remove esses resíduos antes de retornar a ementa.
    """
    body = _fix_doubled_text(body)

    # Prefixo "EMENTA:" explícito → toma tudo depois da ÚLTIMA ocorrência
    em_matches = list(re.finditer(r'\bEMENTA\s*:\s*', body, re.IGNORECASE))
    if em_matches:
        candidate = body[em_matches[-1].end():].strip()
    else:
        candidate = body.strip()

        # 1. Remove entradas de sumário completas com número de página inline
        #    Ex: "ATOS ADMINISTRATIVOS – AUTO DE INFRAÇÃO – LEI ANTERIOR. 96 "
        #    Apenas se o trecho for todo maiúsculas (sem letras minúsculas).
        for _ in range(8):
            m = re.match(
                r'^[A-Z\xc0-\xd6\xd8-\xde][A-Z\xc0-\xd6\xd8-\xde\s–\-]{3,500}'
                r'(?:\.\s*)?\d{2,3}\s+',
                candidate, re.DOTALL,
            )
            if not m or re.search(r'[a-z\xdf-\xf6\xf8-\xff]', m.group(0)):
                break
            candidate = candidate[m.end():].strip()

        # 2. Remove fragmentos terminando com ". AREA_KW" (linhas de sumário residuais)
        for _ in range(6):
            m = re.match(
                r'^\S.{1,300}?\.\s+(?=' + _TJES_AREA_KW + r'\b)',
                candidate, re.DOTALL | re.IGNORECASE,
            )
            if not m:
                break
            candidate = candidate[m.end():].strip()

        # 3. Remove cabeçalho de seção: "ADMINISTRATIVO" ou "ADMINISTRATIVO ATOS ADMINISTRATIVOS"
        #    Apenas palavras totalmente maiúsculas — não inclui traços para não devorar a ementa.
        candidate = re.sub(
            r'^' + _TJES_AREA_KW +
            r'(?:\s+[A-Z\xc0-\xd6\xd8-\xde]{4,}(?:\s+[A-Z\xc0-\xd6\xd8-\xde]{4,})*)?\s+',
            '', candidate, flags=re.IGNORECASE,
        ).strip()

        # 4. Remove fragmento all-uppercase restante terminando com ponto
        #    Ex: "NORMATIVOS – LEI E DECRETO ANTERIORES. "
        m = re.match(
            r'^[A-Z\xc0-\xd6\xd8-\xde][A-Z\xc0-\xd6\xd8-\xde\s–\-]{3,400}\.\s+',
            candidate, re.DOTALL,
        )
        if m and not re.search(r'[a-z\xdf-\xf6\xf8-\xff]', m.group(0)):
            candidate = candidate[m.end():].strip()

        # 5. Remove fragmento iniciado por traço (continuação de entrada de sumário)
        #    Ex: "– AUTO DE INFRAÇÃO – FUNDAMENTOS NORMATIVOS – LEI E DECRETO ANTERIORES. "
        m = re.match(
            r'^[–\-]\s*[A-Z\xc0-\xd6\xd8-\xde][A-Z\xc0-\xd6\xd8-\xde\s–\-]{0,400}\.\s+',
            candidate, re.DOTALL,
        )
        if m and not re.search(r'[a-z\xdf-\xf6\xf8-\xff]', m.group(0)):
            candidate = candidate[m.end():].strip()

    # Remove artefatos de rodapé/cabeçalho de página ao final
    candidate = re.sub(
        r'\s+TRIBUNAL\s+DE\s+JUSTI[ÇC]A[^\n]{0,80}$', '', candidate,
        flags=re.IGNORECASE,
    ).strip()
    candidate = re.sub(r'\s*[~•]\s*\d+\s*[~•]\s*$', '', candidate).strip()

    return re.sub(r'\s+', ' ', candidate).strip()


def parse_fields_tjes(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJES (suporta formato V1 2020-2023 e V2 2024)."""
    # ── Tenta V1: citação no FIM (2020-2023) ─────────────────────────────────
    m = _TJES_V1_DETAIL_RE.search(chunk)
    if m:
        tipo     = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
        numero   = m.group("numero")
        relator_raw = re.sub(r'\s+', ' ', m.group("relator")).strip()
        # Remove prefixo honorífico e sufixo "– Desembargador Substituto: ..."
        relator_raw = re.sub(r'\s*[–\-]\s*Desembargador\b.*', '', relator_raw, flags=re.IGNORECASE)
        relator_raw = re.sub(r'\s*[–\-]\s*Relator\s+Substituto\s*:.*', '', relator_raw, flags=re.IGNORECASE)
        relator_raw = re.sub(
            r'^(?:Des(?:embargador[ao]?|[aª])?\s*\.?\s+)',
            '', relator_raw, flags=re.IGNORECASE,
        ).strip()
        relator  = relator_raw.title()
        orgao    = re.sub(r'\s+', ' ', m.group("orgao")).strip()
        orgao    = re.sub(r'CÍVEIS(?=[A-Z])', 'CÍVEIS ', orgao)
        data     = _parse_date_tjes(m.group("data"))
        body     = chunk[:m.start()].strip()
        ementa   = _extract_ementa_tjes(body)
        area     = classify_area(ementa[:300])
        min_len  = cfg.get("min_ementa_len", 0)
        if min_len and len(ementa) < min_len:
            return None
        return {
            "_id":            f"tjes-{numero}",
            "tribunal":       "TJES",
            "tipo":           tipo,
            "numero":         numero,
            "relator":        relator,
            "orgaoJulgador":  orgao,
            "dataJulgamento": data,
            "area":           area,
            "secao":          orgao[:40],
            "fonte":          Path(filename).name,
            "ementa":         ementa,
        }

    # ── Tenta V2: bloco de metadados no FIM (2024) ───────────────────────────
    m = _TJES_V2_META_RE.search(chunk)
    if m:
        tipo    = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
        numero  = m.group("numero")
        relator = re.sub(r'\s+', ' ', m.group("relator")).strip().title()
        orgao   = re.sub(r'\s+', ' ', m.group("orgao")).strip()
        data    = _parse_date_tjes(m.group("data"))
        body    = chunk[:m.start()].strip()
        ementa  = _extract_ementa_tjes(body)
        area    = classify_area(ementa[:300])
        min_len = cfg.get("min_ementa_len", 0)
        if min_len and len(ementa) < min_len:
            return None
        return {
            "_id":            f"tjes-{numero}",
            "tribunal":       "TJES",
            "tipo":           tipo,
            "numero":         numero,
            "relator":        relator,
            "orgaoJulgador":  orgao,
            "dataJulgamento": data,
            "area":           area,
            "secao":          orgao[:40],
            "fonte":          Path(filename).name,
            "ementa":         ementa,
        }

    return None


def _process_file_tjes(f: Path, cfg: dict) -> list[str]:
    """Pipeline de extração TJES: suporta V1 (2020-2023) e V2 (2024)."""
    raw = extract_text_pdf_plumber(f)

    # Corrige artefato de texto duplicado antes de aplicar os header_re
    raw = _fix_doubled_text(raw)
    # Corrige artefato de layout de coluna: "A DMINIS TR ATIVO" → "ADMINISTRATIVO"
    raw = re.sub(r'\bA\s+DMINIS\s+TR\s+ATIVO\b', 'ADMINISTRATIVO', raw, flags=re.IGNORECASE)

    # Remove cabeçalhos e rodapés por página (antes do flatten)
    for hre in cfg.get("header_re", []):
        raw = hre.sub('\n', raw)

    # Detecta formato V2 (2024): presença de bloco Magistrado:/Número:
    is_v2 = bool(_TJES_V2_META_RE.search(raw))

    if is_v2:
        chunks: list[str] = []
        seen: set[str] = set()
        pos = 0
        is_first = True
        for mm in _TJES_V2_META_RE.finditer(raw):
            body = raw[pos:mm.start()].strip()
            meta = mm.group(0)
            pos  = mm.end()
            body = re.sub(r'\s+', ' ', body).strip()
            if is_first:
                # Primeiro chunk contém capa + composição + sumário antes da 1ª decisão
                body = _tjes_trim_body_front_matter(body)
                is_first = False
            if len(body) < 100:
                continue
            key = mm.group("numero")
            if key not in seen:
                chunks.append(body + "\n" + meta)
                seen.add(key)
        return chunks

    # V1: flatten → remove front matter → split por citação
    text = raw.replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)
    if cfg.get("hyphen_rejoin"):
        text = re.sub(r'([A-Za-z\xc0-\xff])- ([A-Za-z\xc0-\xff])', r'\1\2', text)
    text = _tjes_trim_front_matter(text)
    return split_decisions(text, _TJES_V1_CIT_RE, skip_trim=True)


def _process_file_tjmg(f: Path, cfg: dict) -> list[str]:
    """Pipeline TJMG: pdfplumber → flatten → strip frente → split por citação."""
    raw = extract_text_pdf_plumber(f)

    # Remove linhas que contêm apenas o número de página (rodapé de cada página)
    raw = re.sub(r'\n\d{1,3}\n', '\n', raw)

    # Flatten completo
    text = raw.replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)
    if cfg.get("hyphen_rejoin"):
        text = re.sub(r'([A-Za-z\xc0-\xff])- ([A-Za-z\xc0-\xff])', r'\1\2', text)

    # Remove tudo antes de "EMENTAS" (capa + sumário)
    em_idx = text.upper().find("EMENTAS")
    if em_idx >= 0:
        text = text[em_idx:]

    return split_decisions(text, _TJMG_CIT_RE, skip_trim=True)


def parse_fields_tjmg(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJMG (citação no FIM do chunk)."""
    detail_re = cfg.get("detail_re")
    if not detail_re:
        return None

    m = detail_re.search(chunk)
    if not m:
        return None

    # Tipo: limpa sufixos abreviados ("-Cv", "-Cr") e title-case
    tipo = re.sub(r'\s+', ' ', m.group("tipo")).strip()
    tipo = re.sub(r'\s*[-–]\s*[A-Z][a-z]?\s*$', '', tipo).strip()
    tipo = tipo.title()

    # Número: remove espaços internos (artefato de quebra de linha em PDF)
    numero = re.sub(r'\s+', '', m.group("numero"))

    # Relator: remove prefixo "Des." residual e aplica title-case
    relator_raw = re.sub(r'\s+', ' ', m.group("relator")).strip()
    relator_raw = re.sub(
        r'^Des(?:embargador[ao]?)?[.ª°]*\s+', '', relator_raw, flags=re.IGNORECASE,
    ).strip()
    relator = relator_raw.title()

    # Órgão julgador
    orgao = re.sub(r'\s+', ' ', m.group("orgao")).strip()

    # Data de julgamento
    data = parse_date_tjac(m.group("data"))

    # Ementa: corpo inteiro antes da citação (sem separar cabeçalho editorial)
    body = chunk[:m.start()].strip()
    ementa = re.sub(r'\s+', ' ', body).strip()
    ementa = re.sub(r'^EMENTAS\s+', '', ementa, flags=re.IGNORECASE)

    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    area = classify_area(ementa[:400])

    # Campos editoriais extraídos do início do body (só para preview — não vão para o ES)
    # Usa o ÚLTIMO "Processo" para descartar contaminação de citações sem traço embutidas
    proc_all = list(re.finditer(r'\bProcesso\b', body, re.IGNORECASE))
    proc_m2 = proc_all[-1] if proc_all else None
    meta_str = body[proc_m2.start():] if proc_m2 else body
    # Limita o meta_str ao trecho antes do primeiro "Ementa:" (se existir)
    em_cut = re.search(r'\bEmenta\s*:', meta_str, re.IGNORECASE)
    if em_cut:
        meta_str = meta_str[:em_cut.start()]
    parts = [p.strip() for p in re.split(r'\s*[-–]\s*', meta_str) if p.strip()]
    processo_tipo = parts[0] if parts else ""
    ramo_direito = ""
    kw_parts: list[str] = []
    for p in parts[1:]:
        if re.match(r'^Direito\b', p, re.IGNORECASE) and not ramo_direito:
            ramo_direito = p
        else:
            kw_parts.append(p)
    palavras_chave = " – ".join(kw_parts)

    return {
        "_id":             f"tjmg-{numero}",
        "tribunal":        "TJMG",
        "tipo":            tipo,
        "numero":          numero,
        "relator":         relator,
        "orgaoJulgador":   orgao,
        "dataJulgamento":  data,
        "area":            area,
        "secao":           orgao[:40],
        "fonte":           Path(filename).name,
        "ementa":          ementa,
        # Preview-only (filtrados no ingest):
        "_processoTipo":   processo_tipo,
        "_ramoDireito":    ramo_direito,
        "_palavrasChave":  palavras_chave,
    }


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
        # Letter-only: preserves digit-hyphen-digit sequences (e.g., process numbers)
        text = re.sub(r"([A-Za-z\xc0-\xff])- ([A-Za-z\xc0-\xff])", r"\1\2", text)
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


def _process_file_tjpa(f: Path, cfg: dict) -> list[str]:
    """Pipeline TJPA: pdfplumber → flatten → split por V1 (ACÓRDÃO N.) ou V2 (citação fim)."""
    raw = extract_text_pdf_plumber(f)
    raw = re.sub(r'\n\d{1,3}\n', '\n', raw)
    text = raw.replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)
    if cfg.get("hyphen_rejoin"):
        text = re.sub(r'([A-Za-z\xc0-\xff])- ([A-Za-z\xc0-\xff])', r'\1\2', text)

    if _TJPA_V1_START_RE.search(text):
        return split_decisions_start(text, _TJPA_V1_START_RE)

    # V2: strip front matter antes do primeiro ID PJE, depois split por citação
    pje_m = _TJPA_PJE_ID_RE.search(text)
    if pje_m:
        text = text[pje_m.start():]
    return split_decisions(text, cfg["citation_re"], skip_trim=True)


def _parse_tjpa_v1(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos de decisão TJPA V1 (2020): campos inline PROCESSO/RELATOR/DATA."""
    proc_m = re.search(r'PROCESSO\s*:\s*(' + _TJPA_PROC_NUM + r')', chunk, re.IGNORECASE)
    if not proc_m:
        return None
    numero = proc_m.group(1).strip()

    acord_m = _TJPA_V1_START_RE.search(chunk)
    after_acord = chunk[acord_m.end():proc_m.start()].strip() if acord_m else ""

    # Órgão: linha que contém TURMA / CÂMARA / SEÇÃO / TRIBUNAL PLENO
    orgao_m = re.search(
        r'\d[ªº°]?\s*(?:TURMA|CÂMARA|SEÇÃO)\s+\w[\w\s]+'
        r'|(?:SEÇÃO|TRIBUNAL PLENO|CÂMARA|CONSELHO)\s+\w[\w\s]+',
        chunk, re.IGNORECASE,
    )
    orgao = re.sub(r'\s+', ' ', orgao_m.group()).strip() if orgao_m else ""
    # Tipo: texto entre ACÓRDÃO N. e PROCESSO: (descontando o órgão se detectado)
    tipo_raw = re.sub(r'\s+', ' ', after_acord).strip()
    if orgao and orgao in tipo_raw:
        tipo_raw = tipo_raw.replace(orgao, '').strip()
    tipo = tipo_raw.title() or "Acórdão"

    rel_m = re.search(r'RELATOR[AE]?\s*:\s*(.+?)(?=\s+EMENTA|\s+DATA\s+DE|\s*$)', chunk, re.IGNORECASE)
    relator = re.sub(r'\s+', ' ', rel_m.group(1)).strip().title() if rel_m else ""

    data_m = re.search(r'DATA\s+DE\s+PUBLICA[ÇC][ÃA]O\s*:\s*(\d{1,2}/\d{1,2}/\d{4})', chunk, re.IGNORECASE)
    data = parse_date_tjac(data_m.group(1)) if data_m else None

    ementa = re.sub(r'\s+', ' ', chunk).strip()
    ementa = re.sub(r'^AC[ÓO]RD[ÃA]O\s+N[°º.]?\s*\d+\s*', '', ementa, flags=re.IGNORECASE)
    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    area = classify_area(ementa[:400])
    return {
        "_id":            f"tjpa-{numero}",
        "tribunal":       "TJPA",
        "tipo":           tipo,
        "numero":         numero,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def parse_fields_tjpa(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJPA (V1 inline ou V2 citação no fim)."""
    cit_re = cfg.get("citation_re")

    # Tenta V2: encontra a ÚLTIMA citação (TJPA –...) no chunk
    if cit_re:
        last_m = None
        for m in cit_re.finditer(chunk):
            last_m = m
        if last_m:
            tipo = re.sub(r'\s+', ' ', last_m.group("tipo")).strip().title()
            numero = last_m.group("numero").strip()
            relator = re.sub(r'\s+', ' ', last_m.group("relator")).strip().title()
            orgao = re.sub(r'\s+', ' ', last_m.group("orgao")).strip()
            data = parse_date_tjac(last_m.group("data"))
            ementa = re.sub(r'\s+', ' ', chunk[:last_m.start()]).strip()
            min_len = cfg.get("min_ementa_len", 0)
            if min_len and len(ementa) < min_len:
                return None
            area = classify_area(ementa[:400])
            return {
                "_id":            f"tjpa-{numero}",
                "tribunal":       "TJPA",
                "tipo":           tipo,
                "numero":         numero,
                "relator":        relator,
                "orgaoJulgador":  orgao,
                "dataJulgamento": data,
                "area":           area,
                "secao":          orgao[:40],
                "fonte":          Path(filename).name,
                "ementa":         ementa,
            }

    # Tenta V1: campos inline
    if _TJPA_V1_START_RE.search(chunk):
        return _parse_tjpa_v1(chunk, filename, cfg)

    return None


def _clean_tjpi_num(raw: str) -> str:
    """Remove espaços e pontos duplos do número de processo TJPI capturado pelo regex."""
    n = re.sub(r'\s+', '', raw)            # remove espaços
    n = re.sub(r'\.{2,}', '.', n)         # normaliza ponto duplo
    return n


def _process_file_tjpi(f: Path, cfg: dict) -> list[str]:
    """Pipeline TJPI: PyMuPDF (sort=True) → limpa sidebar → flatten → split V1|V2."""
    import fitz  # PyMuPDF

    doc = fitz.open(str(f))
    page_texts: list[str] = []
    for pg in doc:
        raw = pg.get_text("text", sort=True)
        # Remove palavras do sidebar vertical (aparecem após 10+ espaços no fim da linha)
        raw = re.sub(r'[ \t]{10,}\S+(?:[ \t]+\S+){0,2}\s*$', ' ', raw, flags=re.MULTILINE)
        # Remove números de página isolados
        raw = re.sub(r'^\s*\d{1,3}\s*$', '', raw, flags=re.MULTILINE)
        page_texts.append(raw)
    doc.close()

    text = '\n'.join(page_texts).replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    # Rejunta palavras hifenizadas no fim de linha
    text = re.sub(r'([A-Za-z\xc0-\xff])- ([A-Za-z\xc0-\xff])', r'\1\2', text)

    return split_decisions(text, _TJPI_SPLIT_RE, skip_trim=True)


def parse_fields_tjpi(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJPI (V1 citação-padrão ou V2 com prefixo TJPI)."""
    last_v1 = None
    for m in _TJPI_V1_CIT_RE.finditer(chunk):
        last_v1 = m

    last_v2 = None
    for m in _TJPI_V2_CIT_RE.finditer(chunk):
        last_v2 = m

    # Usa a citação mais próxima do fim do chunk
    if last_v2 and (not last_v1 or last_v2.start() >= last_v1.start()):
        m = last_v2
        tipo    = re.sub(r'\s+', ' ', m.group('v2_tipo')).strip().title()
        numero  = _clean_tjpi_num(m.group('v2_num'))
        relator = re.sub(r'\s+', ' ', m.group('v2_rel')).strip().title()
        orgao   = re.sub(r'\s+', ' ', m.group('v2_orgao')).strip()
        data    = parse_date_tjac(m.group('v2_data'))
    elif last_v1:
        m = last_v1
        tipo    = re.sub(r'\s+', ' ', m.group('v1_tipo')).strip().title()
        numero  = _clean_tjpi_num(m.group('v1_num'))
        relator = re.sub(r'\s+', ' ', m.group('v1_rel')).strip().title()
        orgao   = re.sub(r'\s+', ' ', m.group('v1_orgao')).strip()
        data    = parse_date_tjac(m.group('v1_data'))
    else:
        return None

    # Remove cabeçalho do boletim que entra na primeira decisão de cada PDF
    body = chunk[:m.start()]
    body = re.sub(
        r'^.*?(?=\d{5,9}\s*[-–]\s*\d{2}[.\s]\d{4})',
        '', body, count=1, flags=re.DOTALL,
    )
    ementa = re.sub(r'\s+', ' ', body).strip()
    # Remove citação secundária da decisão anterior (ex: jun-2025 tem V1+V2 por decisão)
    # Distingue de início normal de ementa: citação tem " - ORGAO" após número, ementa tem "."
    ementa = re.sub(
        r'^\d{5,9}[-–\s.]{1,4}\d{2}[.\s]{1,3}\d{4,5}[.\s]\d[.\s]\d{2}[.\s]\d{1,5}\s*[-–]\s*[^)]+\)\s*',
        '', ementa,
    )
    # Remove número do processo do início da ementa (ex: "0000023-53.2016.8.18.0051. TEXTO...")
    ementa = re.sub(
        r'^\d{5,9}[-–\s.]{1,4}\d{2}[.\s]{1,3}\d{4,5}[.\s]\d[.\s]\d{2}[.\s]\d{1,5}[.\s]+',
        '', ementa,
    )
    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    area = classify_area(ementa[:400])
    return {
        "_id":            f"tjpi-{numero}",
        "tribunal":       "TJPI",
        "tipo":           tipo,
        "numero":         numero,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def parse_fields_tjrn(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJRN (citação no fim, número 8.20)."""
    flat = re.sub(r'\s+', ' ', chunk).strip()

    # Última citação com número TJRN (8.20)
    last_m = None
    for m in _TJRN_SPLIT_RE.finditer(flat):
        last_m = m
    if not last_m:
        return None

    cit_inner = last_m.group()[1:-1].strip()

    # Número do processo
    num_m = re.search(_TJRN_PROC_NUM, cit_inner, re.IGNORECASE)
    if not num_m:
        return None
    numero = re.sub(r'\s+', '', num_m.group())

    before_num = cit_inner[:num_m.start()].strip()
    after_num  = cit_inner[num_m.end():].strip()

    # Tipo: texto antes do número, remove prefixo "TJRN –" e sufixo "Nº/n."
    before_num = re.sub(r'^TJRN\s*[-–]\s*', '', before_num, flags=re.IGNORECASE).strip()
    tipo = re.sub(r'[,;]?\s*N[ºo°.]?\s*$', '', before_num, flags=re.IGNORECASE).strip().rstrip(',;')
    if not tipo:
        tipo = 'ACÓRDÃO'

    # Data (âncora mais confiável)
    data_m = (
        re.search(r'(?:JULGADO|ASSINADO|julg\.?|j\.)\s+em\s+(\d{1,2}/\d{1,2}/\d{2,4})',
                  cit_inner, re.IGNORECASE)
        or re.search(r'sess[aã]o\s+\S+\s+de\s+(\d{1,2}/\d{1,2}/\d{2,4})', cit_inner, re.IGNORECASE)
        or re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', cit_inner)
    )
    data_raw = data_m.group(1) if data_m else ''
    # Expande ano de 2 dígitos (ex: 25/01/23 → 25/01/2023)
    data_raw = re.sub(r'/(\d{2})$', lambda m: f'/20{m.group(1)}', data_raw)
    data = parse_date_tjac(data_raw)

    # Região entre número e data — contém relator e órgão
    region = cit_inner[num_m.end(): data_m.start()] if data_m else after_num[:300]

    # Órgão julgador (nome institucional conhecido)
    orgao_m = re.search(
        r'(Tribunal\s+Pleno|Se[çc][aã]o\s+C[íi]vel|Se[çc][aã]o\s+Criminal|'
        r'Câmara\s+Criminal|[123][ªa]\s+Câmara\s+C[íi]vel|[123][ªa]\s+Câmara\s+Criminal|'
        r'[123ºo]?[ªa]?\s*Turma\s+Recursal)',
        region, re.IGNORECASE,
    )
    orgao = orgao_m.group(1).strip() if orgao_m else ''

    # Relator
    rel_region = region[:orgao_m.start()] if orgao_m else region
    rel_m = re.search(
        r'(?:Rel(?:ator[ae]?)?\.?\s+)?'
        r'(?:Des(?:embargador[ao]?)?[aª]?\.?\s*|Des[aª]?\.?\s*|Dr\.?\s*|'
        r'Ju[íi]z[ao]?(?:\s+Convocad[ao]?)?\s+)?'
        r'([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ]+(?:\s+[A-Za-záéíóúàâêôãõçÀ-ÿA-Z.]+){1,6}?)'
        r'(?:\s+substituindo\b.+)?'
        r'\s*[,\-–]',
        rel_region, re.IGNORECASE,
    )
    if not rel_m:
        # fallback: primeiro nome capitalizado
        rel_m = re.search(
            r'[,\s]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ]+(?:\s+[A-Za-záéíóúàâêôãõçÀ-ÿA-Z]+){1,4})',
            rel_region,
        )
    relator = re.sub(r'\s+', ' ', rel_m.group(1)).strip() if rel_m else ''

    # Ementa = tudo antes da citação
    ementa = re.sub(r'\s+', ' ', flat[:last_m.start()]).strip()

    # Primeira decisão de cada PDF pode ter preamble (capa, sumário, lista de desembargadores).
    # Detecta início real do conteúdo pelo primeiro ramo jurídico + separador.
    area_m = re.search(
        r'(?:Penal|Processual|Constitucional|Administrativo|Civil|Criminal|Tributár)\b',
        ementa, re.IGNORECASE,
    )
    if area_m and area_m.start() > 80:
        ementa = ementa[area_m.start():]

    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    area = classify_area(ementa[:500])
    return {
        "_id":            f"tjrn-{re.sub(r'[^0-9]', '', numero)}",
        "tribunal":       "TJRN",
        "tipo":           re.sub(r'\s+', ' ', tipo).strip().title(),
        "numero":         numero,
        "relator":        relator.title() if relator else '',
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def _process_file_tjrr(f: Path, cfg: dict) -> list[str]:
    """Pipeline TJRR: PyMuPDF words-extraction por página, split no marcador PROCESSO.

    Usa get_text("words") em vez de get_text("text") para evitar artefatos de
    character-tracking nos PDFs do TJRR (espaços inseridos dentro de palavras).
    """
    import fitz

    doc = fitz.open(str(f))
    pages = []
    for pg in doc:
        text = pg.get_text("text", sort=True)
        tokens = text.split()
        # Detecta artefato de character-tracking largo: >20% dos tokens têm 1-2 letras isoladas.
        # Quando detectado, usa get_text("words") que extrai palavras como unidades e evita o artefato.
        short_ratio = (
            sum(1 for t in tokens if 1 <= len(t) <= 2 and t.isalpha()) / len(tokens)
            if tokens else 0
        )
        if short_ratio > 0.20:
            words = pg.get_text("words", sort=True)
            pages.append(' '.join(w[4] for w in words) if words else text)
        else:
            pages.append(text)
    doc.close()

    full = '\n'.join(pages)

    # sort=True cola texto de colunas adjacentes: garante espaços em torno de PROCESSO
    full = re.sub(r'(\S)PROCESSO', r'\1 PROCESSO', full)
    full = re.sub(r'PROCESSO(\S)', r'PROCESSO \1', full)

    # sort=True nas edições trimestrais/inaugurais parte o número CNJ ao meio:
    # "9000312- PROCESSO 06.2020.8.23.0000" → "9000312-06.2020.8.23.0000 PROCESSO"
    full = re.sub(
        r'(\d{7})\s*[-–]\s*PROCESSO\s+(\d{2}\.?\s*\d{4}\.8\.23\.\d{4})',
        r'\1-\2 PROCESSO',
        full,
    )

    # Remove cabeçalhos de página recorrentes em três etapas distintas.
    # Não usa [^\n]* para não consumir conteúdo útil em páginas words-mode (sem newlines).
    # "Informativo de Jurisprudência [Edição X] [Boa Vista, DD de mês de YYYY]"
    full = re.sub(
        r'Informativo\s+de\s*\n?\s*Jurisprud[êe]ncia\b',
        ' ', full, flags=re.IGNORECASE,
    )
    full = re.sub(
        r'Edi[çc][aã]o\s+(?:n\.\s*\d+|Inaugural)\b',
        ' ', full, flags=re.IGNORECASE,
    )
    full = re.sub(
        r'Boa\s+Vista[/,]?\s*RR?,?\s*\d+\s+de\s+\w+\s+de\s+20\d{2}',
        ' ', full, flags=re.IGNORECASE,
    )

    # Flatten
    text = re.sub(r'\s+', ' ', full).strip()

    # Divide no marcador PROCESSO
    parts = re.split(r'\bPROCESSO\b', text)

    chunks = []
    for i in range(1, len(parts)):
        # tail do chunk anterior pode conter tipo+número+relator (edições mensais)
        prev_tail = parts[i - 1][-600:] if len(parts[i - 1]) > 600 else parts[i - 1]
        curr = parts[i].strip()
        # Não reintroduz PROCESSO no chunk — evita contaminação no campo relator
        chunk = re.sub(r'\s+', ' ', prev_tail + ' ' + curr).strip()
        if _TJRR_PROC_NUM_RE.search(chunk):
            chunks.append(chunk)

    return chunks


def parse_fields_tjrr(chunk: str, filename: str, cfg: dict) -> Optional[dict]:
    """Extrai campos ES de decisão TJRR (marcador PROCESSO + DESTAQUE como ementa)."""
    text = re.sub(r'\s+', ' ', chunk).strip()

    # Número TJRR (8.23)
    num_m = _TJRR_PROC_NUM_RE.search(text)
    if not num_m:
        return None
    numero = re.sub(r'\s+', '', num_m.group())

    # Tipo: último candidato válido (palavra-chave processual) nos últimos 250 chars antes do número
    # Restringe a janela ao fim de before_clean para não capturar palavras da decisão anterior
    before_num = text[:num_m.start()]
    before_clean = re.sub(r'\s*n[°º.]\s*$', '', before_num, flags=re.IGNORECASE).rstrip()
    before_tail = before_clean[-250:] if len(before_clean) > 250 else before_clean
    tipo_candidates = list(_TJRR_TIPO_RE.finditer(before_tail))
    tipo = tipo_candidates[-1].group().strip() if tipo_candidates else 'ACÓRDÃO'

    # Região pós-número (relator, órgão, data)
    after = text[num_m.end(): num_m.end() + 600].strip().lstrip('.,')

    data_m = re.search(r'julgado\s+em\s+(\d{1,2}/\d{1,2}/\d{4})', after, re.IGNORECASE)
    data_raw = data_m.group(1) if data_m else ''
    data = parse_date_tjac(data_raw)

    region = after[:data_m.start()] if data_m else after[:300]

    orgao_m = re.search(
        r'(Tribunal\s+Pleno|Câmaras?\s+Reunidas|'
        r'(?:Câmara|Turma)\s+(?:C[íi]vel|Criminal|Recursal)|'
        r'(?:Primeira|Segunda|1[ªa]|2[ªa])\s+Turma\s+C[íi]vel)',
        region, re.IGNORECASE,
    )
    orgao = orgao_m.group(1).strip() if orgao_m else ''

    rel_region = region[:orgao_m.start()] if orgao_m else region
    rel_m = re.search(
        r'(?:[,.]?\s*)?(?:Rel\.\s+)?'
        r'(?:Des(?:embargador[ao]?)?[aª]?\.?\s*|Des[aª]?\.?\s*|Ju[íi]z[ao]?(?:\s+de\s+Direito)?\s*)?'
        r'([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ]+(?:\s+[A-Za-záéíóúàâêôãõçÀ-ÿA-Z]+){1,5})',
        rel_region, re.IGNORECASE,
    )
    relator = re.sub(r'\s+', ' ', rel_m.group(1)).strip() if rel_m else ''

    # Área: RAMO DO DIREITO
    ramo_m = re.search(
        r'RAMO\s+DO\s+DIREITO\s+([^T]+?)(?=\s+TEMA\b|\s+DESTAQUE\b|\s+INFORMA)',
        text, re.IGNORECASE,
    )
    ramo_text = re.sub(r'\s+', ' ', ramo_m.group(1)).strip() if ramo_m else ''

    # Ementa: DESTAQUE + INFORMAÇÕES DO INTEIRO TEOR (texto completo da decisão)
    destaque_m = re.search(r'\bDESTAQUE\s+', text, re.IGNORECASE)
    inteiro_m  = re.search(r'\bINFORMA[ÇC][ÕO]ES\s+DO\s+INTEIRO\s+TEOR\s+', text, re.IGNORECASE)

    if destaque_m and inteiro_m and inteiro_m.start() > destaque_m.start():
        # Destaque: do marcador até INFORMAÇÕES DO INTEIRO TEOR
        destaque_text = re.sub(r'\s+', ' ', text[destaque_m.end(): inteiro_m.start()]).strip()
        # Inteiro teor: do marcador até o próximo marcador ou fim
        inteiro_end = len(text)
        for end_m in re.finditer(r'\bINFORMA[ÇC][ÕO]ES\s+CORRELATAS\b', text, re.IGNORECASE):
            if end_m.start() > inteiro_m.start():
                inteiro_end = end_m.start()
                break
        inteiro_text = re.sub(r'\s+', ' ', text[inteiro_m.end(): inteiro_end]).strip()
        ementa = (destaque_text + ' ' + inteiro_text).strip()
    elif destaque_m:
        ementa = re.sub(r'\s+', ' ', text[destaque_m.end():]).strip()
    else:
        # Fallback: texto entre TEMA e INFORMAÇÕES
        tema_m = re.search(r'\bTEMA\s+\d*\s+(.+?)(?=\s+INFORMA[ÇC][ÕO]ES|\Z)', text, re.IGNORECASE | re.DOTALL)
        ementa = re.sub(r'\s+', ' ', tema_m.group(1)).strip() if tema_m else ''

    # Remove artefato de cabeçalho de página que escapa do cleanup
    ementa = re.sub(r'^\s*Informativo(?:\s+de\s+Jurisprud[êe]ncia)?\s*', '', ementa, flags=re.IGNORECASE).strip()

    min_len = cfg.get("min_ementa_len", 0)
    if min_len and len(ementa) < min_len:
        return None

    area = classify_area(ramo_text + ' ' + ementa[:300])
    return {
        "_id":            f"tjrr-{re.sub(r'[^0-9]', '', numero)}",
        "tribunal":       "TJRR",
        "tipo":           tipo.title(),
        "numero":         numero,
        "relator":        relator.title() if relator else '',
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          ramo_text[:40] or orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def process_file(f: Path, cfg: dict) -> list[str]:
    if cfg.get("parse_fn") == "tjpi":
        return _process_file_tjpi(f, cfg)
    if cfg.get("parse_fn") == "tjrr":
        return _process_file_tjrr(f, cfg)
    if cfg.get("parse_fn") == "tjpa":
        return _process_file_tjpa(f, cfg)
    if cfg.get("parse_fn") == "tjmg":
        return _process_file_tjmg(f, cfg)
    if cfg.get("parse_fn") == "tjes":
        return _process_file_tjes(f, cfg)
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
    if cfg.get("dual_format"):
        v1 = split_decisions(text, cfg["citation_re"], skip_trim=cfg.get("skip_trim", False))
        v2 = split_decisions_start(text, cfg["citation_re_v2"])
        return v1 if len(v1) >= len(v2) else v2
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
            "tjgo":  parse_fields_tjgo,
            "tjmg":  parse_fields_tjmg,
            "tjes":  parse_fields_tjes,
            "tjpa":  parse_fields_tjpa,
            "tjpi":  parse_fields_tjpi,
            "tjrn":  parse_fields_tjrn,
            "tjrr":  parse_fields_tjrr,
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
                if fld.get('_processoTipo'):
                    out.write(f"      processoTipo : {fld['_processoTipo']}\n")
                if fld.get('_ramoDireito'):
                    out.write(f"      ramoDireito  : {fld['_ramoDireito']}\n")
                if fld.get('_palavrasChave'):
                    out.write(f"      palavrasChave: {fld['_palavrasChave']}\n")
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
