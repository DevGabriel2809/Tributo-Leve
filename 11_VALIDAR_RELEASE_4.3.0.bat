@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Tributo Leve 4.3.0 - Validacao completa

echo ============================================================
echo       TRIBUTO LEVE 4.3.0 - VALIDACAO DA RELEASE
echo ============================================================
echo.
call npm ci
if errorlevel 1 goto FAIL
call npm run quality
if errorlevel 1 goto FAIL
call npm run build
if errorlevel 1 goto FAIL
call npm run perf:budget
if errorlevel 1 goto FAIL

echo.
echo [OK] TypeScript, motor, estrutura, segredos, APIs, SEO, build e budget passaram.
pause
exit /b 0
:FAIL
echo.
echo [ERRO] A validacao parou. Corrija a mensagem acima antes de publicar.
pause
exit /b 1
