import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

audit_py = """
import urllib.request
import json
import time
import os

print("=== LANCEDB HEALTH ===")
try:
    with urllib.request.urlopen('http://127.0.0.1:7860/health', timeout=10) as response:
        print(f"Status: {response.status}")
        print(f"Body: {response.read().decode()}")
except Exception as e:
    print(f"Error: {e}")

print("\\n=== LANCEDB SEARCH STF ===")
payload = json.dumps({"query": "paridade pensão morte", "tribunais": ["STF"], "k": 3}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:7860/search', data=payload, headers={'Content-Type': 'application/json'})
try:
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=10) as response:
        t1 = time.time()
        res = json.loads(response.read().decode())
        print(f"Status: {response.status} in {round((t1-t0)*1000)}ms")
        print(f"Results: {len(res.get('results', []))}")
        if len(res.get('results', [])) > 0:
            print(f"Sample: {res['results'][0].get('tribunal')} - {res['results'][0].get('numero')}")
except Exception as e:
    print(f"Error: {e}")

print("\\n=== LANCEDB LOGS ===")
os.system('pm2 logs judicore-search --lines 20 --nostream')
"""

client.exec_command("cat > /tmp/audit_lancedb.py << 'EOF'\n" + audit_py + "\nEOF")[1].read()
stdin, stdout, stderr = client.exec_command("python3 /tmp/audit_lancedb.py")
print("STDOUT:")
print(stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:")
print(stderr.read().decode('utf-8', errors='ignore'))
client.close()
