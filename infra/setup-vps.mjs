import { Client } from "ssh2";
import { readFileSync } from "fs";
import { homedir } from "os";

const HOST = "2.24.75.193";
const USER = "root";
const PASS = "Ugaz#@2026ok";

const SETUP_SCRIPT = `
set -e

echo "=== 1. Sistema ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== 2. Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker já instalado"
fi
systemctl enable docker

echo "=== 3. Node.js 20 ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js já instalado: $(node -v)"
fi

echo "=== 4. pnpm ==="
npm install -g pnpm@latest 2>/dev/null || true

echo "=== 5. Nginx ==="
apt-get install -y nginx

echo "=== 6. git clone ==="
if [ -d /opt/judicore ]; then
  cd /opt/judicore && git pull
else
  git clone https://github.com/wilsonaguiar-coder/judicore.git /opt/judicore
fi

echo "=== DONE ==="
`;

function run(conn, cmd) {
  return new Promise((resolve, reject) => {
    let out = "";
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", (d) => { process.stdout.write(d); out += d; });
      stream.stderr.on("data", (d) => { process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}`));
        else resolve(out);
      });
    });
  });
}

const pubKey = readFileSync(`${homedir()}/.ssh/judicore_vps.pub`, "utf8").trim();

const conn = new Client();

conn.on("ready", async () => {
  console.log("✓ Conectado ao VPS\n");

  try {
    // Adicionar chave SSH
    await run(conn, `mkdir -p ~/.ssh && echo '${pubKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`);
    console.log("✓ Chave SSH adicionada\n");

    // Rodar setup
    await run(conn, SETUP_SCRIPT);

    console.log("\n✓ Setup inicial concluído!");
  } catch (err) {
    console.error("Erro:", err.message);
  } finally {
    conn.end();
  }
});

conn.connect({ host: HOST, username: USER, password: PASS, readyTimeout: 30000 });
