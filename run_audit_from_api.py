import paramiko
import sys
import json

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

script_content = """import { PrismaClient } from '@judicore/db';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const gen = await prisma.pieceGeneration.findUnique({
    where: { id: 'cmq55r34f0000vzparsfj1z7u' },
    include: { snapshot: true }
  });

  if (!gen) {
    console.log("Geracao não encontrada");
    return;
  }
  
  if (gen.snapshot) {
     fs.writeFileSync('/opt/judicore/audit_snapshot.json', JSON.stringify(gen, null, 2));
     console.log("Snapshot salvo para " + gen.id);
  } else {
     console.log("Geração encontrada mas sem snapshot!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    
    # Escrever o script
    sftp = client.open_sftp()
    with sftp.file('/opt/judicore/apps/api/audit_script.ts', 'w') as f:
        f.write(script_content)
    
    # Rodar o script
    cmd = "cd /opt/judicore/apps/api && npx tsx --env-file=.env audit_script.ts"
    stdin, stdout, stderr = client.exec_command(cmd)
    
    print("STDOUT:", stdout.read().decode('utf-8'))
    print("STDERR:", stderr.read().decode('utf-8'))
    
    # Fazer download do json
    sftp.get('/opt/judicore/audit_snapshot.json', 'audit_snapshot.json')
    print("Download do snapshot feito para audit_snapshot.json")
    
except Exception as e:
    print(e)
finally:
    client.close()
