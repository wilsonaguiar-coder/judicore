import paramiko
import sys
import time
import sys

# Ensure UTF-8 encoding for stdout
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
        "export FORCE_COLOR=0 && cd /opt/judicore && pnpm install --reporter=silent",
        "cd /opt/judicore/packages/db && npx prisma generate",
        "cd /opt/judicore/packages/db && set -a && source /opt/judicore/apps/api/.env && set +a && npx prisma migrate deploy",
        "cd /opt/judicore && pnpm run build",
        "pm2 restart all"
    ]
    
    for cmd in commands:
        print(f"Executando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        # Wait for command to finish and print output
        exit_status = stdout.channel.recv_exit_status()
        
        # Ignore encoding errors for output logging
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        if out:
            print(out)
        if err:
            print(f"ERRO: {err}")
            
        if exit_status != 0:
            print(f"Comando falhou com código {exit_status}. Parando o deploy.")
            sys.exit(1)
            
    print("Deploy finalizado com sucesso!")
    
except Exception as e:
    print(f"Falha na conexão ou execução: {str(e)}")
finally:
    client.close()
