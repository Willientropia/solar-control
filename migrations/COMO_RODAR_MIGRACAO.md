# Como Rodar a Migração 0005

## Problema Resolvido

Esta migração normaliza todos os meses no banco de dados de `"Jan/2026"` para `"JAN/2026"` (MAIÚSCULO).

**Por que isso é necessário?**
- O app estava usando formatos inconsistentes (`Jan/2026` vs `JAN/2026`)
- Comparações exatas falhavam: `"Jan/2026" !== "JAN/2026"`
- Faturas importadas não eram detectadas, causando alertas falsos de "Faturas Pendentes"

## Passo a Passo

### 1️⃣ Certifique-se que o Docker está rodando

```bash
docker-compose ps
```

Você deve ver os containers `app` e `db` rodando.

### 2️⃣ Rode a migração

**No Windows (PowerShell ou CMD):**
```bash
migrations\run_migration_docker.bat
```

**No Linux/Mac:**
```bash
bash migrations/run_migration_docker.sh
```

**OU manualmente:**
```bash
docker-compose exec -T db psql -U postgres -d soltech < migrations/0005_normalize_existing_months.sql
```

### 3️⃣ Verifique os resultados

```bash
docker-compose exec db psql -U postgres -d soltech -c "SELECT DISTINCT mes_referencia FROM faturas ORDER BY mes_referencia DESC LIMIT 10;"
```

Você deve ver apenas meses em MAIÚSCULO:
```
 mes_referencia
----------------
 JAN/2026
 DEZ/2025
 NOV/2025
```

## O que a migração faz?

```sql
-- Normaliza faturas (Jan/2026 -> JAN/2026)
UPDATE faturas
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);

-- Normaliza preços kWh
UPDATE precos_kwh
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);

-- Normaliza geração mensal
UPDATE geracao_mensal
SET mes_referencia = UPPER(mes_referencia)
WHERE mes_referencia IS NOT NULL
  AND mes_referencia != ''
  AND mes_referencia != UPPER(mes_referencia);
```

## Problemas Comuns

### "docker-compose: command not found"

Tente:
```bash
docker compose exec -T db psql -U postgres -d soltech < migrations/0005_normalize_existing_months.sql
```

### "No such file or directory"

Certifique-se de estar na raiz do projeto (`Solar-Control/`) antes de rodar o comando.

## Após a migração

1. ✅ Todas as faturas serão detectadas corretamente
2. ✅ O alerta "Faturas Pendentes" funcionará corretamente
3. ✅ Formato consistente em todo o app: `JAN/2026`, `FEV/2026`, etc.
