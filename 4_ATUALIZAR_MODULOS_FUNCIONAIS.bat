@echo off
setlocal
cd /d "%~dp0"
cls
echo ============================================================
echo        TRIBUTO LEVE - MODULOS FUNCIONAIS 4.0.0
echo ============================================================
echo.
echo 1. O SQL da atualizacao sera aberto no Bloco de Notas.
echo 2. Copie TODO o conteudo.
echo 3. Abra o SQL Editor do Supabase.
echo 4. Cole e clique em Run.
echo 5. O resultado deve mostrar cinco colunas com TRUE.
echo.
start "" notepad "%~dp0supabase\migrations\004_modulos_funcionais.sql"
start "" "https://supabase.com/dashboard"
echo.
echo Depois do SQL, execute 0_PUBLICAR_SITE.bat.
echo.
pause
endlocal
