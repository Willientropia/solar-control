-- Migração 0005: Normalizar todos os meses existentes para MAIÚSCULO
-- Data: 2026-01-16
-- Objetivo: Converter Jan -> JAN, Dez -> DEZ, etc em todos os registros

-- Normalizar faturas (Jan/2026 -> JAN/2026)
UPDATE faturas
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);

-- Normalizar preços kWh
UPDATE precos_kwh
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);

-- Normalizar geração mensal
UPDATE geracao_mensal
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);

-- Verificar resultados
SELECT 'faturas' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT mes_referencia) as meses_distintos
FROM faturas
UNION ALL
SELECT 'precos_kwh', COUNT(*), COUNT(DISTINCT mes_referencia)
FROM precos_kwh
UNION ALL
SELECT 'geracao_mensal', COUNT(*), COUNT(DISTINCT mes_referencia)
FROM geracao_mensal;

-- Mostrar alguns exemplos de meses após normalização
SELECT DISTINCT mes_referencia FROM faturas ORDER BY mes_referencia LIMIT 10;
