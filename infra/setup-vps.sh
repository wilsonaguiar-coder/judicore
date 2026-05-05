#!/bin/bash
set -e

echo "========================================"
echo " Judicore VPS Setup"
echo "========================================"

# --- 1. Sistema ---
echo -e "\n[1/9] Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw

# --- 2. Docker ---
echo -e "\n[2/9] Instalando Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "  Docker já instalado: $(docker --version)"
fi

# --- 3. Node.js 20 ---
echo -e "\n[3/9] Instalando Node.js 20..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs
else
  echo "  Node.js já instalado: $(node -v)"
fi

# --- 4. pnpm ---
echo -e "\n[4/9] Instalando pnpm..."
npm install -g pnpm@latest 2>/dev/null
npm install -g pm2 2>/dev/null

# --- 5. Clone repo ---
echo -e "\n[5/9] Clonando repositório..."
if [ -d /opt/judicore ]; then
  cd /opt/judicore && git pull
else
  git clone https://github.com/wilsonaguiar-coder/judicore.git /opt/judicore
fi

# --- 6. Variáveis de ambiente ---
echo -e "\n[6/9] Configurando variáveis de ambiente..."
cd /opt/judicore

if [ ! -f apps/api/.env ]; then
  cp infra/.env.example apps/api/.env
  # Gera JWT_SECRET aleatório
  JWT=$(openssl rand -hex 32)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" apps/api/.env
  echo ""
  echo "  ⚠️  ATENÇÃO: Edite apps/api/.env e adicione sua ANTHROPIC_API_KEY"
  echo "     Use: nano /opt/judicore/apps/api/.env"
  echo ""
fi

# --- 7. Docker Compose (ES com 2GB heap) ---
echo -e "\n[7/9] Subindo infraestrutura (PostgreSQL, ES, Redis)..."
cd /opt/judicore/infra
# Aumenta heap do ES para 2GB (servidor tem 8GB)
sed -i 's/ES_JAVA_OPTS=.*/ES_JAVA_OPTS=-Xms2g -Xmx2g/' docker-compose.yml
# Remove Kibana em produção para economizar RAM
sed -i '/kibana:/,/depends_on:/d' docker-compose.yml
docker compose up -d
echo "  Aguardando serviços ficarem saudáveis..."
sleep 30

# --- 8. Build e migrations ---
echo -e "\n[8/9] Instalando dependências e rodando migrations..."
cd /opt/judicore
pnpm install
pnpm db:generate
pnpm --filter @judicore/db exec prisma migrate deploy 2>/dev/null || \
  pnpm --filter @judicore/db exec prisma migrate dev --name init --skip-generate

# Build dos pacotes compartilhados
pnpm --filter @judicore/db build 2>/dev/null || true
pnpm --filter @judicore/search build 2>/dev/null || true
pnpm --filter @judicore/ai build 2>/dev/null || true

# Build da API
cd apps/api
pnpm build 2>/dev/null || true
cd /opt/judicore

# Build do frontend
cd apps/web
pnpm build
cd /opt/judicore

# --- 9. Nginx + PM2 ---
echo -e "\n[9/9] Configurando Nginx e PM2..."

cat > /etc/nginx/sites-available/judicore <<'NGINX'
server {
    listen 80;
    server_name _;

    # API
    location /api/ {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }

    # SSE (sem buffering)
    location /api/stream {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/judicore /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# PM2 para API e Web
pm2 delete judicore-api 2>/dev/null || true
pm2 delete judicore-web 2>/dev/null || true

pm2 start --name judicore-api --cwd /opt/judicore/apps/api \
  "node --experimental-specifier-resolution=node dist/server.js" 2>/dev/null || \
  pm2 start --name judicore-api --cwd /opt/judicore/apps/api \
  "npx tsx src/server.ts"

pm2 start --name judicore-web --cwd /opt/judicore/apps/web \
  "node .next/standalone/server.js" 2>/dev/null || \
  pm2 start --name judicore-web --cwd /opt/judicore/apps/web \
  "npx next start -p 3000"

pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

# Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "========================================"
echo " Setup concluído!"
echo "========================================"
echo ""
echo " Acesse: http://2.24.75.193"
echo ""
echo " Próximos passos:"
echo "  1. nano /opt/judicore/apps/api/.env  (adicionar ANTHROPIC_API_KEY)"
echo "  2. pm2 restart judicore-api"
echo "  3. Criar usuário admin via curl ou Insomnia"
echo ""
echo " Comandos úteis:"
echo "  pm2 logs judicore-api    - logs da API"
echo "  pm2 logs judicore-web    - logs do frontend"
echo "  docker compose -f /opt/judicore/infra/docker-compose.yml ps  - status dos containers"
