import paramiko

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

stdin, stdout, stderr = client.exec_command("nginx -t && systemctl status nginx")
print(stdout.read().decode('utf-8', 'ignore').encode('ascii', 'ignore').decode('ascii'))
print(stderr.read().decode('utf-8', 'ignore').encode('ascii', 'ignore').decode('ascii'))
client.close()
