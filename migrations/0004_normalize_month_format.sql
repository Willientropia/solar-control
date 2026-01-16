-- Script SQL para normalizar formato de mês
-- Execute manualmente no pgAdmin ou psql dentro do Docker
-- docker exec -it <container_id> psql -U postgres -d <database_name>

-- Normalizar faturas
UPDATE faturas
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);

-- Normalizar preços kWh
UPDATE precos_kwh
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);

-- Normalizar geração mensal
UPDATE geracao_mensal
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);

-- Verificar resultados
SELECT 'Faturas atualizadas:', COUNT(*) FROM faturas WHERE mes_referencia = UPPER(mes_referencia);
SELECT 'Preços kWh atualizados:', COUNT(*) FROM precos_kwh WHERE mes_referencia = UPPER(mes_referencia);
SELECT 'Geração mensal atualizada:', COUNT(*) FROM geracao_mensal WHERE mes_referencia = UPPER(mes_referencia);
