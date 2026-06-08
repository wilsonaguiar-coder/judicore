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
    
    commands = [
        "cd /opt/judicore && git pull",
        "cd /opt/judicore/packages/db && npx prisma generate",
        "cd /opt/judicore/apps/api && npx tsx --env-file=.env src/scripts/test-writer.ts"
    ]
    
    for cmd in commands:
        print(f"Executando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        if out:
            print(out)
        if err:
            print(f"ERRO: {err}")
            
except Exception as e:
    print(f"Falha na conexão: {str(e)}")
finally:
    client.close()
