import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Conectando a {host}...")
    client.connect(hostname=host, username=user, password=password)
    
    cmd = "cd /opt/judicore && git fetch --all && git reset --hard origin/main"
    print(f"Executando: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    print(out)
    print(err)
            
except Exception as e:
    print(f"Falha na conexão: {str(e)}")
finally:
    client.close()
