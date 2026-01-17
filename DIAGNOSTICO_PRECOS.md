# Diagnóstico de Preços kWh

## Como verificar os preços cadastrados

Execute este comando no terminal (na raiz do projeto):

```bash
docker-compose exec db psql -U postgres -d soltech -c "SELECT mes_referencia, preco_kwh_calculado, tusd, te, icms, created_at::date FROM precos_kwh ORDER BY mes_referencia DESC;"
```

## O que verificar:

1. **Formato dos meses**: Estão como "JAN/2026" (MAIÚSCULO) ou "Jan/2026" (PrimeiraLetraMaiúscula)?
2. **Valores de preço**: Conferir se o preço de JAN/2026 está correto (deve ser ~1.125192)
3. **Quantidade de registros**: Quantos meses têm preço cadastrado?

## Comandos úteis adicionais:

### Ver todos os meses cadastrados:
```bash
docker-compose exec db psql -U postgres -d soltech -c "SELECT DISTINCT mes_referencia FROM precos_kwh ORDER BY mes_referencia DESC;"
```

### Buscar preço de Janeiro/2026 (case-insensitive):
```bash
docker-compose exec db psql -U postgres -d soltech -c "SELECT mes_referencia, preco_kwh_calculado FROM precos_kwh WHERE UPPER(mes_referencia) = 'JAN/2026';"
```

### Contar quantos formatos diferentes existem:
```bash
docker-compose exec db psql -U postgres -d soltech -c "SELECT mes_referencia FROM precos_kwh;"
```

## Após verificar:

Me envie a saída do primeiro comando para eu ver:
- Se os meses estão em formato misto (Jan vs JAN)
- Se o preço de Janeiro está correto
- Se precisa rodar a migração de normalização
