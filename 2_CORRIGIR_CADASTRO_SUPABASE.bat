@echo off
setlocal EnableExtensions
title Tributo Leve - Corrigir cadastro no Supabase
cd /d "%~dp0"

echo.
echo ============================================================
echo        TRIBUTO LEVE - CORRECAO DO CADASTRO/CPF
echo ============================================================
echo.
echo Esta correcao NAO altera o valor do plano, pagamentos ou usuarios.
echo.
echo 1. No Bloco de Notas, pressione Ctrl+A e Ctrl+C.
echo 2. Cole no SQL Editor do Supabase.
echo 3. Clique em Run e aguarde Success.
echo 4. No resultado, confirme true nas tres colunas *_ok.
echo 5. Depois execute 0_PUBLICAR_SITE.bat.
echo.
start "" "https://supabase.com/dashboard"
start "" notepad "%~dp0supabase\migrations\002_corrigir_cadastro_cpf.sql"
echo As duas janelas foram abertas.
echo.
pause
exit /b 0
