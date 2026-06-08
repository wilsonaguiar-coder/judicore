import paramiko

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

# Pull and build the web frontend
cmd = "cd /opt/judicore && pnpm i && pnpm build --filter @judicore/web && pm2 restart judicore-web"
stdin, stdout, stderr = client.exec_command(cmd)

exit_status = stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', 'ignore'))
print(stderr.read().decode('utf-8', 'ignore'))
client.close()
