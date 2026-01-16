# Como Aplicar a Migração de Normalização de Mês

## ⚠️ ATUALIZAÇÃO: Use a migração 0005

**Use o arquivo:** `0005_normalize_existing_months.sql` (mais recente)

## Problema
O banco de dados tem meses em formatos mistos:
- `Jan/2026` (primeira letra maiúscula)
- `JAN/2026` (tudo maiúsculo)
- `Dez/2025` vs `DEZ/2025`

Isso impede que as faturas sejam filtradas corretamente.

## Solução
Normalizar TODOS os meses para MAIÚSCULO: `JAN/2026`, `DEZ/2025`

## Opção 1: Via Docker Compose (RECOMENDADO)

```bash
# 1. Entre no container do banco de dados
docker-compose exec db bash

# 2. Conecte ao banco como usuário postgres
psql -U postgres -d postgres

# 3. Cole e execute os comandos SQL:
UPDATE faturas SET mes_referencia = UPPER(mes_referencia) WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);
UPDATE precos_kwh SET mes_referencia = UPPER(mes_referencia) WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);
UPDATE geracao_mensal SET mes_referencia = UPPER(mes_referencia) WHERE mes_referencia IS NOT NULL AND mes_referencia != '' AND mes_referencia != UPPER(mes_referencia);

# 4. Verifique os resultados
SELECT COUNT(*) FROM faturas WHERE mes_referencia = UPPER(mes_referencia);
SELECT COUNT(*) FROM precos_kwh WHERE mes_referencia = UPPER(mes_referencia);
SELECT COUNT(*) FROM geracao_mensal WHERE mes_referencia = UPPER(mes_referencia);

# 5. Saia do psql e do container
\q
exit
```

## Opção 2: Via pgAdmin (SE PREFERIR GUI)

1. Abra pgAdmin
2. Conecte ao seu banco de dados PostgreSQL
3. Abra a Query Tool
4. Cole o conteúdo do arquivo `0004_normalize_month_format.sql`
5. Clique em Execute/Run (F5)

## Opção 3: Comando Direto (Uma Linha) ⭐ MAIS FÁCIL

```bash
docker-compose exec -T db psql -U postgres -d postgres < migrations/0005_normalize_existing_months.sql
```

Ou usando o arquivo antigo:
```bash
docker-compose exec -T db psql -U postgres -d postgres < migrations/0004_normalize_month_format.sql
```

## Verificação

Após executar, você verá algo como:
```
UPDATE 150  (faturas atualizadas)
UPDATE 12   (preços kWh atualizados)
UPDATE 48   (geração mensal atualizada)
```

## IMPORTANTE

⚠️ **Esta migração deve ser executada APENAS UMA VEZ**

Depois que rodar:
- Todos os novos dados já serão salvos em maiúsculo automaticamente
- Os filtros de mês funcionarão perfeitamente
- Não haverá mais duplicação de meses no banco
