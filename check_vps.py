import paramiko
import sys

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Conectando a {host}...")
    client.connect(hostname=host, username=user, password=password)
    
    commands = [
        "find / -name '*.lancedb' 2>/dev/null",
        "cat /opt/judicore/apps/api/.env | grep -i lance",
        "cat /opt/judicore/apps/api/.env | grep -i embed",
        "cat /opt/judicore/apps/api/.env | grep -i model",
    ]
    
    for cmd in commands:
        print(f"\n--- Executando: {cmd} ---")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        
        if out:
            print(out)
        if err:
            print(f"ERRO: {err}")
            
except Exception as e:
    print(f"Falha na conexão ou execução: {str(e)}")
finally:
    client.close()
