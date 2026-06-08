import urllib.request
import urllib.error

urls = [
    "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm",
    "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/L11340.htm",
    "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340compilada.htm"
]

req_headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for url in urls:
    try:
        req = urllib.request.Request(url, headers=req_headers)
        response = urllib.request.urlopen(req)
        print(f"SUCESSO: {url} -> {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"FALHA: {url} -> {e.code}")
    except Exception as e:
        print(f"ERRO: {url} -> {e}")
