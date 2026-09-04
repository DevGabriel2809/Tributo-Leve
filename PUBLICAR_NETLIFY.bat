@echo off
setlocal EnableExtensions
title Tributo Leve - Publicar no Netlify
cd /d "%~dp0"
echo Dominio oficial: https://tributoleve.com.br

echo.
echo ============================================================
echo          TRIBUTO LEVE - PUBLICACAO NO NETLIFY
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto NODE_ERROR

where npm >nul 2>&1
if errorlevel 1 goto NODE_ERROR

echo [1/7] Node.js encontrado.
node --version
echo.

echo [2/7] Instalando as dependencias do projeto...
call npm ci
if errorlevel 1 goto DEPENDENCY_ERROR
echo.

echo [3/7] Verificando o login do Netlify...
call npx --yes netlify-cli@latest status >nul 2>&1
if not errorlevel 1 goto NETLIFY_READY

echo.
echo O navegador sera aberto para o login no Netlify.
echo Depois do login, volte para esta janela.
echo.
call npx --yes netlify-cli@latest login
if errorlevel 1 goto LOGIN_ERROR

:NETLIFY_READY
echo Login do Netlify confirmado.
echo.

if exist ".netlify\state.json" goto PROJECT_READY

echo [4/7] Escolha como vincular este projeto:
echo.
echo [1] Criar um site novo no Netlify
echo [2] Usar um site que ja existe
echo.
choice /c 12 /n /m "Digite 1 ou 2: "
if errorlevel 2 goto LINK_EXISTING
goto CREATE_NEW

:CREATE_NEW
echo.
echo Criando um site novo...
call npx --yes netlify-cli@latest sites:create
if errorlevel 1 goto LINK_ERROR
goto PROJECT_READY

:LINK_EXISTING
echo.
echo Selecione o site existente na lista do Netlify.
call npx --yes netlify-cli@latest link
if errorlevel 1 goto LINK_ERROR

:PROJECT_READY
echo.
echo [4/7] Projeto vinculado ao Netlify.
echo.
echo [5/7] Configurando as variaveis do ambiente de producao...
echo A integracao usa Orders API para compras avulsas e Preapproval para assinaturas recorrentes.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0CONFIGURAR_CREDENCIAIS_NETLIFY.ps1"
if errorlevel 1 goto CREDENTIAL_ERROR
echo.

echo [6/7] Compilando a versao de producao...
echo Executando auditoria de qualidade e seguranca...
call npm run quality
if errorlevel 1 (
  echo ERRO: auditoria de qualidade falhou. Deploy cancelado.
  pause
  exit /b 1
)

echo.
echo Compilando com o contexto Production da Netlify...
echo Isso injeta somente as variaveis publicas VITE_ no bundle e evita um segundo build durante o deploy.
call npx --yes netlify-cli@latest build --context production
if errorlevel 1 goto BUILD_ERROR

if not exist "dist\index.html" goto BUILD_OUTPUT_ERROR

echo Validando orcamento de performance do bundle...
call npm run perf:budget
if errorlevel 1 (
  echo ERRO: orcamento de performance falhou. Deploy cancelado.
  pause
  exit /b 1
)
echo.

echo [7/7] Publicando o site e as funcoes em producao...
echo.
echo O build ja esta pronto. O deploy sera feito com --no-build para evitar o erro 422 do ciclo onPostBuild.
call npx --yes netlify-cli@latest deploy --prod --no-build --dir=dist --functions=netlify/functions --skip-functions-cache --open --message "Tributo Leve v4.3.1 - hotfix deploy Netlify 422"
if errorlevel 1 goto DEPLOY_RETRY
goto DEPLOY_OK

:DEPLOY_RETRY
echo.
echo AVISO: a primeira tentativa de upload falhou.
echo Limpando apenas o cache local de deploy e tentando mais uma vez sem recompilar...
if exist ".netlify\cache" rmdir /s /q ".netlify\cache" >nul 2>&1
timeout /t 3 /nobreak >nul
call npx --yes netlify-cli@latest deploy --prod --no-build --dir=dist --functions=netlify/functions --skip-functions-cache --open --message "Tributo Leve v4.3.1 - hotfix deploy Netlify 422 retry"
if errorlevel 1 goto DEPLOY_ERROR

:DEPLOY_OK

echo.
echo ============================================================
echo              PUBLICACAO CONCLUIDA
echo ============================================================
echo.
echo O site foi publicado e aberto no navegador.
echo Site, login, funcoes e pagamentos foram publicados.
echo Nas proximas atualizacoes, execute 0_PUBLICAR_SITE.bat novamente.
echo.
pause
exit /b 0

:NODE_ERROR
echo.
echo ERRO: Node.js e npm nao foram encontrados.
echo Instale o Node.js LTS pelo site https://nodejs.org
goto FINAL_ERROR

:DEPENDENCY_ERROR
echo.
echo ERRO: Nao foi possivel instalar as dependencias.
echo Verifique a internet e execute novamente.
goto FINAL_ERROR

:BUILD_ERROR
echo.
echo ERRO: O projeto nao conseguiu compilar.
echo Verifique a mensagem exibida acima.
goto FINAL_ERROR

:BUILD_OUTPUT_ERROR
echo.
echo ERRO: O arquivo dist\index.html nao foi criado.
goto FINAL_ERROR

:LOGIN_ERROR
echo.
echo ERRO: O login do Netlify nao foi concluido.
echo Execute novamente e finalize o login no navegador.
goto FINAL_ERROR

:LINK_ERROR
echo.
echo ERRO: Nao foi possivel criar ou vincular o site.
echo Confira as permissoes da sua conta do Netlify.
goto FINAL_ERROR

:CREDENTIAL_ERROR
echo.
echo ERRO: Nao foi possivel configurar as credenciais na Netlify.
echo Nenhuma chave privada foi gravada no projeto.
goto FINAL_ERROR

:DEPLOY_ERROR
echo.
echo ERRO: O Netlify nao concluiu a publicacao.
echo Confira a mensagem exibida acima e tente novamente.
goto FINAL_ERROR

:FINAL_ERROR
echo.
echo Nenhum arquivo do projeto foi apagado.
echo.
pause
exit /b 1
