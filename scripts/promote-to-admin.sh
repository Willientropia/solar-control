#!/bin/bash

# Script para promover usuário atual a ADMIN
# Este script atualiza o role do primeiro usuário encontrado para 'admin'

set -e

CONTAINER_NAME="solar-control-db-1"
DB_NAME="soltech"
DB_USER="postgres"

echo "================================================"
echo "  PROMOVER USUÁRIO A ADMIN"
echo "================================================"
echo ""

echo "🔍 Buscando usuários no sistema..."
echo ""

# Listar usuários atuais
docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  COALESCE(up.role, 'SEM ROLE') as role,
  u.created_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at;
"

echo ""
echo "================================================"
echo ""
read -p "Digite o EMAIL do usuário que será ADMIN: " USER_EMAIL

if [ -z "$USER_EMAIL" ]; then
    echo "❌ Email não pode estar vazio"
    exit 1
fi

echo ""
echo "🔄 Promovendo usuário $USER_EMAIL para ADMIN..."
echo ""

# Promover usuário para admin
docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
-- Criar user_profile se não existir
INSERT INTO user_profiles (user_id, role)
SELECT id, 'admin'
FROM users
WHERE email = '$USER_EMAIL'
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin';

-- Confirmar mudança
SELECT
  u.email,
  up.role,
  'ATUALIZADO COM SUCESSO' as status
FROM users u
JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = '$USER_EMAIL';
"

echo ""
echo "================================================"
echo "✅ USUÁRIO PROMOVIDO A ADMIN COM SUCESSO!"
echo "================================================"
echo ""
echo "💡 Próximos passos:"
echo "  1. Faça logout do sistema"
echo "  2. Faça login novamente"
echo "  3. Você agora tem acesso admin completo!"
echo ""
echo "🔓 Recursos admin liberados:"
echo "  • Relatórios"
echo "  • Auditoria"
echo "  • Configurações"
echo "  • Gerenciamento de usuários"
echo "  • Export/Import de dados"
echo ""
