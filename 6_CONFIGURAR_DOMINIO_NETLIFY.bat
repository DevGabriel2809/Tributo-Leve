@echo off
setlocal
title Tributo Leve - Configurar dominio no Netlify
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CONFIGURAR_DOMINIO_NETLIFY.ps1"
if errorlevel 1 (
  echo.
  echo ERRO: confira a mensagem acima.
) else (
  echo.
  echo Configuracao automatica do Netlify concluida.
)
echo.
pause
