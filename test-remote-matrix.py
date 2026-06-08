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
    
    # Faz o upload das alterações locais
    commands = [
        "cd /opt/judicore && git pull", # Atualiza o código lá
        "cd /opt/judicore/packages/ai && npx tsx --env-file=../../apps/api/.env src/scripts/test-matrix.ts"
    ]
    
    for cmd in commands:
        print(f"Executando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        # Read real-time output
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line.strip())
            
        err = stderr.read().decode('utf-8', errors='ignore')
        if err:
            print(f"ERRO: {err}")
            
except Exception as e:
    print(f"Falha na conexão: {str(e)}")
finally:
    client.close()
