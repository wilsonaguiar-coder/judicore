import paramiko
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname="2.24.75.193", username="root", password="Ugaz#@2026ok")

# 1. SFTP do JSON
sftp = client.open_sftp()
local_json = r"d:\\backup\\judicore\\apps\\api\\legis_data.json"
remote_json = "/opt/judicore/apps/api/legis_data.json"
print(f"Enviando {local_json} para o servidor...")
sftp.put(local_json, remote_json)

# 2. Escrever o script de carregamento no servidor
load_script = """
import { PrismaClient } from "@judicore/db";
import * as fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync("legis_data.json", "utf-8"));
  console.log(`Lendo ${data.length} dispositivos para inserção...`);

  const normasList = [...new Set(data.map((d: any) => d.normaNome))];
  
  for (const norma of normasList) {
    console.log(`Limpando base antiga da norma: ${norma}...`);
    await prisma.legisDevice.deleteMany({ where: { normaNome: String(norma) } });
  }

  console.log(`Inserindo novos dispositivos em lotes...`);
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await prisma.legisDevice.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(`Inseridos ${i + batch.length} de ${data.length}...`);
  }
  console.log(`Finalizado! Base atualizada com sucesso.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
"""

with sftp.file("/opt/judicore/apps/api/src/scripts/load-legis.ts", "w") as f:
    f.write(load_script)

sftp.close()

# 3. Executar o script no servidor
commands = [
    "cd /opt/judicore/apps/api && set -a && source .env && set +a && npx tsx src/scripts/load-legis.ts"
]

for cmd in commands:
    print(f"Executando: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    if out: print(out)
    if err: print(f"ERRO: {err}")

client.close()
print("Importação concluída.")
