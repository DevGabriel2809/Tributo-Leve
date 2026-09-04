@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Tributo Leve 4.4.1 - Atualizar banco

echo ==============================================================
echo   TRIBUTO LEVE 4.4.1 - LEVE OFFICE / CENTRAL 2027-2033
echo ==============================================================
echo.
echo Este passo atualiza o MESMO Supabase e NAO apaga dados.
echo A migration e idempotente e NAO sobrescreve o preco do Leve Office
echo caso voce ja tenha alterado esse preco pelo painel Admin.
echo.
echo Execute este passo UMA VEZ antes de publicar a v4.4.1.
echo.
echo 1. Abra o SQL Editor do seu projeto Supabase.
echo 2. Execute TODO o arquivo:
echo.
echo    supabase\migrations\011_leve_office_central_decisao_4.4.1.sql
echo.
echo O arquivo sera aberto no Bloco de Notas agora.
echo.
start "" notepad "%~dp0supabase\migrations\011_leve_office_central_decisao_4.4.1.sql"
pause
endlocal
