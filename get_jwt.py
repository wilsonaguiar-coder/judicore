import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Primeiro obtém o JWT via login
print("Obtendo JWT...")
login_cmd = '''curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d '{"email":"wilson.aguiar@gmail.com","password":"Judi@2026ok"}' '''
stdin, stdout, stderr = client.exec_command(login_cmd)
login_resp = stdout.read().decode('utf-8', errors='ignore')
print("Login response:", login_resp[:200])

try:
    login_data = json.loads(login_resp)
    token = login_data.get('access_token') or login_data.get('token') or login_data.get('accessToken')
    print(f"Token obtido: {token[:40] if token else 'NÃO ENCONTRADO'}...")
except:
    token = None
    print("Falha ao parsear login")

client.close()
