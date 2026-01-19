-- Script para corrigir constraint missing e completar setup

-- 1. Verificar se constraint existe
DO $$
BEGIN
  -- Adicionar constraint UNIQUE se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_members_organization_id_user_id_key'
  ) THEN
    ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key
    UNIQUE (organization_id, user_id);

    RAISE NOTICE '✅ Constraint UNIQUE adicionada';
  ELSE
    RAISE NOTICE '✅ Constraint já existe';
  END IF;
END $$;

-- 2. Vincular usuário existente como super_admin
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'super_admin',
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = 'willie.engenharia@gmail.com'
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'super_admin', is_active = true;

-- 3. Verificar resultado
SELECT
  u.email,
  u.first_name || ' ' || COALESCE(u.last_name, '') as nome,
  o.name as organizacao,
  om.role,
  om.is_active,
  '✅ SUCESSO!' as status
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email = 'willie.engenharia@gmail.com';
