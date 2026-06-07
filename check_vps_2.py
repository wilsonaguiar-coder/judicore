import paramiko
import sys
import time

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Conectando a {host}...")
    client.connect(hostname=host, username=user, password=password)
    
    commands = [
        "cat /opt/judicore/apps/api/.env",
        "find /opt/judicore -name '*.lancedb' 2>/dev/null",
        "ls -la /opt/judicore/apps/api/.env",
        "docker ps"
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
