-- Migração de dados: copiar 'endereco' para 'enderecoSimplificado' quando vazio
-- E copiar 'endereco' para 'enderecoCompleto' quando vazio
UPDATE clientes
SET
  endereco_simplificado = endereco,
  endereco_completo = COALESCE(endereco_completo, endereco)
WHERE endereco IS NOT NULL
  AND (endereco_simplificado IS NULL OR endereco_simplificado = '');
