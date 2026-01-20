#!/bin/bash

# Script para criar Super Admin ANTES da migration
# Este script cria sua conta pessoal como super_admin

set -e

CONTAINER_NAME="solar-control-db-1"
DB_NAME="soltech"
DB_USER="postgres"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  CRIAR SUPER ADMIN - Solar Control${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

echo -e "${YELLOW}Este script vai criar sua conta pessoal como SUPER ADMIN${NC}"
echo -e "${YELLOW}antes de executar a migration completa.${NC}"
echo ""

# Pedir informações do usuário
echo -e "${GREEN}📧 Informações da sua conta:${NC}"
echo ""
read -p "Seu Email: " USER_EMAIL
read -p "Seu Nome: " FIRST_NAME
read -p "Seu Sobrenome (opcional): " LAST_NAME
read -sp "Sua Senha: " PASSWORD
echo ""
read -sp "Confirme a Senha: " PASSWORD_CONFIRM
echo ""
echo ""

# Validar senha
if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    echo -e "${RED}❌ Senhas não conferem!${NC}"
    exit 1
fi

if [ ${#PASSWORD} -lt 8 ]; then
    echo -e "${RED}❌ Senha deve ter pelo menos 8 caracteres!${NC}"
    exit 1
fi

# Converter email para minúsculas
USER_EMAIL=$(echo "$USER_EMAIL" | tr '[:upper:]' '[:lower:]')

echo -e "${YELLOW}🔄 Verificando se usuário já existe...${NC}"

# Verificar se email já existe
EXISTING_USER=$(docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT COUNT(*) FROM users WHERE email = '$USER_EMAIL';" | tr -d ' \n\r')

if [ "$EXISTING_USER" -gt 0 ]; then
    echo -e "${RED}❌ Email já cadastrado no sistema!${NC}"
    echo ""
    echo "Opções:"
    echo "1. Use outro email"
    echo "2. Use o script promote-to-admin.sh para promover usuário existente"
    exit 1
fi

echo -e "${GREEN}✅ Email disponível!${NC}"
echo ""

# Gerar hash bcrypt da senha usando Node.js
echo -e "${YELLOW}🔐 Gerando hash bcrypt da senha...${NC}"

# Criar script temporário Node.js para hash
cat > /tmp/hash-password.js << 'EOFJS'
const bcrypt = require('bcrypt');
const password = process.argv[2];
bcrypt.hash(password, 12, (err, hash) => {
  if (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
  console.log(hash);
});
EOFJS

# Executar hash (assumindo que bcrypt está instalado)
PASSWORD_HASH=$(node /tmp/hash-password.js "$PASSWORD" 2>/dev/null || echo "ERROR")

# Limpar arquivo temporário
rm -f /tmp/hash-password.js

if [ "$PASSWORD_HASH" = "ERROR" ]; then
    echo -e "${RED}❌ Erro ao gerar hash da senha!${NC}"
    echo -e "${YELLOW}Verifique se bcrypt está instalado: npm install bcrypt${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Hash gerado com sucesso!${NC}"
echo ""

# Criar usuário no banco
echo -e "${YELLOW}👤 Criando sua conta...${NC}"

docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" << EOSQL
-- Criar usuário
INSERT INTO users (email, first_name, last_name, password_hash, is_active, email_verified)
VALUES (
  '$USER_EMAIL',
  '$FIRST_NAME',
  $([ -n "$LAST_NAME" ] && echo "'$LAST_NAME'" || echo "NULL"),
  '$PASSWORD_HASH',
  true,
  true
)
RETURNING id, email, first_name, last_name;

-- Verificar criação
SELECT
  id,
  email,
  first_name || ' ' || COALESCE(last_name, '') as nome_completo,
  is_active,
  email_verified,
  created_at
FROM users
WHERE email = '$USER_EMAIL';
EOSQL

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ CONTA CRIADA COM SUCESSO!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📋 Suas credenciais:${NC}"
echo -e "   Email: $USER_EMAIL"
echo -e "   Senha: ******** (guardada com hash bcrypt)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: Guarde estas credenciais!${NC}"
echo ""

# Verificar se já existe organização principal
echo -e "${YELLOW}🏢 Verificando organização...${NC}"

ORG_COUNT=$(docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT COUNT(*) FROM organizations WHERE slug = 'organizacao-principal';" 2>/dev/null | tr -d ' \n\r' || echo "0")

if [ "$ORG_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}📦 Criando Organização Principal...${NC}"

    docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" << EOSQL
-- Criar organização principal
INSERT INTO organizations (name, slug, description, is_active)
VALUES (
  'Organização Principal',
  'organizacao-principal',
  'Organização criada para seus dados atuais',
  true
)
RETURNING id, name, slug;
EOSQL

    echo -e "${GREEN}✅ Organização criada!${NC}"
else
    echo -e "${GREEN}✅ Organização Principal já existe!${NC}"
fi

echo ""
echo -e "${YELLOW}🔗 Vinculando você à Organização Principal como SUPER_ADMIN...${NC}"

docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" << EOSQL
-- Vincular usuário à organização como super_admin
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'super_admin',
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = '$USER_EMAIL'
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'super_admin', is_active = true;

-- Verificar vinculação
SELECT
  u.email,
  u.first_name,
  o.name as organizacao,
  om.role,
  om.is_active
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email = '$USER_EMAIL';
EOSQL

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  🎉 TUDO PRONTO!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}✅ Você agora é SUPER_ADMIN da Organização Principal${NC}"
echo ""
echo -e "${YELLOW}📊 O que você pode fazer:${NC}"
echo "  1. Login com suas credenciais"
echo "  2. Acesso total aos dados atuais"
echo "  3. Criar novas organizações"
echo "  4. Adicionar admins e operadores"
echo "  5. Gerenciar todas as organizações"
echo ""
echo -e "${BLUE}🔐 Suas credenciais:${NC}"
echo "  Email: $USER_EMAIL"
echo "  Senha: (a que você definiu)"
echo "  Role: SUPER_ADMIN"
echo ""
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo "  1. Executar migration completa: ./scripts/run-migration.sh"
echo "  2. Fazer login no sistema"
echo "  3. Adicionar outros usuários"
echo ""
echo -e "${GREEN}💡 Dica: Guarde suas credenciais em local seguro!${NC}"
echo ""
