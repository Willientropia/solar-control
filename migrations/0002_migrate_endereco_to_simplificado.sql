-- Migração de dados: copiar 'endereco' para 'enderecoSimplificado' e 'enderecoCompleto' quando vazios
UPDATE clientes
SET
  endereco_simplificado = CASE
    WHEN endereco_simplificado IS NULL OR endereco_simplificado = '' THEN endereco
    ELSE endereco_simplificado
  END,
  endereco_completo = CASE
    WHEN endereco_completo IS NULL OR endereco_completo = '' THEN endereco
    ELSE endereco_completo
  END
WHERE endereco IS NOT NULL AND endereco != '';
