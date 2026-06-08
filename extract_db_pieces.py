import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Busca as peças geradas mais recentes com texto completo
cmd = """docker exec judicore_postgres psql -U judicore -d judicore -t -A -F'|||' -c "
SELECT id, piece_type, user_orientation, input_tokens_gpt, output_tokens_gpt, processing_time_ms, generated_text
FROM piece_generations
WHERE status = 'COMPLETED' AND generated_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
" """
stdin, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode('utf-8', errors='ignore')
client.close()

rows = [r for r in out.strip().split('\n') if '|||' in r]
pieces = []
for row in rows:
    parts = row.split('|||')
    if len(parts) >= 7:
        pieces.append({
            "id": parts[0].strip(),
            "pieceType": parts[1].strip(),
            "userOrientation": parts[2].strip()[:200],
            "inputTokensGpt": parts[3].strip(),
            "outputTokensGpt": parts[4].strip(),
            "processingTimeMs": parts[5].strip(),
            "draft": parts[6].strip()
        })

with open("db_pieces.json", "w", encoding="utf-8") as f:
    json.dump({"pieces": pieces}, f, ensure_ascii=False, indent=2)

print(f"{len(pieces)} peças extraídas do banco:")
for p in pieces:
    print(f"  [{p['id'][:12]}] {p['pieceType']} | {p['inputTokensGpt']} in | {p['outputTokensGpt']} out | {len(p['draft'])} chars")
