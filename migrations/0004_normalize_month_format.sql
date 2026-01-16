-- Normalizar formato de mês para MAIÚSCULO em todas as tabelas
-- Corrige inconsistências: Jan/2026 -> JAN/2026, Dez/2025 -> DEZ/2025

-- Normalizar faturas
UPDATE faturas
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '';

-- Normalizar preços kWh
UPDATE precos_kwh
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '';

-- Normalizar geração mensal
UPDATE geracao_mensal
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL AND mes_referencia != '';
