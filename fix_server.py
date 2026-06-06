import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    
    commands = [
        "cd /opt/judicore && git pull",
        "cd /opt/judicore && pnpm install --reporter=silent",
        'cd /opt/judicore/packages/db && set -a && source /opt/judicore/apps/api/.env && set +a && npx prisma generate',
        "cd /opt/judicore && pnpm run build",
        "pm2 restart all",
        "sleep 3 && pm2 list",
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000",
    ]
    
    for cmd in commands:
        print(f"\n{'='*60}")
        print(f"CMD: {cmd}")
        print('='*60)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out:
            print(out)
        if err:
            print(f"STDERR: {err[:2000]}")
        if exit_status != 0:
            print(f"FALHOU com código {exit_status}. Parando.")
            break
    
    print("\nDeploy concluído!")

except Exception as e:
    print(f"Erro: {str(e)}")
finally:
    client.close()
