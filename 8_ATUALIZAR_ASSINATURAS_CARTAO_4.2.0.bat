@echo off
setlocal
cd /d "%~dp0"
cls
echo ===========================================================
echo TRIBUTO LEVE 4.2.0 - ASSINATURAS + HARDENING
echo ===========================================================
echo.
echo Este script abre UM SQL completo contendo:
echo   - 007_assinaturas_cartao_4.2.0.sql
echo   - 008_seguranca_hardening.sql
echo.
echo PASSO:
echo  1. Supabase ^> SQL Editor ^> New query
echo  2. Copie TODO o arquivo que sera aberto
echo  3. Cole no SQL Editor e clique Run
echo  4. Confirme que as verificacoes finais retornam TRUE
echo.
start "" notepad "%CD%\supabase\APLICAR_4.2.0_COMPLETO.sql"
echo.
echo Depois do SQL aprovado, siga LEIA_PRIMEIRO_4.2.0.txt e execute 0_PUBLICAR_SITE.bat.
pause
