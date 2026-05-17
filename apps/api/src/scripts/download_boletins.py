#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download de Boletins de Jurisprudência de TJs e TRTs (2020+).

Dois modos de coleta:
  html_parse — extrai todos os links .pdf do HTML da página de listagem
  dspace     — navega coleção DSpace via HTML paginado

Portais SPA (Angular/Vue/Liferay+React) normalmente retornam 0 PDFs;
o script avisa e pula. Esses tribunais precisam de investigação manual.

Uso:
    python download_boletins.py                          # todos os 22
    python download_boletins.py --tribunal tjmg          # só TJMG
    python download_boletins.py --dry-run                # lista sem baixar
    python download_boletins.py --reset --tribunal trt3  # recomeça do zero
    python download_boletins.py --output e:/judicore/temp/boletins
"""

import argparse
import io
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Força UTF-8 no stdout para não quebrar em terminais Windows (cp1252)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Caminhos ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
DEFAULT_OUTPUT = PROJECT_ROOT / "temp" / "boletins"
CHECKPOINT_FILE = SCRIPT_DIR / "download_boletins_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "download_boletins.log"

YEAR_FROM = 2020
REQUEST_DELAY = 2.5   # segundos entre requests à mesma origem

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
}

# ── Configuração dos tribunais ─────────────────────────────────────────────────
#
# strategy: "html_parse" | "dspace"
#   html_parse — GET cada URL em "pages" e extrai todos os hrefs com .pdf
#   dspace     — pagina a coleção DSpace e baixa bitstreams PDF de cada item
#
# pages       — lista de URLs a varrer (html_parse)
# base_url    — prefixo para resolver hrefs relativos (padrão: origem da página)
# dspace_base — URL base da instância DSpace
# collection_handle — handle da coleção (ex: "11103/12")
# ──────────────────────────────────────────────────────────────────────────────

TRIBUNAIS: dict[str, dict] = {
    # ── TJs ───────────────────────────────────────────────────────────────────
    "tjmg": {
        "name": "TJMG",
        "strategy": "html_parse",
        # LumisXP — conteúdo pode ser dinâmico; tenta mesmo assim
        "pages": ["https://www.tjmg.jus.br/portal-tjmg/jurisprudencia/boletim-de-jurisprudencia/"],
    },
    "tjrs": {
        "name": "TJRS",
        "strategy": "html_parse",
        # WordPress — BEE (Boletim Eletrônico de Ementas), quinzenal desde 2008
        "pages": ["https://www.tjrs.jus.br/novo/jurisprudencia-e-legislacao/jurisprudencia/boletim-eletronico-de-ementas/"],
        "url_filter": r"(?:BEE|boletim.elet|ementas?)",
    },
    "tjsp": {
        "name": "TJSP",
        "strategy": "html_parse",
        # ASP.NET — Revista Eletrônica de Jurisprudência (eJTJ), bimensal
        # TODO: PDFs do eJTJ não estão linkados diretamente na listagem; investigar manualmente
        "pages": ["https://www.tjsp.jus.br/Biblioteca/RevistaJurisprudencia/Revistas"],
        "url_filter": r"[Ee][Jj][Tt][Jj]",
    },
    "tjrj": {
        "name": "TJRJ",
        "strategy": "html_parse",
        # EJURIS — Ementário de Jurisprudência, acervo desde 1975
        "pages": ["https://www.tjrj.jus.br/web/portal-conhecimento/ementario"],
    },
    "tjpr": {
        "name": "TJPR",
        "strategy": "html_parse",
        # Liferay — 48 PDFs encontrados no HTML estático, trimestral desde 2013
        "pages": ["https://www.tjpr.jus.br/publicacoes-jurisprudenciais"],
        "base_url": "https://www.tjpr.jus.br",
    },
    "tjpe": {
        "name": "TJPE",
        "strategy": "html_parse",
        # Liferay + React — pode não retornar PDFs (carregamento dinâmico)
        "pages": ["https://portal.tjpe.jus.br/web/jurisprudencia/informativo-de-jurisprudencia"],
    },
    "tjmt": {
        "name": "TJMT",
        "strategy": "html_parse",
        # Angular SPA — provavelmente retornará 0 PDFs; investigar API backend
        "pages": ["https://jurisprudencia.tjmt.jus.br/"],
    },
    "tjpa": {
        "name": "TJPA",
        # SSL handshake incompatível com Python requests — usa curl -k para download
        # URLs extraídas do HTML da página CMSPortal (PDF apenas, sem RTF)
        "strategy": "direct_urls",
        "use_curl": True,
        "url_filenames": {
            # 2026
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2270765": "informativo_2026_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2268843": "informativo_2026_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2266020": "informativo_2026_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2263886": "informativo_2026_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2259640": "informativo_2026_01.pdf",
            # 2025
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2245725": "informativo_2025_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2237627": "informativo_2025_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2218626": "informativo_2025_10.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2196725": "informativo_2025_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2177668": "informativo_2025_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2151711": "informativo_2025_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2124664": "informativo_2025_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2075626": "informativo_2025_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2043614": "informativo_2025_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1994645": "informativo_2025_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2047617": "informativo_2025_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=2047623": "informativo_2025_01.pdf",
            # 2024
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1764616": "informativo_2024_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1749625": "informativo_2024_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1726863": "informativo_2024_10.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1714613": "informativo_2024_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1675635": "informativo_2024_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1657618": "informativo_2024_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1624642": "informativo_2024_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1598688": "informativo_2024_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1571627": "informativo_2024_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1551742": "informativo_2024_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1523600": "informativo_2024_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1500605": "informativo_2024_01.pdf",
            # 2023
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1488186": "informativo_2023_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1480735": "informativo_2023_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1460623": "informativo_2023_10.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1441623": "informativo_2023_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1416561": "informativo_2023_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1389570": "informativo_2023_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1362593": "informativo_2023_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1362585": "informativo_2023_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1361611": "informativo_2023_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1362546": "informativo_2023_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1361609": "informativo_2023_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1361607": "informativo_2023_01.pdf",
            # 2022
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1369551": "informativo_2022_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1367576": "informativo_2022_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1365582": "informativo_2022_10a.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1365583": "informativo_2022_10b.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1365563": "informativo_2022_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1365572": "informativo_2022_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1364549": "informativo_2022_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1362683": "informativo_2022_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1364545": "informativo_2022_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1364547": "informativo_2022_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1363562": "informativo_2022_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1361577": "informativo_2022_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1363554": "informativo_2022_01.pdf",
            # 2021
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1378554": "informativo_2021_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1379561": "informativo_2021_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1379562": "informativo_2021_10.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1377619": "informativo_2021_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1377579": "informativo_2021_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1376545": "informativo_2021_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1375548": "informativo_2021_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1375545": "informativo_2021_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1373562": "informativo_2021_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1371588": "informativo_2021_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1371583": "informativo_2021_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1371574": "informativo_2021_01.pdf",
            # 2020
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1380644": "informativo_2020_12.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1380657": "informativo_2020_11.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1380659": "informativo_2020_10.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1389580": "informativo_2020_09.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1383551": "informativo_2020_08.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1379565": "informativo_2020_07.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1384547": "informativo_2020_06.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1384545": "informativo_2020_05.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1385545": "informativo_2020_04.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1383550": "informativo_2020_03.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1382574": "informativo_2020_02.pdf",
            "https://www.tjpa.jus.br//CMSPortal/VisualizarArquivo?idArquivo=1379587": "informativo_2020_01.pdf",
        },
    },
    "tjpb": {
        "name": "TJPB",
        "strategy": "html_parse",
        # Liferay — Boletim mensal
        "pages": ["https://www.tjpb.jus.br/servicos/jurisprudencia/boletim-de-jurisprudencia"],
    },
    "tjdft": {
        "name": "TJDFT",
        "strategy": "html_parse",
        # Plone — Informativo quinzenal; filtra só PDFs cujo NOME começa com inf_ ou NNN-inf_
        "pages": ["https://www.tjdft.jus.br/consultas/jurisprudencia/informativos"],
        "url_filter": r"(?:^|/)(?:\d+-)?inf[-_]",
    },
    "tjpi": {
        "name": "TJPI",
        "strategy": "html_parse",
        # Portal próprio — Boletim anual (2021–2025); a página também linka manuais, filtrar
        "pages": ["https://www.tjpi.jus.br/portaltjpi/boletim-de-jurisprudencia/"],
        "url_filter": r"[Bb]oletim",
    },
    "tjac": {
        "name": "TJAC",
        # WordPress — ementários semestrais (TJ) e mensais/semestrais (Câmaras), 2020–
        # URL raiz: https://www.tjac.jus.br/transparencia/relatorios-e-estatisticas/ementario-jurisprudencial/
        "strategy": "direct_urls",
        "url_filenames": {
            # Ementário Tribunal de Justiça
            "https://www.tjac.jus.br/wp-content/uploads/2021/02/Ementario_TJAC_Vol_XIX_2020.pdf":    "tj_2020_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2021/08/Ementario_TJAC_Vol_XX_2020.pdf":     "tj_2020_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2022/01/Ementario_TJAC_Vol_XXI_2021.pdf":    "tj_2021_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2022/03/Ementario_TJAC_Vol_XXII_2021.pdf":   "tj_2021_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2022/08/Ementario_TJAC_Vol_XXIII_2022.pdf":  "tj_2022_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2023/01/Ementario_TJAC_Vol_XXIV_2022.pdf":   "tj_2022_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2024/04/Ementario_TJAC_Vol_XXV_2023.pdf":    "tj_2023_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2024/09/Ementario_TJAC_Vol_XXVI_2023.pdf":   "tj_2023_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/01/Ementario_TJAC_Vol_XXVII_2024.pdf":  "tj_2024_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/04/Ementario_TJAC_Vol_XXVIII_2024.pdf": "tj_2024_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/07/Ementario_TJAC_Vol_XII_2025.pdf":    "tj_2025_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/12/Ementario_TJAC_Vol_XIII_2025.pdf":   "tj_2025_s2.pdf",
            # Ementário Câmaras
            "https://www.tjac.jus.br/wp-content/uploads/2022/08/Ementario_Camaras_TJAC_1ed_2022.pdf":  "camaras_2022_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2023/01/Ementario_Camaras_TJAC_2ed_2022.pdf":  "camaras_2022_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2023/07/Ementario_Camaras_TJAC_3ed_2023.pdf":  "camaras_2023_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2024/12/Ementario_Camaras_TJAC_4ed_2023.pdf":  "camaras_2023_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/01/Ementario_Camaras_TJAC_5ed_2024.pdf":  "camaras_2024_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/01/Ementario_Camaras_TJAC_6ed_2024.pdf":  "camaras_2024_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/07/Ementario_Camaras_TJAC_7ed_2025.pdf":  "camaras_2025_s1.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2025/12/Ementario_Camaras_TJAC_8ed_2025.pdf":  "camaras_2025_s2.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2026/03/Ementario_Camaras_TJAC_9ed_2026.pdf":  "camaras_2026_01.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2026/03/Ementario_Camaras_TJAC_10ed_2026.pdf": "camaras_2026_02.pdf",
            "https://www.tjac.jus.br/wp-content/uploads/2026/04/Ementario_Camaras_TJAC_11ed_2026.pdf": "camaras_2026_03.pdf",
        },
    },
    "tjam": {
        "name": "TJAM",
        "strategy": "html_parse",
        # Joomla — Boletim NUGEPAC, irregular 2021–2025
        "pages": ["https://www.tjam.jus.br/index.php/jurisprudencia"],
    },
    "tjrr": {
        "name": "TJRR",
        # Joomla — Informativo mensal (a partir de nov/2024); edições anteriores inexistentes
        # Fontes mistas: servidor TJRR (2024–2025 Q1/Q2) + Google Drive (2025 out em diante)
        "strategy": "direct_urls",
        "url_filenames": {
            # 2024
            "https://www.tjrr.jus.br/images/CPLJ/Informativo-Jurisprudencia/Informativo_de_Jurisprudncia_N_1_de_11112024.pdf": "informativo_2024_ed1.pdf",
            # 2025
            "https://www.tjrr.jus.br/images/CPLJ/Informativo-Jurisprudencia/2025/INFORMATIVO_DE_JURISPRUDNCIA_TJRR_N_2_-_1_QUADRIMESTRE_DE_2025_.pdf": "informativo_2025_q1.pdf",
            "https://www.tjrr.jus.br/images/CPLJ/Informativo-Jurisprudencia/2025/Informativo_de_Jurisprudencia___2__Quadrimestre_2025___Edicao_n_3.pdf": "informativo_2025_q2.pdf",
            "https://www.tjrr.jus.br/images/CPLJ/Informativo-Jurisprudencia/2025/Informativo_de_Jurisprudencia___Setembro2025___Edicao_n_4___Publicado.pdf": "informativo_2025_09.pdf",
            "https://drive.google.com/uc?export=download&id=1b1oe3CyP6MA4zH1qBfr2jq1o79Loci-d": "informativo_2025_10.pdf",
            "https://drive.google.com/uc?export=download&id=1gF4nezYpZazWyzoO_2o9A-jauUlx0wqQ": "informativo_2025_11.pdf",
            "https://drive.google.com/uc?export=download&id=1oBx6rG1N1T4Myzn4JDq8mHqcMFKwYcyF": "informativo_2025_12.pdf",
            # 2026
            "https://drive.google.com/uc?export=download&id=1HFsYlwMG7e8QRSVjLO8OAslkpqLct0Vp": "informativo_2026_01.pdf",
            "https://drive.google.com/uc?export=download&id=1ix8n_mI1DebkZ2vYFeUOPH9i4nwCG88V": "informativo_2026_02.pdf",
            "https://drive.google.com/uc?export=download&id=1YyXEVMlwc-5TZy73lrINdC9ZBYxrxSif": "informativo_2026_03.pdf",
        },
    },

    "tjdft_edicoes": {
        "name": "TJDFT_EDICOES",
        # Plone — Edições Especiais semestrais; 9ª ed (1º/2023) com URL resolveuid não resolvível externamente
        # Página: https://www.tjdft.jus.br/consultas/jurisprudencia/edicoes-especiais
        "strategy": "direct_urls",
        "url_filenames": {
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2020/edicao-especial-1o-2020-versao-final-publicada.pdf": "edicao_2020_s1.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2021/edicao-especial-2o-2020.pdf":                        "edicao_2020_s2.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2021/edicao-especial-1o-2021.pdf":                        "edicao_2021_s1.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2022/edicao-especial-2o-2021-versao-final.pdf":           "edicao_2021_s2.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2022/edicao-especial-1o-2022-versao-definitiva.pdf":      "edicao_2022_s1.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2023/edicao-especial-2deg-2022.pdf":                      "edicao_2022_s2.pdf",
            # 9ª ed (1º/2023): URL resolveuid interna — TODO: localizar manualmente
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2023/10-edicao-especial-versao-final-publicada.pdf":      "edicao_2023_s2.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/edicoes-especiais/decima-primeira-edicao-especial_-1o-semestre-de-2024.pdf": "edicao_2024_s1.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/edicoes-especiais/inf_-ed-especial-relatores-2024_pdf-3.pdf":      "edicao_2024_retro.pdf",
            "https://www.tjdft.jus.br/consultas/jurisprudencia/arquivos/2026/01-inf_-ed-especial-relatores-2025_pdf_-vf-1-1.pdf": "edicao_2025_retro.pdf",
        },
    },

    "tjsp_gapri": {
        "name": "TJSP_GAPRI",
        # ASP.NET — Boletim de Julgados Selecionados (Câmaras Direito Privado/Empresarial)
        # Página: https://www.tjsp.jus.br/SecaoDireitoPrivado/Gapri/BoletinsJulgadosSelecionados
        # Série inicia em jan/2022 (2020-2021 não disponíveis nessa seção)
        "strategy": "direct_urls",
        "url_filenames": {
            # 2022
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141513": "boletim_2022_01.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141514": "boletim_2022_03.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=142588": "boletim_2022_04.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141515": "boletim_2022_05.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141516": "boletim_2022_06.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=142589": "boletim_2022_07.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141512": "boletim_2022_08.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141511": "boletim_2022_09.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=141509": "boletim_2022_10.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=142689": "boletim_2022_11.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=143061": "boletim_2022_12.pdf",
            # 2023
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=143358": "boletim_2023_01.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=144563": "boletim_2023_02.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=145052": "boletim_2023_03.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=145325": "boletim_2023_04.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=147272": "boletim_2023_05.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=148896": "boletim_2023_06.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=149350": "boletim_2023_07.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=150138": "boletim_2023_08.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=150825": "boletim_2023_09.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=151423": "boletim_2023_10.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=152206": "boletim_2023_11.pdf",
            # 2024
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=153940": "boletim_2024_01.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=155223": "boletim_2024_02.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=155874": "boletim_2024_03.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=156315": "boletim_2024_04.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=158038": "boletim_2024_05.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=159544": "boletim_2024_06.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=160326": "boletim_2024_07.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=162193": "boletim_2024_08.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=163061": "boletim_2024_09.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=163870": "boletim_2024_10.pdf",
            # 2025
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=164798": "boletim_2025_01.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=165765": "boletim_2025_02.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=166468": "boletim_2025_03.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=168580": "boletim_2025_04.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=169413": "boletim_2025_05.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=170055": "boletim_2025_06.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=170905": "boletim_2025_07.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=173072": "boletim_2025_08.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=174129": "boletim_2025_09.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=176695": "boletim_2025_10.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=177324": "boletim_2025_11.pdf",
            # 2026
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=179674": "boletim_2026_01.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=182278": "boletim_2026_02.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=186681": "boletim_2026_03a.pdf",
            "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=186686": "boletim_2026_03b.pdf",
        },
    },

    "tjmg": {
        "name": "TJMG",
        # DSpace 7 REST API — Boletim quinzenal; coleção handle tjmg/6415
        # UUID coleção: c4bd64ae-089d-446c-966f-2ba332a0cbf5
        "strategy": "dspace7",
        "dspace7_base": "https://bd.tjmg.jus.br",
        "collection_uuid": "c4bd64ae-089d-446c-966f-2ba332a0cbf5",
        "num_min": 223,
        "num_max": 373,
    },

    "tjes": {
        "name": "TJES",
        # WordPress — Ementário Trimestral, 4 volumes/ano desde 2020
        # JFM=Q1, AMJ=Q2, JAS=Q3, OND=Q4
        # Página: https://www.tjes.jus.br/publicacoes/revista-jurisprudencia-ementario
        "strategy": "direct_urls",
        "url_filenames": {
            # 2020
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JFM_2020.pdf": "ementario_2020_q1.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_AMJ_2020.pdf": "ementario_2020_q2.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JAS_2020.pdf": "ementario_2020_q3.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_OND_2020.pdf": "ementario_2020_q4.pdf",
            # 2021
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JFM_2021.pdf":  "ementario_2021_q1.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_AMJ_2021.pdf":  "ementario_2021_q2.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JAS_2021_.pdf": "ementario_2021_q3.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_OND_2021.pdf":  "ementario_2021_q4.pdf",
            # 2022
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JFM_2022.pdf": "ementario_2022_q1.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_AMJ_2022.pdf": "ementario_2022_q2.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JAS_2022.pdf": "ementario_2022_q3.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_OND_2022.pdf": "ementario_2022_q4.pdf",
            # 2023
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JFM_2023.pdf": "ementario_2023_q1.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_AMJ_2023.pdf": "ementario_2023_q2.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JAS_2023.pdf": "ementario_2023_q3.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_OND_2023.pdf": "ementario_2023_q4.pdf",
            # 2024
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JFM_2024.pdf": "ementario_2024_q1.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_AMJ_2024.pdf": "ementario_2024_q2.pdf",
            "https://www.tjes.jus.br/wp-content/uploads/Ementario_Trimestral_TJES_JAS_2024.pdf": "ementario_2024_q3.pdf",
        },
    },

    "tjrs": {
        "name": "TJRS",
        # PHP — Boletins em HTML (não PDF); dois formatos conforme número:
        #   229-290: ementario.php?boletim={n}
        #   291-318: boletim_novo.php?boletim={n}
        "strategy": "url_range",
        "skip_magic_check": True,
        "ranges": [
            {
                "url_template": "https://www.tjrs.jus.br/site_php/jprud_boletim/ementario.php?boletim={n}",
                "start": 229,
                "end": 290,
                "ext": "html",
            },
            {
                "url_template": "https://www.tjrs.jus.br/site_php/jprud_boletim/boletim_novo.php?boletim={n}",
                "start": 291,
                "end": 318,
                "ext": "html",
            },
        ],
    },

    "tjba": {
        "name": "TJBA",
        # WordPress — Revista Eletrônica Bahia Forense, anual
        # Página: https://www.tjba.jus.br/portal/revista-bahia-forense/
        "strategy": "direct_urls",
        "url_filenames": {
            "https://www.tjba.jus.br/portal/wp-content/uploads/2020/12/Revista-Eletronica-Bahia-Forense-N.-6-04122020.pdf":          "revista_2020_n6.pdf",
            "https://www.tjba.jus.br/portal/wp-content/uploads/2023/04/Revista-Eletronica-Bahia-Forense-n-52-10042023-1.pdf":        "revista_2023_n52.pdf",
            "https://www.tjba.jus.br/portal/wp-content/uploads/2024/09/Revista-Eletronica-Bahia-Forense-n-53-final-site.pdf":        "revista_2024_n53.pdf",
            "https://www.tjba.jus.br/portal/wp-content/uploads/2025/10/Revista-Eletronica-Bahia-Forense-n-54-FINAL-22-09-2025-WEB.pdf": "revista_2025_n54.pdf",
        },
    },

    "tjrn": {
        "name": "TJRN",
        # CDN assets.tjrn.jus.br — apenas 3 edições disponíveis (2023)
        "strategy": "direct_urls",
        "url_filenames": {
            "https://assets.tjrn.jus.br/tjrn-site/fzthifvahl-20230222informativodotjrnn013.pdf":              "informativo_2023_ed1.pdf",
            "https://assets.tjrn.jus.br/tjrn-site/onqcgjnwio-informativo-de-jurisprudencia-do-tjrn---edicao-2.pdf": "informativo_2023_ed2.pdf",
            "https://assets.tjrn.jus.br/tjrn-site/nxwwzriupl-informativo-de-jurisprudencia-do-tjrn---edicao-3.pdf": "informativo_2023_ed3.pdf",
        },
    },

    "tjce": {
        "name": "TJCE",
        # WordPress — Informativo mensal a partir de ago/2024 (série inédita)
        # Página: https://www.tjce.jus.br/institucional/informativo-de-jurisprudencia/
        "strategy": "direct_urls",
        "url_filenames": {
            "https://portal.tjce.jus.br/uploads/2024/12/Informativo-de-Jurisprudencia-no-1-31.08.2024-final.pdf": "informativo_2024_08.pdf",
            "https://portal.tjce.jus.br/uploads/2025/04/Informativo_de_Jurisprudencia_no_2___09.2024.pdf":        "informativo_2024_09.pdf",
            "https://portal.tjce.jus.br/uploads/2025/04/Informativo_de_Jurisprudencia_no_3___10.2024.pdf":        "informativo_2024_10.pdf",
            "https://portal.tjce.jus.br/uploads/2025/04/Informativo_de_Jurisprudencia_no_4___11.2024.pdf":        "informativo_2024_11.pdf",
            "https://portal.tjce.jus.br/uploads/2025/04/Informativo_de_Jurisprudencia_no_5___12.2024.pdf":        "informativo_2024_12.pdf",
            "https://portal.tjce.jus.br/uploads/2025/06/Informativo-de-Jurisprudencia-no-06-janeiro-de-2025.pdf": "informativo_2025_01.pdf",
            "https://portal.tjce.jus.br/uploads/2025/06/Informativo-de-Jurisprudencia-no-07-fev-2025.pdf":        "informativo_2025_02.pdf",
            "https://portal.tjce.jus.br/uploads/2025/06/Informativo_de_Jurisprudencia_no-08_marco_2025.pdf":      "informativo_2025_03.pdf",
            "https://portal.tjce.jus.br/uploads/2025/06/Informativo_de_Jurisprudencia_no09_abril_2025.pdf":       "informativo_2025_04.pdf",
            "https://portal.tjce.jus.br/uploads/2025/10/Informativo_de_Jurisprudencia_no10_maio_2025.pdf":        "informativo_2025_05.pdf",
            "https://portal.tjce.jus.br/uploads/2025/10/Informativo_de_Jurisprudencia_no11_junho_2025.pdf":       "informativo_2025_06.pdf",
            "https://portal.tjce.jus.br/uploads/2025/10/Informativo_de_Jurisprudencia_no12_julho_2025.pdf":       "informativo_2025_07.pdf",
            "https://portal.tjce.jus.br/uploads/2025/10/Informativo_de_Jurisprudencia_no13_agosto_2025.pdf":      "informativo_2025_08.pdf",
            "https://portal.tjce.jus.br/uploads/2025/11/Informativo-de-Jurisprudencia-no14-setembro-2025-_.pdf":  "informativo_2025_09.pdf",
            "https://portal.tjce.jus.br/uploads/2025/12/7.-Informativo-de-Jurisprudencia-no15-outubro-2025.pdf":  "informativo_2025_10.pdf",
            "https://portal.tjce.jus.br/uploads/2025/12/8.-Informativo-de-Jurisprudencia-no16-novembro-2025-1.pdf": "informativo_2025_11.pdf",
            "https://portal.tjce.jus.br/uploads/2026/02/9.-Informativo-de-Jurisprudencia-no17-dezembro-2025-2.pdf": "informativo_2025_12.pdf",
            "https://portal.tjce.jus.br/uploads/2026/02/10.-Informativo-de-Jurisprudencia-no18-janeiro-2026.pdf":  "informativo_2026_01.pdf",
            "https://portal.tjce.jus.br/uploads/2026/03/11.-Informativo-de-Jurisprudencia-no19-fev-2026.pdf":      "informativo_2026_02.pdf",
            "https://portal.tjce.jus.br/uploads/2026/04/Informativo_de_Jurisprudencia_no20_mar_2026-1-1775582476.pdf": "informativo_2026_03.pdf",
        },
    },

    "tjgo": {
        "name": "TJGO",
        # API JSON paginada — URLs assinadas AWS (TTL 24h), buscadas na hora do download
        # Informativos mensais a partir de dez/2022; API: transparencia-api.tjgo.jus.br
        "strategy": "api_json",
        "api_url": "https://transparencia-api.tjgo.jus.br/api/v1/jurisprudencia/informativos_jurisprudencia",
        "per_page": 100,
        "pdf_field": "arquivoPdfUrl",
        "year_field": "ano",
        "month_field": "mes",
    },

    # ── TRTs ──────────────────────────────────────────────────────────────────
    "trt1": {
        "name": "TRT1",
        "strategy": "html_parse",
        # Liferay — bimestral; biblioteca digital em bibliotecadigital.trt1.jus.br
        "pages": [
            "https://www.trt1.jus.br/boletins-de-jurisprudencia",
            "https://bibliotecadigital.trt1.jus.br/jspui/handle/1001/3",
        ],
        "base_url": "https://bibliotecadigital.trt1.jus.br",
    },
    "trt3": {
        "name": "TRT3",
        # DSpace — Boletim de Legislação e Jurisprudência, mensal
        # Coleção 11103/12 mistura boletins (BOL.LEGIS.JURIS.) e regulamentos; filtrar pelo nome
        "strategy": "dspace",
        "dspace_base": "https://as1.trt3.jus.br/bd-trt3",
        "collection_handle": "11103/12",
        "url_filter": r"BOL[._]LEGIS",
    },
    "trt7": {
        "name": "TRT7",
        # Joomla — semestral; os PDFs não são linkados nas páginas de categoria Joomla,
        # por isso usa direct_urls com as URLs confirmadas (2020-2025 que encontramos).
        "strategy": "direct_urls",
        "urls": [
            "https://www.trt7.jus.br/files/jurisprudencia/boletim_jurisprudencia/2020/BJ_-_2020_-_1_semestre.pdf",
            "https://www.trt7.jus.br/files/jurisprudencia/boletim_jurisprudencia/2020/BJ_2-_2020.pdf",
            "https://www.trt7.jus.br/files/jurisprudencia/boletim_jurisprudencia/2021/BJ_2021_-_1_semestre.pdf",
            "https://www.trt7.jus.br/files/jurisprudencia/boletim_jurisprudencia/2022/BJ_2022_-_1_semestre.pdf",
            "https://www.trt7.jus.br/files/atos_normativos/BJ/BJ%202024%20-%202%20SEMESTRE.pdf",
            "https://www.trt7.jus.br/files/atos_normativos/BJ/BJ%202025%20-%201%20SEMESTRE.pdf",
            # TODO: localizar 2021 S2, 2022 S2, 2023 S1, 2023 S2, 2024 S1
        ],
    },
    "trt11": {
        "name": "TRT11",
        "strategy": "html_parse",
        # Joomla — mensal, PDFs em /images/Boletim_*.pdf; o parâmetro ?id=5244 ativa o conteúdo
        "pages": ["https://portal.trt11.jus.br/index.php/jurisprudencia1-2/precedentes-e-acoes-coletivas?id=5244"],
        "base_url": "https://portal.trt11.jus.br",
        "url_filter": r"/images/(?!arquivos)[^\"]*(?:[Bb]oletim|[Pp]recedente|[Jj]urisp)",
    },
    "trt12": {
        "name": "TRT12",
        "strategy": "html_parse",
        # Drupal 9 — anual desde 2023; sub-página por ano
        "pages": [
            "https://portal.trt12.jus.br/boletim-jurisprudencia",
            *[f"https://portal.trt12.jus.br/boletim-de-jurisprudencia-do-trt-sc-de-{y}"
              for y in range(2020, 2027)],
        ],
    },
    "trt15": {
        "name": "TRT15",
        "strategy": "html_parse",
        # Drupal 9 — Caderno de Doutrina e Jurisprudência, bimestral desde 1991
        # PDFs em /sites/portal/files/fields/boletim/YYYY/
        "pages": ["https://trt15.jus.br/boletim-informativo"],
    },
    "trt17": {
        "name": "TRT17",
        "strategy": "html_parse",
        # Liferay + Angular — Informativo mensal; componente <visualizador-documentos>
        # Provavelmente retornará 0 PDFs; investigar CDN cdn.trt17.jus.br
        "pages": ["https://www.trt17.jus.br/w/boletim-de-jurisprudencia"],
    },
    "trt21": {
        "name": "TRT21",
        "strategy": "html_parse",
        # Drupal 11 — trimestral desde 2008
        "pages": ["https://www.trt21.jus.br/jurisprudencia/boletim-de-jurisprudencia"],
    },
    "trt24": {
        "name": "TRT24",
        "strategy": "html_parse",
        # Liferay — mensal desde 2023; /documents/20182/6649298/
        "pages": ["https://www.trt24.jus.br/novo-boletim-de-jurisprudencia"],
        "base_url": "https://www.trt24.jus.br",
        "url_filter": r"/documents/20182/6649298/",
    },
}

# ── Regexes ────────────────────────────────────────────────────────────────────

PDF_HREF_RE = re.compile(
    # Captura hrefs com .pdf — suporta:
    #   normal:  arquivo.pdf  ou  arquivo.pdf?query
    #   Liferay: arquivo.pdf/uuid-hex  (documento library)
    r"""href=['"]([^'"]*\.pdf(?:[?/][^'"]*)?)['"']""",
    re.IGNORECASE,
)
ANY_YEAR_RE = re.compile(r"\b20\d\d\b")  # qualquer ano 20xx (para filtrar anos < YEAR_FROM)
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
DSPACE_ITEM_RE = re.compile(r'href="(/[^"]*?/handle/\d+/\d+)[?"]')
DSPACE_BITS_RE = re.compile(
    r'href="(/[^"]*?/bitstream/handle/[^"]*?\.pdf(?:\?[^"]*)?)"',
    re.IGNORECASE,
)

# ── HTTP ───────────────────────────────────────────────────────────────────────

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def fetch(url: str, timeout: int = 30, verify: bool = True) -> Optional[requests.Response]:
    try:
        r = SESSION.get(url, timeout=timeout, allow_redirects=True, verify=verify)
        r.raise_for_status()
        return r
    except Exception as exc:
        log.warning(f"    GET falhou {url}: {exc}")
        return None


# ── Filtro de ano ──────────────────────────────────────────────────────────────

def year_ok(url: str) -> bool:
    """True se URL/filename tem ano >= YEAR_FROM, ou se não há ano (baixa tudo)."""
    years = [int(m.group()) for m in ANY_YEAR_RE.finditer(url)]
    if not years:
        return True
    return max(years) >= YEAR_FROM


def pdf_links_from_html(html: str, page_url: str, base_url: str) -> list[str]:
    """Extrai hrefs .pdf, resolve para URL absoluta."""
    base = base_url or page_url
    seen: set[str] = set()
    result: list[str] = []
    for m in PDF_HREF_RE.finditer(html):
        href = m.group(1).strip()
        full = urljoin(base, href)
        if full not in seen:
            seen.add(full)
            result.append(full)
    return result


# ── Estratégia: html_parse ─────────────────────────────────────────────────────

def find_pdfs_html(cfg: dict) -> list[str]:
    base_url = cfg.get("base_url", "")
    url_filter: Optional[re.Pattern] = (
        re.compile(cfg["url_filter"], re.IGNORECASE) if "url_filter" in cfg else None
    )
    verify = not cfg.get("no_ssl_verify", False)
    all_urls: list[str] = []

    for page_url in cfg["pages"]:
        r = fetch(page_url, verify=verify)
        if not r:
            continue
        links = pdf_links_from_html(r.text, page_url, base_url or page_url)
        if url_filter:
            links = [u for u in links if url_filter.search(u)]
        log.info(f"    {page_url}: {len(links)} link(s) PDF no HTML")
        all_urls.extend(links)
        time.sleep(REQUEST_DELAY)

    # Deduplicação e filtro de ano
    seen: set[str] = set()
    filtered: list[str] = []
    for u in all_urls:
        if u not in seen and year_ok(u):
            seen.add(u)
            filtered.append(u)
    return filtered


# ── Estratégia: dspace ─────────────────────────────────────────────────────────

def find_pdfs_dspace(cfg: dict) -> list[str]:
    """
    Navega coleção DSpace via HTML paginado, coleta bitstreams PDF de cada item.
    Ignora itens cujo HTML não contenha ano >= YEAR_FROM.
    """
    base = cfg["dspace_base"]
    handle = cfg["collection_handle"]
    url_filter: Optional[re.Pattern] = (
        re.compile(cfg["url_filter"], re.IGNORECASE) if "url_filter" in cfg else None
    )
    # Item paths são absolutos (ex: /bd-trt3/handle/...) — precisa apenas da origem
    parsed_base = urlparse(base)
    origin = f"{parsed_base.scheme}://{parsed_base.netloc}"
    all_pdfs: list[str] = []
    seen_items: set[str] = set()
    offset = 0
    limit = 50

    while True:
        col_url = f"{base}/handle/{handle}?offset={offset}&limit={limit}"
        r = fetch(col_url)
        if not r:
            break

        items = DSPACE_ITEM_RE.findall(r.text)
        # Filtra para pegar apenas itens filho (não a própria coleção)
        col_prefix = f"/handle/{handle}"
        items = [p for p in items if not p.endswith(col_prefix) and p not in seen_items]

        if not items:
            break

        new_items = 0
        for item_path in items:
            if item_path in seen_items:
                continue
            seen_items.add(item_path)
            new_items += 1

            # item_path é absoluto (/bd-trt3/handle/...) — usar origin para evitar duplicação
            item_url = urljoin(origin, item_path)
            ir = fetch(item_url)
            if not ir:
                continue

            # Filtro de ano pelo conteúdo da página do item
            years = [int(m.group()) for m in ANY_YEAR_RE.finditer(ir.text)]
            if years and max(years) < YEAR_FROM:
                log.debug(f"    Ignorando item antigo: {item_url}")
                time.sleep(0.5)
                continue

            for bm in DSPACE_BITS_RE.finditer(ir.text):
                pdf_url = urljoin(origin, bm.group(1))
                if url_filter and not url_filter.search(pdf_url):
                    continue
                if pdf_url not in all_pdfs:
                    all_pdfs.append(pdf_url)
                    log.info(f"    DSpace PDF: {pdf_url.split('/')[-1].split('?')[0]}")

            time.sleep(REQUEST_DELAY)

        if new_items == 0:
            break
        offset += limit
        time.sleep(REQUEST_DELAY)

    return all_pdfs


# ── Estratégia: api_json ──────────────────────────────────────────────────────

def find_pdfs_api_json(cfg: dict) -> list[tuple[str, str]]:
    """Busca PDFs via API JSON paginada. Retorna lista de (url, filename).
    As URLs podem ser assinadas (expiram), por isso são buscadas na hora do download.
    """
    api_url = cfg["api_url"]
    per_page = cfg.get("per_page", 100)
    pdf_field = cfg.get("pdf_field", "arquivoPdfUrl")
    year_field = cfg.get("year_field", "ano")
    month_field = cfg.get("month_field", "mes")

    results: list[tuple[str, str]] = []
    page = 1

    while True:
        r = fetch(f"{api_url}?page={page}&perPage={per_page}")
        if not r:
            break
        try:
            data = r.json()
        except Exception as exc:
            log.warning(f"    JSON inválido: {exc}")
            break

        for item in data.get("data", []):
            ano = item.get(year_field)
            mes = item.get(month_field)
            url = item.get(pdf_field)
            if not url or not ano or ano < YEAR_FROM:
                continue
            filename = f"informativo_{ano}_{int(mes):02d}.pdf"
            results.append((url, filename))

        total_pages = data.get("meta", {}).get("totalPages", 1)
        if page >= total_pages:
            break
        page += 1
        time.sleep(REQUEST_DELAY)

    return results


# ── Estratégia: dspace7 ───────────────────────────────────────────────────────

def find_pdfs_dspace7(cfg: dict) -> list[tuple[str, str]]:
    """DSpace 7 REST API: busca itens da coleção, filtra por número e retorna (url, filename)."""
    base = cfg["dspace7_base"]
    col_uuid = cfg["collection_uuid"]
    num_min = cfg.get("num_min", 1)
    num_max = cfg.get("num_max", 99999)
    size = 100

    results: list[tuple[str, str]] = []
    page = 0

    while True:
        r = fetch(f"{base}/server/api/discover/search/objects?scope={col_uuid}&size={size}&page={page}")
        if not r:
            break
        data = r.json()

        objects = (
            data.get("_embedded", {})
                .get("searchResult", {})
                .get("_embedded", {})
                .get("objects", [])
        )
        page_info = (
            data.get("_embedded", {})
                .get("searchResult", {})
                .get("page", {})
        )
        total = page_info.get("totalElements", 0)

        for obj in objects:
            item = obj.get("_embedded", {}).get("indexableObject", {})
            item_uuid = item.get("uuid")
            if not item_uuid:
                continue
            title = next(
                (mv["value"] for mv in item.get("metadata", {}).get("dc.title", [])),
                ""
            )
            num_m = re.search(r"n[º°]?\s*(\d+)", title, re.IGNORECASE)
            if not num_m:
                continue
            num = int(num_m.group(1))
            if not (num_min <= num <= num_max):
                continue

            filename = f"boletim_{num:03d}.pdf"

            # Busca bundle ORIGINAL
            br = fetch(f"{base}/server/api/core/items/{item_uuid}/bundles")
            if not br:
                continue
            bundles = br.json().get("_embedded", {}).get("bundles", [])
            orig = next((b for b in bundles if b.get("name") == "ORIGINAL"), None)
            if not orig:
                continue

            # Busca bitstream PDF
            bsr = fetch(f"{base}/server/api/core/bundles/{orig['uuid']}/bitstreams")
            if not bsr:
                continue
            bitstreams = bsr.json().get("_embedded", {}).get("bitstreams", [])
            pdf_bs = next((b for b in bitstreams if b.get("name", "").lower().endswith(".pdf")), None)
            if not pdf_bs:
                continue

            pdf_url = f"{base}/server/api/core/bitstreams/{pdf_bs['uuid']}/content"
            log.info(f"    DSpace7 PDF: {filename}  ({title})")
            results.append((pdf_url, filename))
            time.sleep(REQUEST_DELAY)

        if (page + 1) * size >= total:
            break
        page += 1
        time.sleep(REQUEST_DELAY)

    return results


# ── Estratégia: url_range ─────────────────────────────────────────────────────

def find_files_url_range(cfg: dict) -> list[tuple[str, str]]:
    """Gera lista de (url, filename) a partir de faixas numéricas configuradas.
    Cada range: {url_template, start, end, ext}
    url_template deve conter {n} como placeholder do número.
    """
    results: list[tuple[str, str]] = []
    for rng in cfg.get("ranges", []):
        template = rng["url_template"]
        ext = rng.get("ext", "html")
        for n in range(rng["start"], rng["end"] + 1):
            url = template.format(n=n)
            filename = f"boletim_{n:03d}.{ext}"
            results.append((url, filename))
    return results


# ── Estratégia: direct_urls ────────────────────────────────────────────────────

def find_pdfs_direct(cfg: dict) -> list[str]:
    """Retorna a lista de URLs já configuradas, filtrando por ano.
    Se 'url_filenames' estiver presente, usa as chaves como lista de URLs (sem filtro de ano).
    """
    if "url_filenames" in cfg:
        return list(cfg["url_filenames"].keys())
    return [u for u in cfg.get("urls", []) if year_ok(u)]


# ── Download de PDF ────────────────────────────────────────────────────────────

def pdf_filename(url: str) -> str:
    """Extrai e sanitiza o nome do arquivo a partir da URL.

    Trata o padrão Liferay onde o último segmento é um UUID:
    /documents/FOLDER/DOC/Boletim+Ed.pdf/uuid-hex  →  Boletim Ed.pdf
    """
    from urllib.parse import unquote
    path = urlparse(url).path
    parts = [p for p in path.split("/") if p]

    # Liferay: último segmento é UUID → usa o segmento .pdf anterior
    if parts and UUID_RE.match(parts[-1]):
        for part in reversed(parts[:-1]):
            if ".pdf" in part.lower():
                name = unquote(part).replace("+", " ")
                name = re.sub(r'[<>:"/\\|?*]', "_", name)
                return name or "boletim.pdf"

    name = parts[-1] if parts else "boletim.pdf"
    name = name.split("?")[0]
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name or "boletim.pdf"


def download_pdf(url: str, dest: Path, dry_run: bool, use_curl: bool = False, skip_magic_check: bool = False) -> bool:
    """Baixa arquivo para dest. Retorna True se ok (ou já existia).
    use_curl=True usa curl -k para portais com SSL handshake incompatível com Python requests.
    skip_magic_check=True desativa a verificação de magic bytes %PDF (usar para HTML).
    """
    if dest.exists() and dest.stat().st_size > 1024:
        return True

    if dry_run:
        log.info(f"    [dry-run] {dest.name}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp")
    try:
        if use_curl:
            import subprocess
            cmd = [
                "curl", "-k", "-L", "-s",
                "-A", HEADERS["User-Agent"],
                "-o", str(tmp), url,
            ]
            r = subprocess.run(cmd, capture_output=True, timeout=120)
            if r.returncode != 0:
                log.error(f"    Erro curl {url}: {r.stderr.decode(errors='replace')}")
                tmp.unlink(missing_ok=True)
                return False
        else:
            r = SESSION.get(url, timeout=90, stream=True)
            r.raise_for_status()
            with tmp.open("wb") as f:
                for chunk in r.iter_content(65_536):
                    if chunk:
                        f.write(chunk)

        # Verifica magic bytes PDF (desativado para HTML e outros formatos)
        if not skip_magic_check:
            with tmp.open("rb") as f:
                header = f.read(5)
            if not header.startswith(b"%PDF"):
                log.warning(f"    Ignorado (não é PDF): {url}")
                tmp.unlink(missing_ok=True)
                return False

        tmp.rename(dest)
        size_kb = dest.stat().st_size // 1024
        log.info(f"    OK {dest.name}  ({size_kb} KB)")
        return True

    except Exception as exc:
        log.error(f"    Erro baixando {url}: {exc}")
        tmp.unlink(missing_ok=True)
        return False


# ── Checkpoint ─────────────────────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if CHECKPOINT_FILE.exists():
        try:
            return json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_checkpoint(data: dict) -> None:
    CHECKPOINT_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── Processamento por tribunal ─────────────────────────────────────────────────

def process_tribunal(
    sigla: str,
    cfg: dict,
    output_dir: Path,
    dry_run: bool,
    checkpoint: dict,
) -> dict:
    name = cfg["name"]
    log.info(f"\n{'='*60}")
    log.info(f"{name}  ({sigla})")

    strategy = cfg["strategy"]
    if strategy == "html_parse":
        pdf_urls = find_pdfs_html(cfg)
    elif strategy == "dspace":
        pdf_urls = find_pdfs_dspace(cfg)
    elif strategy == "direct_urls":
        pdf_urls = find_pdfs_direct(cfg)
    elif strategy == "api_json":
        api_results = find_pdfs_api_json(cfg)
        pdf_urls = [u for u, _ in api_results]
        cfg = dict(cfg, url_filenames={u: f for u, f in api_results})
    elif strategy == "dspace7":
        api_results = find_pdfs_dspace7(cfg)
        pdf_urls = [u for u, _ in api_results]
        cfg = dict(cfg, url_filenames={u: f for u, f in api_results})
    elif strategy == "url_range":
        range_results = find_files_url_range(cfg)
        pdf_urls = [u for u, _ in range_results]
        cfg = dict(cfg, url_filenames={u: f for u, f in range_results})
    else:
        log.warning(f"  Estrategia '{strategy}' nao implementada — pulando")
        return {"found": 0, "downloaded": 0, "skipped": 0, "errors": 0}

    if not pdf_urls:
        log.warning(
            f"  [!] Nenhum PDF encontrado em {name}. "
            f"Portal pode usar SPA (Angular/Vue) ou Liferay dinamico. "
            f"Investigue manualmente e adicione URLs diretas em 'pages'."
        )
        return {"found": 0, "downloaded": 0, "skipped": 0, "errors": 0}

    log.info(f"  PDFs encontrados (≥ {YEAR_FROM}): {len(pdf_urls)}")

    already: set[str] = set(checkpoint.get(sigla, []))
    counters = {"found": len(pdf_urls), "downloaded": 0, "skipped": 0, "errors": 0}
    tribunal_dir = output_dir / sigla
    url_filenames = cfg.get("url_filenames", {})
    use_curl = cfg.get("use_curl", False)
    skip_magic_check = cfg.get("skip_magic_check", False)

    for url in pdf_urls:
        if url in already:
            counters["skipped"] += 1
            continue

        name_pdf = url_filenames.get(url) or pdf_filename(url)
        dest = tribunal_dir / name_pdf
        ok = download_pdf(url, dest, dry_run, use_curl=use_curl, skip_magic_check=skip_magic_check)

        if ok:
            counters["downloaded"] += 1
            if not dry_run:
                already.add(url)
                checkpoint[sigla] = sorted(already)
                save_checkpoint(checkpoint)
        else:
            counters["errors"] += 1

        time.sleep(REQUEST_DELAY)

    log.info(
        f"  {name}: {counters['downloaded']} baixados"
        f"  | {counters['skipped']} ja existiam"
        f"  | {counters['errors']} erros"
    )
    return counters


# ── Logging ────────────────────────────────────────────────────────────────────

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


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Download Boletins de Jurisprudência TJ/TRT (2020+)")
    ap.add_argument(
        "--tribunal",
        help="Sigla do tribunal (ex: tjmg, trt3). Omita para processar todos.",
    )
    ap.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"Pasta de destino (padrão: {DEFAULT_OUTPUT})",
    )
    ap.add_argument("--dry-run", action="store_true", help="Lista PDFs sem baixar")
    ap.add_argument(
        "--reset",
        action="store_true",
        help="Ignora checkpoint e refaz o(s) tribunal(is)",
    )
    args = ap.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    checkpoint = {} if args.reset else load_checkpoint()

    if args.tribunal:
        sigla = args.tribunal.lower()
        if sigla not in TRIBUNAIS:
            known = ", ".join(sorted(TRIBUNAIS))
            sys.exit(f"Tribunal '{sigla}' não encontrado. Disponíveis: {known}")
        tribunais_to_run = {sigla: TRIBUNAIS[sigla]}
        if args.reset:
            checkpoint.pop(sigla, None)
    else:
        tribunais_to_run = TRIBUNAIS

    log.info("=" * 60)
    log.info(f"Download Boletins TJ/TRT  |  destino: {output_dir}")
    log.info(f"Tribunais: {', '.join(tribunais_to_run)}")
    if args.dry_run:
        log.info("MODO DRY-RUN — nenhum arquivo será baixado")
    log.info("=" * 60)

    totais = {"found": 0, "downloaded": 0, "skipped": 0, "errors": 0}
    sem_pdf: list[str] = []

    for sigla, cfg in tribunais_to_run.items():
        c = process_tribunal(sigla, cfg, output_dir, args.dry_run, checkpoint)
        for k in totais:
            totais[k] += c[k]
        if c["found"] == 0:
            sem_pdf.append(cfg["name"])

    log.info("\n" + "=" * 60)
    log.info("RESUMO FINAL")
    log.info(f"  PDFs encontrados : {totais['found']}")
    log.info(f"  Baixados         : {totais['downloaded']}")
    log.info(f"  Já existiam      : {totais['skipped']}")
    log.info(f"  Erros            : {totais['errors']}")
    if sem_pdf:
        log.info("\n  [!] Sem PDF (portais dinamicos - investigar manualmente):")
        for n in sem_pdf:
            log.info(f"       {n}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
