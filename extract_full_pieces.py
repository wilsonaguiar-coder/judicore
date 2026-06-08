import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# IDs das peças com mais tokens de output (mais densas)
IDS = [
    "cmq4iyjgy0000n14f4cha94mz",  # 55959 in, 952 out - a peça original fraca
    "cmq4k97l200004dgim2t4j3lo",  # 2434 in, 947 out - peça nova RPPS
    "cmq4kkibc0000r01aqllt9a7a",  # 47029 in, 926 out
    "cmq4fc505000014giqllt4xuj",  # 60533 in, 768 out - Contestação
    "cmq4fdhpc0000rtaqd8wh0c21",  # 34650 in, 719 out - Sentença
]

pieces = []
for pid in IDS:
    cmd = f"""docker exec judicore_postgres psql -U judicore -d judicore -t -c "
SELECT piece_type, user_orientation, input_tokens_gpt, output_tokens_gpt, generated_text
FROM piece_generations
WHERE id = '{pid}' AND status = 'COMPLETED';
" 2>/dev/null"""
    stdin, stdout, _ = client.exec_command(cmd)
    raw = stdout.read().decode('utf-8', errors='ignore').strip()
    
    if raw:
        lines = raw.split('\n')
        print(f"ID {pid[:12]}: {len(raw)} bytes, {len(lines)} linhas")
        pieces.append({"id": pid, "raw": raw[:200], "fullLen": len(raw)})

client.close()

# Melhor abordagem: extrair os textos individualmente via python no servidor
import subprocess

# Reconectar
client2 = paramiko.SSHClient()
client2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client2.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Escreve um script python no servidor que extrai o banco via SQLAlchemy
extract_py = """
import subprocess, json, sys
result = subprocess.run(
    ['docker', 'exec', 'judicore_postgres', 'psql', '-U', 'judicore', '-d', 'judicore',
     '-t', '-A', '-c',
     "SELECT piece_type || '=DELIM=' || COALESCE(user_orientation,'') || '=DELIM=' || CAST(input_tokens_gpt AS TEXT) || '=DELIM=' || CAST(output_tokens_gpt AS TEXT) || '=DELIM=' || COALESCE(generated_text,'') FROM piece_generations WHERE status='COMPLETED' AND output_tokens_gpt > 600 ORDER BY created_at DESC LIMIT 6;"],
    capture_output=True, text=True
)
rows = result.stdout.strip().split('\\n')
pieces = []
for row in rows:
    parts = row.split('=DELIM=')
    if len(parts) >= 5:
        pieces.append({
            'pieceType': parts[0].strip(),
            'userOrientation': parts[1].strip()[:300],
            'inputTokensGpt': parts[2].strip(),
            'outputTokensGpt': parts[3].strip(),
            'draft': '=DELIM='.join(parts[4:]).strip()
        })
print(json.dumps({'pieces': pieces}))
"""

client2.exec_command("cat > /tmp/extract_pieces.py << 'EOF'\n" + extract_py + "\nEOF")[1].read()
stdin2, stdout2, _ = client2.exec_command("python3 /tmp/extract_pieces.py", timeout=30)
out2 = stdout2.read().decode('utf-8', errors='ignore')

try:
    data = json.loads(out2)
    with open("db_pieces_full.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n{len(data['pieces'])} peças extraídas com texto completo:")
    for p in data['pieces']:
        print(f"  {p['pieceType']} | {p['inputTokensGpt']} in | {p['outputTokensGpt']} out | {len(p['draft'])} chars")
except Exception as e:
    print(f"Erro: {e}\nSaída: {out2[:500]}")

client2.close()
