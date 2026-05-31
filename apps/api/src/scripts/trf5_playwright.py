import os
import time
from playwright.sync_api import sync_playwright

def download_trf5_pdfs(year_limit=2020):
    downloads_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "temp", "trf5_playwright")
    os.makedirs(downloads_dir, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        page.goto("https://www.trf5.jus.br/index.php/boletins-jurisprudencia")
        time.sleep(3)
        
        # We will collect all onclick events and their names to avoid losing DOM
        tasks = []
        
        periods = []
        elements = page.query_selector_all("a[onclick*='exibirBotaoRelatorio']")
        for el in elements:
            onclick = el.get_attribute("onclick")
            if onclick:
                parts = onclick.split("'")
                if len(parts) >= 2:
                    period = parts[1]
                    year_str = period[:4]
                    if year_str.isdigit() and int(year_str) >= year_limit:
                        periods.append(period)
                        
        print(f"Periods found >= {year_limit}: {periods}")
        
        for period in periods:
            # Get links for this period directly from the DOM (they are pre-rendered!)
            div_id = f"[id='{period}']"
            boletim_links = page.query_selector_all(f"{div_id} a[onclick*='exibirArquivo']")
            for link in boletim_links:
                onclick = link.get_attribute("onclick")
                text = link.inner_text().strip()
                tasks.append({"onclick": onclick, "text": text, "period": period})
        
        print(f"Total files to download: {len(tasks)}")
        page.close()
        
        for t in tasks:
            print(f"Downloading {t['period']} - {t['text']}...")
            try:
                dl_page = context.new_page()
                dl_page.goto("https://www.trf5.jus.br/index.php/boletins-jurisprudencia")
                
                dl_page.evaluate(t['onclick'])
                
                dl_page.wait_for_selector("#botaoBaixarPDF", state="visible", timeout=10000)
                
                with dl_page.expect_download(timeout=15000) as download_info:
                    dl_page.locator("#botaoBaixarPDF").click()
                
                download = download_info.value
                filename = f"{t['period']}_{t['text']}.pdf".replace("/", "_").replace("\\", "_")
                filepath = os.path.join(downloads_dir, filename)
                download.save_as(filepath)
                print(f"Saved {filepath}")
                dl_page.close()
            except Exception as e:
                print(f"Error downloading {t['text']}: {e}")
                try:
                    dl_page.close()
                except:
                    pass
        
        browser.close()

if __name__ == "__main__":
    download_trf5_pdfs()
