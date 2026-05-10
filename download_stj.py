"""
Baixa PDFs dos Informativos STJ para envio ao servidor.
Execute na raiz do projeto: python download_stj.py
Os PDFs ficam em stj_pdfs/ e devem ser enviados para o servidor com scp.
"""
import requests
import os
import time

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
})

os.makedirs("stj_pdfs", exist_ok=True)

START = 780
END = 900

print(f"Baixando informativos STJ edições {START}–{END}...")
print()

baixados = 0
for edition in range(START, END + 1):
    pdf_path = f"stj_pdfs/Informativo_{edition:04d}.pdf"
    if os.path.exists(pdf_path):
        print(f"[ok] Edição {edition:04d} já existe, pulando.")
        baixados += 1
        continue

    url = f"https://processo.stj.jus.br/SCON/GetPDFINFJ?edicao={edition:04d}"
    try:
        r = session.get(url, timeout=30)
        if r.ok and r.content[:4] == b"%PDF":
            with open(pdf_path, "wb") as f:
                f.write(r.content)
            print(f"[ok] Edição {edition:04d} baixada ({len(r.content) // 1024} KB)")
            baixados += 1
        else:
            print(f"[--] Edição {edition:04d} não encontrada (HTTP {r.status_code})")
    except Exception as e:
        print(f"[!!] Edição {edition:04d} erro: {e}")

    time.sleep(1)

print()
print(f"Concluído: {baixados} PDFs em stj_pdfs/")
print()
print("Para enviar ao servidor:")
print("  scp stj_pdfs/*.pdf root@2.24.75.193:/opt/judicore/_internal/data/stj_informativos/docs/")
