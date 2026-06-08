import json

def analyze():
    with open('d:\\backup\\judicore\\audit_snapshot.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Coletando os tokens da geração
    gpt_input = data.get('inputTokensGpt', 0)
    gpt_output = data.get('outputTokensGpt', 0)

    snapshot = data.get('snapshot', {})
    
    # BLOCO 1 - PieceBrief
    brief = snapshot.get('pieceBriefJson', {})
    brief_str = json.dumps(brief, ensure_ascii=False)
    brief_chars = len(brief_str)
    
    # Identificando a presença de "direito adquirido" e "paridade" e "Tema 396" nas teses
    teses_brief = brief.get('tesesIdentificadas', [])
    brief_tem_paridade = any("paridade" in t.lower() for t in teses_brief)
    brief_tem_direito_adquirido = any("direito adquirido" in t.lower() for t in teses_brief)
    brief_tem_tema396 = any("tema 396" in t.lower() for t in teses_brief)

    # BLOCO 2 - Legal Research
    research_summary = snapshot.get('researchSummaryJson', {})
    fontes = research_summary.get('fontesSelecionadas', [])
    legis_db_count = sum(1 for f in fontes if "LegisDB Local" in f)
    lexml_count = sum(1 for f in fontes if "LexML" in f)
    lancedb_count = sum(1 for f in fontes if "LanceDB" in f or "STF" in f or "STJ" in f or "Indisponível" in f) # indisponivel é geralmente lancedb quando falta nome
    
    # BLOCO 3 - LegalMatrix
    matrix = snapshot.get('legalMatrixJson', {})
    matrix_str = json.dumps(matrix, ensure_ascii=False)
    teses_matrix = matrix.get('teses', [])
    matrix_teses_count = len(teses_matrix)
    
    fundamentos_count = 0
    ementas_count = 0
    matrix_tem_direito_adquirido = False
    matrix_tem_paridade = False
    
    for t in teses_matrix:
        fundamentos_count += len(t.get('fundamentosLegais', []))
        jur = t.get('jurisprudenciaAplicavel', [])
        ementas_count += len(jur)
        t_str = json.dumps(t, ensure_ascii=False).lower()
        if "direito adquirido" in t_str: matrix_tem_direito_adquirido = True
        if "paridade" in t_str: matrix_tem_paridade = True
        
    # BLOCO 4 - Prompt do Writer
    prompt = snapshot.get('promptSnapshotJson', {}).get('prompt', '')

    with open('d:\\backup\\judicore\\relatorio_analise.txt', 'w', encoding='utf-8') as f:
        f.write(f"PieceBrief Chars: {brief_chars}\n")
        f.write(f"Brief Teses:\n")
        for t in teses_brief:
            f.write(f"- {t}\n")
        f.write(f"Brief Paridade? {brief_tem_paridade}\n")
        f.write(f"Brief Direito Adq? {brief_tem_direito_adquirido}\n")
        f.write(f"Brief Tema 396? {brief_tem_tema396}\n\n")
        
        f.write(f"Research: LegisDB={legis_db_count}, LexML={lexml_count}, LanceDB={lancedb_count}\n\n")
        
        f.write(f"Matrix Teses Count: {matrix_teses_count}\n")
        f.write(f"Matrix Fundamentos: {fundamentos_count}\n")
        f.write(f"Matrix Ementas: {ementas_count}\n")
        f.write(f"Matrix Size: {len(matrix_str)} chars\n")
        f.write(f"Matrix Direito Adq? {matrix_tem_direito_adquirido}\n")
        f.write(f"Matrix Paridade? {matrix_tem_paridade}\n\n")
        
        f.write(f"GPT Input Tokens: {gpt_input}\n")
        f.write(f"GPT Output Tokens: {gpt_output}\n")
        
analyze()
