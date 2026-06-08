import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

SQL = "SELECT row_to_json(t) FROM (SELECT id, piece_type, user_orientation, input_tokens_gpt, output_tokens_gpt, LENGTH(generated_text) AS draft_chars, generated_text FROM piece_generations WHERE status='COMPLETED' AND output_tokens_gpt > 600 ORDER BY created_at DESC LIMIT 6) t;"

cmd = f"docker exec judicore_postgres psql -U judicore -d judicore -t -A -c \"{SQL}\""
stdin, stdout, stderr = client.exec_command(cmd, timeout=20)
raw = stdout.read().decode('utf-8', errors='ignore')

pieces = []
for line in raw.strip().split('\n'):
    line = line.strip()
    if line.startswith('{'):
        try:
            obj = json.loads(line)
            pieces.append({
                'id': obj.get('id'),
                'pieceType': obj.get('piece_type'),
                'userOrientation': (obj.get('user_orientation') or '')[:400],
                'inputTokensGpt': obj.get('input_tokens_gpt'),
                'outputTokensGpt': obj.get('output_tokens_gpt'),
                'draftChars': obj.get('draft_chars'),
                'draft': obj.get('generated_text') or ''
            })
        except:
            pass

with open("db_pieces_full.json", "w", encoding="utf-8") as f:
    json.dump({'pieces': pieces}, f, ensure_ascii=False, indent=2)

print(f"{len(pieces)} peças extraídas:")
for p in pieces:
    print(f"  [{p['id'][:12]}] {p['pieceType']} | {p.get('draftChars',0)} chars | {p.get('outputTokensGpt',0)} tkns out")

client.close()
