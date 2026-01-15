-- Migration: Add endereco_simplificado and endereco_completo fields to clientes table
-- Date: 2026-01-15
-- Description: Adiciona campos de endereço simplificado (para relatórios) e completo (para faturas)

-- Add new address fields
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS endereco_simplificado TEXT,
ADD COLUMN IF NOT EXISTS endereco_completo TEXT;

-- Comments for documentation
COMMENT ON COLUMN clientes.endereco IS 'Campo legado de endereço, mantido para compatibilidade';
COMMENT ON COLUMN clientes.endereco_simplificado IS 'Endereço simplificado usado em relatórios (ex: SLMB)';
COMMENT ON COLUMN clientes.endereco_completo IS 'Endereço completo usado em faturas geradas';

-- Update existing records to copy endereco to endereco_completo if not null
-- This ensures existing data is not lost
UPDATE clientes
SET endereco_completo = endereco
WHERE endereco IS NOT NULL AND endereco_completo IS NULL;
