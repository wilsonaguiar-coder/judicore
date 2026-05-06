#!/bin/bash
# Roda no servidor: bash /opt/judicore/services/search/setup-server.sh
set -e

SEARCH_DIR="/opt/judicore/services/search"
cd "$SEARCH_DIR"

echo "==> Instalando Python 3.11..."
apt-get update -q && apt-get install -y python3.11 python3.11-venv python3.11-dev

echo "==> Criando virtualenv..."
python3.11 -m venv venv
source venv/bin/activate

echo "==> Instalando dependências..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Copiando query.py do Ratio..."
# query.py deve estar em /opt/judicore/services/search/query.py
ls query.py || { echo "ERRO: query.py nao encontrado. Copie com: scp temp/rag/query.py root@servidor:/opt/judicore/services/search/"; exit 1; }

echo "==> Testando importação..."
python -c "import lancedb; import query; print('OK')"

echo "==> Iniciando com PM2..."
mkdir -p /opt/judicore/logs
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "Microservico rodando em http://127.0.0.1:7860"
echo "Teste: curl http://127.0.0.1:7860/health"
