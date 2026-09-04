@echo off
setlocal
title Tributo Leve - Atualizar marca no Supabase
cd /d "%~dp0"

echo ============================================================
echo        TRIBUTO LEVE - ATUALIZAR MARCA NO SUPABASE
echo ============================================================
echo.
echo Este passo NAO apaga usuarios, pagamentos ou cenarios.
echo Ele garante os modulos funcionais e atualiza a identidade comercial no banco.
echo.
start "" "https://supabase.com/dashboard"
start "" notepad "%~dp0supabase\migrations\005_rebrand_tributo_leve.sql"
echo.
echo 1. Copie todo o SQL aberto no Bloco de Notas.
echo 2. Cole no SQL Editor do Supabase.
echo 3. Clique em Run.
echo 4. Confirme que os tres resultados finais aparecem como true.
echo.
pause
