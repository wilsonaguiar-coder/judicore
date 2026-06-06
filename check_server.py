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
        "pm2 list",
        "pm2 logs --lines 30 --nostream",
        "systemctl status nginx --no-pager | tail -20",
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000",
    ]
    
    for cmd in commands:
        print(f"\n{'='*60}")
        print(f"CMD: {cmd}")
        print('='*60)
        stdin, stdout, stderr = client.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out:
            print(out)
        if err:
            print(f"STDERR: {err}")

except Exception as e:
    print(f"Erro: {str(e)}")
finally:
    client.close()
