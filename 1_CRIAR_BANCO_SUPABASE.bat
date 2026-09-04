@echo off
setlocal EnableExtensions
title Tributo Leve - Criar banco no Supabase
cd /d "%~dp0"

echo.
echo ============================================================
echo             TRIBUTO LEVE - BANCO DE DADOS
echo ============================================================
echo.
echo O SQL Editor do Supabase e a migration corrigida serao abertos.
echo.
echo 1. No Bloco de Notas, pressione Ctrl+A e depois Ctrl+C.
echo 2. Cole o texto no SQL Editor do Supabase.
echo 3. Clique em Run.
echo 4. Aguarde a mensagem Success.
echo.
start "" "https://supabase.com/dashboard"
start "" notepad "%~dp0supabase\migrations\001_tributo_leve_saas.sql"
echo As duas janelas foram abertas.
echo Esta migration pode ser executada novamente sem duplicar os dados.
echo.
pause
exit /b 0
