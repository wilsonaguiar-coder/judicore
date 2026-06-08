import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

cmd = "tail -n 10000 /root/.pm2/logs/judicore-web-out.log"
stdin, stdout, stderr = client.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
with open("web_logs.txt", "w", encoding="utf-8") as f:
    f.write(out)

print("Logs salvos em web_logs.txt")
client.close()
