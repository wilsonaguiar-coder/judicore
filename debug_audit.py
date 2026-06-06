import paramiko, sys, time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('2.24.75.193', username='root', password='Ugaz#@2026ok')

def run(cmd, n=3000):
    _, out, _ = ssh.exec_command(cmd)
    return out.read().decode('utf-8', errors='replace')[:n]

# Test Next.js directly
print("=== GET Next.js directly (port 3000) ===")
print(run("curl -s -H 'Host: judicore.com.br' http://127.0.0.1:3000/api/review-studio/teste-1/audit 2>&1 | head -c 500"))

# Test nginx routing (with proper Host, no cookies)
print("\n=== GET via nginx https bypass (test the routing) ===")
print(run(
    "curl -sk -H 'Host: judicore.com.br' "
    "--max-redirs 0 "
    "https://127.0.0.1/api/review-studio/teste-1/audit 2>&1 | head -c 500"
))

# Check the nginx config was written correctly
print("\n=== Current nginx location blocks ===")
print(run("grep -A5 'location' /etc/nginx/sites-enabled/judicore 2>&1"))

ssh.close()
