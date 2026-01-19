#!/bin/bash

# Script para promover TODOS os usuários a ADMIN
# Use com cuidado! Isso dá acesso admin para todos

set -e

CONTAINER_NAME="solar-control-db-1"
DB_NAME="soltech"
DB_USER="postgres"

echo "================================================"
echo "  PROMOVER TODOS OS USUÁRIOS A ADMIN"
echo "================================================"
echo ""
echo "⚠️  ATENÇÃO: Este script vai promover TODOS os usuários"
echo "   do sistema para ADMIN. Use apenas em desenvolvimento"
echo "   ou quando você é o único usuário."
echo ""
read -p "Deseja continuar? (digite 'SIM' em maiúsculas): " CONFIRM

if [ "$CONFIRM" != "SIM" ]; then
    echo "❌ Operação cancelada"
    exit 0
fi

echo ""
echo "🔍 Usuários atuais:"
echo ""

docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  u.email,
  COALESCE(up.role, 'SEM ROLE') as role_atual
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id;
"

echo ""
echo "🔄 Promovendo todos para ADMIN..."
echo ""

docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
-- Criar user_profile para todos os usuários que não têm
INSERT INTO user_profiles (user_id, role)
SELECT u.id, 'admin'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
);

-- Atualizar todos os existentes para admin
UPDATE user_profiles SET role = 'admin';

-- Mostrar resultado
SELECT
  u.email,
  up.role as novo_role,
  '✅ PROMOVIDO' as status
FROM users u
JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.email;
"

echo ""
echo "================================================"
echo "✅ TODOS OS USUÁRIOS PROMOVIDOS A ADMIN!"
echo "================================================"
echo ""
echo "💡 Faça logout e login novamente para aplicar as mudanças"
echo ""
