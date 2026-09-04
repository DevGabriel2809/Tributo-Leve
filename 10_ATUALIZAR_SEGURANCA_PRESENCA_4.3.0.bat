@echo off
setlocal
cd /d "%~dp0"
title Tributo Leve 4.3.0 - Seguranca e presenca

echo ============================================================
echo   TRIBUTO LEVE 4.3.0 - SEGURANCA, PRIVACIDADE E PRESENCA
echo ============================================================
echo.
echo 1. O SQL sera aberto agora.
echo 2. Copie todo o conteudo para Supabase ^> SQL Editor.
echo 3. Clique em Run uma unica vez.
echo 4. Confira se todos os testes finais retornam true.
echo.
start "" notepad.exe "%~dp0supabase\migrations\010_seguranca_privacidade_presenca_4.3.0.sql"
echo.
pause
