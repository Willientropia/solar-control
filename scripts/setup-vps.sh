#!/bin/bash
# =============================================================================
# Setup inicial do VPS para deploy via GitHub Actions
# Execute este script UMA VEZ no VPS para preparar o ambiente.
# =============================================================================

set -e

echo "=== Solar-Control — Setup do VPS ==="

# Diretório de trabalho
APP_DIR="/opt/solar-control"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ------------------------------------------------------------------
# 1. Declarar os volumes Docker como externos (preserva dados já existentes)
# ------------------------------------------------------------------
echo "[1/4] Garantindo que os volumes Docker existem..."

docker volume inspect postgres_data > /dev/null 2>&1 \
  && echo "  ✓ postgres_data já existe — dados preservados" \
  || docker volume create postgres_data

docker volume inspect uploads_data > /dev/null 2>&1 \
  && echo "  ✓ uploads_data já existe — arquivos preservados" \
  || docker volume create uploads_data

# ------------------------------------------------------------------
# 2. Criar .env se não existir
# ------------------------------------------------------------------
echo "[2/4] Verificando .env..."

if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<EOF
# Gerado pelo setup-vps.sh — preencha os valores reais

APP_VERSION=latest

DATABASE_URL=postgresql://postgres:TROQUE_AQUI@db:5432/soltech

POSTGRES_USER=postgres
POSTGRES_PASSWORD=TROQUE_AQUI
POSTGRES_DB=soltech

SESSION_SECRET=TROQUE_AQUI_gere_com_openssl_rand_hex_32
JWT_SECRET=TROQUE_AQUI_gere_com_openssl_rand_hex_32
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
BCRYPT_ROUNDS=12
EOF
  echo "  ✓ .env criado em $APP_DIR/.env — EDITE com os valores reais antes de continuar!"
else
  echo "  ✓ .env já existe — mantido sem alterações"
fi

# ------------------------------------------------------------------
# 3. Baixar docker-compose.prod.yml do repositório
# ------------------------------------------------------------------
echo "[3/4] Baixando docker-compose.prod.yml..."

curl -fsSL \
  "https://raw.githubusercontent.com/Willientropia/solar-control/main/docker-compose.prod.yml" \
  -o "$APP_DIR/docker-compose.prod.yml"

echo "  ✓ docker-compose.prod.yml baixado"

# ------------------------------------------------------------------
# 4. Instruções finais
# ------------------------------------------------------------------
echo ""
echo "[4/4] Setup concluído!"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "  1. Edite o arquivo de variáveis de ambiente:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  2. Configure os secrets no GitHub:"
echo "     VPS_HOST      → IP ou domínio do VPS"
echo "     VPS_USER      → usuário SSH (ex: root ou ubuntu)"
echo "     VPS_SSH_KEY   → chave privada SSH (conteúdo do arquivo id_rsa)"
echo ""
echo "  3. Para fazer o primeiro deploy manual (opcional):"
echo "     cd $APP_DIR"
echo "     docker compose -f docker-compose.prod.yml pull"
echo "     docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "  4. Para deploys futuros — só criar uma tag no git:"
echo "     git tag v1.0.1 && git push --tags"
echo ""
echo "⚠️  NUNCA rode: docker compose down -v  (apaga banco e uploads)"
