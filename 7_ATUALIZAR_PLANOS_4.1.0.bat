@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo        TRIBUTO LEVE - PLANOS 4.1.0
echo ============================================================
echo.
echo 1. O SQL sera aberto agora.
echo 2. Copie TODO o conteudo.
echo 3. Cole no SQL Editor do Supabase e clique em Run.
echo 4. Confirme que basico_ok, pro_mensal_ok, pro_trimestral_ok e limites_ok = true.
echo.
start "" notepad "%~dp0supabase\migrations\006_planos_periodicos_demo.sql"
start "" "https://supabase.com/dashboard"
pause
