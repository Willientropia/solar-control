-- Criar tabela de preços de kWh calculados por mês
CREATE TABLE IF NOT EXISTS precos_kwh (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia TEXT NOT NULL UNIQUE,
  tusd DECIMAL(10, 6) NOT NULL,
  te DECIMAL(10, 6) NOT NULL,
  icms DECIMAL(5, 2) NOT NULL,
  pis DECIMAL(5, 2) NOT NULL,
  cofins DECIMAL(5, 2) NOT NULL,
  preco_kwh_calculado DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índice no mês de referência para buscas rápidas
CREATE INDEX IF NOT EXISTS precos_kwh_mes_referencia_idx ON precos_kwh(mes_referencia);
