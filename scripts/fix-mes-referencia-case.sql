-- Normaliza mesReferencia para Title Case (Jan/2026, Fev/2026, ..., Dez/2026)
-- Corrige entradas criadas em MAIÚSCULO (ex: "MAR/2026") para o formato padrão do app.
--
-- Uso:
--   psql -U <user> -d <database> -f scripts/fix-mes-referencia-case.sql

BEGIN;

-- Função auxiliar: retorna o mês em Title Case, ano preservado.
CREATE OR REPLACE FUNCTION _title_case_mes(ref TEXT) RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  mes TEXT;
  ano TEXT;
BEGIN
  IF ref IS NULL OR ref = '' OR position('/' in ref) = 0 THEN
    RETURN ref;
  END IF;
  parts := string_to_array(ref, '/');
  mes := parts[1];
  ano := parts[2];
  IF length(mes) < 1 THEN
    RETURN ref;
  END IF;
  RETURN upper(substring(mes from 1 for 1)) || lower(substring(mes from 2)) || '/' || ano;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Atualiza as tabelas que armazenam mesReferencia
UPDATE geracao_mensal
SET mes_referencia = _title_case_mes(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> _title_case_mes(mes_referencia);

UPDATE faturas
SET mes_referencia = _title_case_mes(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> _title_case_mes(mes_referencia);

UPDATE precos_kwh
SET mes_referencia = _title_case_mes(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia <> _title_case_mes(mes_referencia);

DROP FUNCTION _title_case_mes(TEXT);

COMMIT;
