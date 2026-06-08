import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

# Run a pg_dump or psql command
cmd = """
set -a && source /opt/judicore/apps/api/.env && set +a
psql $DATABASE_URL -c "SELECT id, input_tokens_gemini, output_tokens_gemini, input_tokens_gpt, output_tokens_gpt, generated_text FROM piece_generations WHERE id='cmq4iyjgy0000n14f4cha94mz';"
psql $DATABASE_URL -t -c "SELECT data_json FROM legal_extractions WHERE generation_id='cmq4iyjgy0000n14f4cha94mz';" > ext.json
psql $DATABASE_URL -t -c "SELECT data_json FROM legal_matrices WHERE generation_id='cmq4iyjgy0000n14f4cha94mz';" > mat.json
psql $DATABASE_URL -t -c "SELECT data_json FROM legal_classifications WHERE generation_id='cmq4iyjgy0000n14f4cha94mz';" > cla.json
cat ext.json mat.json cla.json
"""

stdin, stdout, stderr = client.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("db_dump.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\nERRORS:\n" + err)

print("Output salvo em db_dump.txt")
client.close()
