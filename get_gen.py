import paramiko
import sys

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    cmd = "psql 'postgresql://judicore:judicore_dev@localhost:5432/judicore' -c 'SELECT id, piece_type, created_at FROM piece_generations ORDER BY created_at DESC LIMIT 5;'"
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    print("OUT:", out)
    print("ERR:", err)
except Exception as e:
    print(e)
finally:
    client.close()
