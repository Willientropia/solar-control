-- Adiciona coluna unidade_consumidora_nova em clientes e afrouxa constraints da UC legada.
--
-- Passo 1 (agora): coluna nullable, unique. Permite coexistência durante migração.
-- Passo 2 (depois do import do Excel): tornar NOT NULL (script separado).
--
-- Uso:
--   psql -U <user> -d <database> -f scripts/add-uc-nova.sql

BEGIN;

-- 1. Adiciona nova coluna (nullable + unique).
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS unidade_consumidora_nova TEXT;

-- Unique constraint só se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_unidade_consumidora_nova_unique'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT clientes_unidade_consumidora_nova_unique
      UNIQUE (unidade_consumidora_nova);
  END IF;
END $$;

-- 2. Permite NULL na UC legada (novos clientes pós-2026 podem não ter).
ALTER TABLE clientes
  ALTER COLUMN unidade_consumidora DROP NOT NULL;

COMMIT;
