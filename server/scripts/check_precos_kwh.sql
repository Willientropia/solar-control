-- Script para verificar preços de kWh no banco

\echo '📋 Preços de kWh cadastrados:\n'

SELECT
  mes_referencia AS "Mês Ref.",
  preco_kwh_calculado AS "Preço kWh Calculado",
  tusd AS "TUSD",
  te AS "TE",
  icms AS "ICMS (%)",
  created_at::date AS "Criado em"
FROM precos_kwh
ORDER BY mes_referencia DESC;

\echo '\n🔤 Formatos de mês encontrados:\n'

SELECT DISTINCT
  CASE
    WHEN SUBSTRING(mes_referencia, 1, 3) = UPPER(SUBSTRING(mes_referencia, 1, 3)) THEN 'MAIÚSCULO (ex: JAN/2026)'
    WHEN SUBSTRING(mes_referencia, 1, 1) = UPPER(SUBSTRING(mes_referencia, 1, 1)) THEN 'PrimeiraLetraMaiúscula (ex: Jan/2026)'
    ELSE 'minúsculo (ex: jan/2026)'
  END AS "Formato"
FROM precos_kwh;

\echo '\n🧪 Teste de busca: Janeiro/2026\n'

SELECT 'JAN/2026' AS "Buscando", mes_referencia AS "Encontrado", preco_kwh_calculado AS "Preço"
FROM precos_kwh
WHERE mes_referencia = 'JAN/2026'
UNION ALL
SELECT 'Jan/2026', mes_referencia, preco_kwh_calculado
FROM precos_kwh
WHERE mes_referencia = 'Jan/2026'
UNION ALL
SELECT 'jan/2026', mes_referencia, preco_kwh_calculado
FROM precos_kwh
WHERE mes_referencia = 'jan/2026';

\echo '\n🔍 Busca case-insensitive para JAN/2026:\n'

SELECT mes_referencia AS "Mês Encontrado", preco_kwh_calculado AS "Preço"
FROM precos_kwh
WHERE UPPER(mes_referencia) = 'JAN/2026';

\echo '\n📊 Total de registros:\n'

SELECT COUNT(*) AS "Total de Preços Cadastrados" FROM precos_kwh;
