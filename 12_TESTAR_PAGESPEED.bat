@echo off
setlocal
cd /d "%~dp0"
title Tributo Leve - PageSpeed e performance

echo ============================================================
echo        TRIBUTO LEVE - TESTE DE PERFORMANCE
echo ============================================================
echo.
echo [1/2] Conferindo o tamanho do bundle local...
call npm run perf:budget
if errorlevel 1 goto ERROR

echo.
echo [2/2] Abrindo o PageSpeed Insights para o dominio de producao...
start "" "https://pagespeed.web.dev/analysis?url=https%%3A%%2F%%2Ftributoleve.com.br%%2F"
echo.
echo Rode os testes Mobile e Desktop e priorize Core Web Vitals e Performance.
echo.
pause
exit /b 0
:ERROR
echo Falha ao analisar o bundle. Execute npm run build primeiro.
pause
exit /b 1
