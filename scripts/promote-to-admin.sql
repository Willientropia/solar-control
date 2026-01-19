-- Script SQL para promover usuários a ADMIN
-- Execute este arquivo diretamente no PostgreSQL

-- ============================================
-- OPÇÃO 1: Ver usuários atuais
-- ============================================
SELECT
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as nome_completo,
  COALESCE(up.role, 'SEM ROLE') as role_atual,
  u.created_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at;

-- ============================================
-- OPÇÃO 2: Promover TODOS para admin
-- ============================================

-- Criar user_profile para usuários sem role
INSERT INTO user_profiles (user_id, role)
SELECT u.id, 'admin'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
);

-- Atualizar TODOS os existentes para admin
UPDATE user_profiles SET role = 'admin';

-- Verificar resultado
SELECT
  u.email,
  up.role as novo_role,
  '✅ ATUALIZADO' as status
FROM users u
JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.email;


-- ============================================
-- OPÇÃO 3: Promover usuário ESPECÍFICO
-- (Descomente e substitua o email)
-- ============================================

/*
-- Substitua 'seu.email@exemplo.com' pelo email real
DO $$
DECLARE
  target_email TEXT := 'seu.email@exemplo.com';
BEGIN
  -- Criar ou atualizar para admin
  INSERT INTO user_profiles (user_id, role)
  SELECT id, 'admin'
  FROM users
  WHERE email = target_email
  ON CONFLICT (user_id)
  DO UPDATE SET role = 'admin';

  RAISE NOTICE 'Usuário % promovido a admin', target_email;
END $$;
*/
