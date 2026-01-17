@echo off
REM Script para rodar migração 0005 no banco Docker (Windows)

echo.
echo 🐳 Rodando migração 0005 no banco Docker (soltech)...
echo.

REM Executar a migração SQL dentro do container Docker
docker-compose exec -T db psql -U postgres -d soltech < migrations\0005_normalize_existing_months.sql

echo.
echo ✅ Migração concluída!
echo.
echo Para verificar os resultados, rode:
echo   docker-compose exec db psql -U postgres -d soltech -c "SELECT DISTINCT mes_referencia FROM faturas ORDER BY mes_referencia DESC LIMIT 10;"
echo.
pause
