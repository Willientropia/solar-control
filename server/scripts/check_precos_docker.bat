@echo off
REM Script para verificar preços de kWh no banco Docker

echo.
echo 📊 Verificando precos de kWh no banco Docker...
echo.

docker-compose exec -T db psql -U postgres -d soltech < server\scripts\check_precos_kwh.sql

echo.
echo ✅ Verificação concluída!
echo.
pause
