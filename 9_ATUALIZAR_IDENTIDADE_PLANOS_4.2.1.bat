@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
cls
echo ============================================================
echo     TRIBUTO LEVE 4.2.1 - NOVA IDENTIDADE DOS PLANOS
echo ============================================================
echo.
echo Este passo altera apenas os nomes comerciais e o destaque:
echo   Leve Start  - mensal, 1 CNPJ
echo   Leve Pro    - mensal, ate 4 CNPJs
echo   Leve Prime  - trimestral, recomendado
echo.
echo Precos, slugs, assinaturas e pagamentos NAO sao alterados.
echo.
start "" "%~dp0supabase\migrations\009_identidade_planos_leve_4.2.1.sql"
echo Copie TODO o SQL aberto, cole no Supabase SQL Editor e clique em Run.
echo.
echo No final confirme:
echo   leve_start_ok              true
echo   leve_pro_ok                true
echo   leve_prime_recomendado_ok  true
echo.
pause
endlocal
