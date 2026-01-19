-- Migration: Add Organizations and JWT Authentication
-- Data: 2026-01-18
-- Descrição: Implementa multi-tenancy com organizações e autenticação JWT

-- ============================================
-- PARTE 1: Atualizar tabela users
-- ============================================

-- Adicionar novos campos de autenticação
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Garantir que email é NOT NULL (para novos registros)
-- Não vamos alterar dados existentes
DO $$
BEGIN
  -- Só executar se a coluna ainda não tem constraint NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email' AND is_nullable = 'NO'
  ) THEN
    -- Primeiro, atualizar emails NULL (se houver)
    UPDATE users SET email = CONCAT('user-', id, '@temp.local') WHERE email IS NULL;

    -- Depois, adicionar constraint
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

-- Criar índice em email se não existir
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- ============================================
-- PARTE 2: Criar tabela refresh_tokens
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,

  -- Metadata
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);

-- ============================================
-- PARTE 3: Criar tabela organizations
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Settings
  settings JSONB,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);

-- ============================================
-- PARTE 4: Criar tabela organization_members
-- ============================================

CREATE TABLE IF NOT EXISTS organization_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operador', -- super_admin, admin, operador

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  joined_at TIMESTAMP DEFAULT NOW(),
  last_access_at TIMESTAMP,

  -- Constraint: um usuário só pode estar em uma organização uma vez
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_org_idx ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);

-- ============================================
-- PARTE 5: Criar tabela invite_tokens
-- ============================================

CREATE TABLE IF NOT EXISTS invite_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador',
  token TEXT NOT NULL UNIQUE,

  -- Metadata
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by VARCHAR REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS invite_tokens_token_idx ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS invite_tokens_org_idx ON invite_tokens(organization_id);

-- ============================================
-- PARTE 6: Adicionar organization_id nas tabelas existentes
-- ============================================

-- Adicionar coluna organization_id (nullable por enquanto)
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS organization_id VARCHAR;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS organization_id VARCHAR;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS organization_id VARCHAR;
ALTER TABLE geracao_mensal ADD COLUMN IF NOT EXISTS organization_id VARCHAR;
ALTER TABLE precos_kwh ADD COLUMN IF NOT EXISTS organization_id VARCHAR;

-- ============================================
-- PARTE 7: Migrar dados existentes
-- ============================================

DO $$
DECLARE
  default_org_id VARCHAR;
  first_user_id VARCHAR;
BEGIN
  -- Verificar se já existe organização padrão
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'organizacao-principal' LIMIT 1;

  -- Se não existe, criar organização principal
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug, description, is_active)
    VALUES (
      'Organização Principal',
      'organizacao-principal',
      'Organização criada automaticamente para migração dos dados existentes',
      true
    )
    RETURNING id INTO default_org_id;

    RAISE NOTICE 'Organização principal criada: %', default_org_id;
  END IF;

  -- Atualizar todos os dados existentes para pertencerem à organização principal
  UPDATE usinas SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE clientes SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE faturas SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE geracao_mensal SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE precos_kwh SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Adicionar todos os usuários existentes como admins da organização principal
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  SELECT default_org_id, id, 'admin', true
  FROM users
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Marcar primeiro usuário como super_admin
  SELECT id INTO first_user_id FROM users ORDER BY created_at LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE organization_members
    SET role = 'super_admin'
    WHERE user_id = first_user_id AND organization_id = default_org_id;

    RAISE NOTICE 'Primeiro usuário promovido a super_admin: %', first_user_id;
  END IF;

  RAISE NOTICE 'Migração concluída! Todos os dados foram associados à organização principal.';
END $$;

-- ============================================
-- PARTE 8: Criar Foreign Keys
-- ============================================

-- Adicionar FKs para organization_id (após migração de dados)
ALTER TABLE usinas
  ADD CONSTRAINT IF NOT EXISTS usinas_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE clientes
  ADD CONSTRAINT IF NOT EXISTS clientes_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE faturas
  ADD CONSTRAINT IF NOT EXISTS faturas_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE geracao_mensal
  ADD CONSTRAINT IF NOT EXISTS geracao_mensal_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE precos_kwh
  ADD CONSTRAINT IF NOT EXISTS precos_kwh_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- PARTE 9: Criar índices para performance
-- ============================================

CREATE INDEX IF NOT EXISTS usinas_organization_idx ON usinas(organization_id);
CREATE INDEX IF NOT EXISTS clientes_organization_idx ON clientes(organization_id);
CREATE INDEX IF NOT EXISTS faturas_organization_idx ON faturas(organization_id);
CREATE INDEX IF NOT EXISTS geracao_mensal_organization_idx ON geracao_mensal(organization_id);
CREATE INDEX IF NOT EXISTS precos_kwh_organization_idx ON precos_kwh(organization_id);

-- ============================================
-- PARTE 10: Atualizar user_profiles (remover se possível)
-- ============================================

-- A tabela user_profiles agora é substituída por organization_members
-- Mas vamos manter por compatibilidade temporária
-- TODO: Remover após confirmar que tudo funciona

COMMENT ON TABLE organization_members IS 'Substitui user_profiles. Gerencia membros e roles por organização.';
COMMENT ON TABLE organizations IS 'Tabela de organizações para multi-tenancy.';
COMMENT ON TABLE refresh_tokens IS 'Tokens de refresh para autenticação JWT.';

-- ============================================
-- FIM DA MIGRATION
-- ============================================

-- Verificação final
DO $$
DECLARE
  org_count INTEGER;
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO member_count FROM organization_members;

  RAISE NOTICE '✅ Migration concluída!';
  RAISE NOTICE '   Organizações criadas: %', org_count;
  RAISE NOTICE '   Membros adicionados: %', member_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Próximos passos:';
  RAISE NOTICE '   1. Fazer logout e login novamente';
  RAISE NOTICE '   2. Verificar que você é super_admin';
  RAISE NOTICE '   3. Testar criação de novas organizações';
  RAISE NOTICE '   4. Seus dados estão 100%% preservados!';
END $$;
