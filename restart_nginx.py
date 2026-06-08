import paramiko

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

# Force restart instead of reload to kill old workers and drop keep-alive connections
stdin, stdout, stderr = client.exec_command("systemctl restart nginx")
print(stdout.read().decode('utf-8', 'ignore'))
print(stderr.read().decode('utf-8', 'ignore'))
client.close()
