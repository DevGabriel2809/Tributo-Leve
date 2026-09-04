@echo off
cd /d "%~dp0"
echo.
echo ============================================================
echo    TRIBUTO LEVE - MIGRACAO MERCADO PAGO ORDERS API
echo ============================================================
echo.
echo O arquivo SQL sera aberto no Bloco de Notas.
echo Copie TODO o conteudo, cole no SQL Editor do Supabase e clique Run.
echo No final devem aparecer tres colunas com TRUE.
echo.
start "" notepad.exe "%~dp0supabase\migrations\003_mercado_pago_orders.sql"
start "" "https://supabase.com/dashboard"
pause
