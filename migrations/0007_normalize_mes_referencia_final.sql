-- =============================================================================
-- Migration 0007: Normalização final de mes_referencia para "JAN/2026"
--
-- CONTEXTO: O fixMonthConsistency() que rodava no startup convertia dados para
--           "Jan/2026" (Title Case). Essa migration normaliza tudo para
--           "JAN/2026" (UPPERCASE) e corrige anos de 2 dígitos.
--
-- SEGURANÇA: Operação idempotente. Pode ser rodada múltiplas vezes sem dano.
--            UPPER("JAN/2026") = "JAN/2026" (sem mudança se já normalizado).
--
-- COMO EXECUTAR NA VPS COM DOCKER:
--   docker exec -it <nome_container_db> psql -U <usuario> -d <banco>
--   \i /caminho/para/0007_normalize_mes_referencia_final.sql
--
--   OU copiar e colar o conteúdo diretamente no psql.
-- =============================================================================

BEGIN;

-- ── DIAGNÓSTICO ANTES ────────────────────────────────────────────────────────

\echo '=== SITUAÇÃO ATUAL ==='
\echo '--- Faturas: formatos distintos ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM faturas
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

\echo '--- Geração Mensal: formatos distintos ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM geracao_mensal
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

\echo '--- Preços kWh: formatos distintos ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM precos_kwh
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

-- ── STEP 1: Corrigir anos de 2 dígitos (ex: "JAN/26" → "JAN/2026") ──────────

UPDATE faturas
SET mes_referencia = SPLIT_PART(mes_referencia, '/', 1) || '/20' || SPLIT_PART(mes_referencia, '/', 2)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia LIKE '%/%'
  AND LENGTH(SPLIT_PART(mes_referencia, '/', 2)) = 2;

UPDATE geracao_mensal
SET mes_referencia = SPLIT_PART(mes_referencia, '/', 1) || '/20' || SPLIT_PART(mes_referencia, '/', 2)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia LIKE '%/%'
  AND LENGTH(SPLIT_PART(mes_referencia, '/', 2)) = 2;

UPDATE precos_kwh
SET mes_referencia = SPLIT_PART(mes_referencia, '/', 1) || '/20' || SPLIT_PART(mes_referencia, '/', 2)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia LIKE '%/%'
  AND LENGTH(SPLIT_PART(mes_referencia, '/', 2)) = 2;

-- ── STEP 2: Normalizar tudo para UPPERCASE ────────────────────────────────────

UPDATE faturas
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> UPPER(mes_referencia);

UPDATE geracao_mensal
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> UPPER(mes_referencia);

UPDATE precos_kwh
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> UPPER(mes_referencia);

-- ── VERIFICAÇÃO FINAL ─────────────────────────────────────────────────────────

\echo ''
\echo '=== RESULTADO APÓS NORMALIZAÇÃO ==='
\echo '--- Faturas: formatos distintos (esperado: somente JAN/XXXX) ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM faturas
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

\echo '--- Geração Mensal ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM geracao_mensal
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

\echo '--- Preços kWh ---'
SELECT mes_referencia, COUNT(*) as qtd
FROM precos_kwh
WHERE mes_referencia IS NOT NULL
GROUP BY mes_referencia
ORDER BY mes_referencia;

\echo ''
\echo '--- Contagem de registros que ainda NÃO estão no formato canônico ---'
SELECT 'faturas' as tabela, COUNT(*) as nao_normalizados
FROM faturas WHERE mes_referencia IS NOT NULL AND mes_referencia <> UPPER(mes_referencia)
UNION ALL
SELECT 'geracao_mensal', COUNT(*)
FROM geracao_mensal WHERE mes_referencia IS NOT NULL AND mes_referencia <> UPPER(mes_referencia)
UNION ALL
SELECT 'precos_kwh', COUNT(*)
FROM precos_kwh WHERE mes_referencia IS NOT NULL AND mes_referencia <> UPPER(mes_referencia);

-- Se os counts acima forem todos 0, a normalização foi bem-sucedida.

COMMIT;
