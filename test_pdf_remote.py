import paramiko
import sys

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    
    commands = [
        "cd /opt/judicore && git pull",
        "cd /opt/judicore && pnpm run build --filter @judicore/web",
        "pm2 restart judicore-web",
        "curl -s http://localhost:3000/api/test-pdf"
    ]
    
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        print(f"[{cmd}] OUT:", out.encode('ascii', errors='ignore').decode('ascii'))
except Exception as e:
    print(f"Erro: {str(e)}")
finally:
    client.close()
