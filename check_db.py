import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname="2.24.75.193", username="root", password="Ugaz#@2026ok")

cmd = """
docker exec judicore_postgres psql -U judicore -d judicore -c "SELECT input_tokens, data_json FROM legal_extractions WHERE generation_id='cmq4iyjgy0000n14f4cha94mz';"
docker exec judicore_postgres psql -U judicore -d judicore -c "SELECT tese_count, data_json FROM legal_matrices WHERE generation_id='cmq4iyjgy0000n14f4cha94mz';"
docker exec judicore_postgres psql -U judicore -d judicore -c "SELECT input_tokens_gemini, output_tokens_gemini, input_tokens_gpt, output_tokens_gpt FROM piece_generations WHERE id='cmq4iyjgy0000n14f4cha94mz';"
"""

stdin, stdout, stderr = client.exec_command(cmd)

with open("db_dump2.txt", "w", encoding="utf-8") as f:
    f.write(stdout.read().decode('utf-8'))
    err = stderr.read().decode('utf-8')
    if err:
        f.write("\nERRORS:\n" + err)

client.close()
