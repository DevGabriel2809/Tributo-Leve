@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Tributo Leve - GitHub seguro

set "REPO_OWNER=DevGabriel2809"
set "REPO_NAME=Tributo-Leve"
set "REPO_FULL=%REPO_OWNER%/%REPO_NAME%"
set "REPO_URL=https://github.com/%REPO_FULL%.git"

echo ============================================================
echo        TRIBUTO LEVE - PUBLICACAO SEGURA NO GITHUB
echo ============================================================
echo.
echo Este script publica somente os arquivos permitidos pelo .gitignore.
echo Ele nunca deve adicionar .env, .netlify, node_modules ou dist.
echo.

rem ------------------------------------------------------------
rem 1. GitHub CLI
rem ------------------------------------------------------------
where gh >nul 2>&1
if errorlevel 1 (
  echo [ERRO] GitHub CLI ^(gh^) nao encontrado.
  echo Instale em: https://cli.github.com/
  pause
  exit /b 1
)

rem ------------------------------------------------------------
rem 2. Git for Windows
rem ------------------------------------------------------------
call :ensure_git
if errorlevel 1 exit /b 1

echo [OK] Git encontrado:
call git --version

echo.
echo [1/5] Conferindo login do GitHub...
call gh auth status
if errorlevel 1 (
  call gh auth login
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel autenticar no GitHub.
    pause
    exit /b 1
  )
)

echo.
echo [2/5] Executando auditoria de segredos...
call npm run security:scan
if errorlevel 1 (
  echo [ERRO] A auditoria de segredos falhou. Nada sera publicado.
  pause
  exit /b 1
)

echo.
echo [3/5] Preparando repositorio Git local...
if not exist ".git" (
  call git init
  if errorlevel 1 goto :git_error
)

call git branch -M main
if errorlevel 1 goto :git_error

rem Configura identidade local apenas se ainda nao existir.
for /f "delims=" %%U in ('git config --get user.name 2^>nul') do set "GIT_USER_NAME=%%U"
if not defined GIT_USER_NAME (
  call git config user.name "%REPO_OWNER%"
)
for /f "delims=" %%E in ('git config --get user.email 2^>nul') do set "GIT_USER_EMAIL=%%E"
if not defined GIT_USER_EMAIL (
  call git config user.email "%REPO_OWNER%@users.noreply.github.com"
)

call git add .
if errorlevel 1 goto :git_error

rem Defesa adicional: interrompe se algo claramente proibido estiver rastreado.
for /f "delims=" %%F in ('git ls-files') do (
  set "TRACKED=%%F"
  if /I "!TRACKED!"==".env" goto :blocked_file
  if /I "!TRACKED:~0,5!"==".env." goto :blocked_file
  if /I "!TRACKED:~0,9!"==".netlify/" goto :blocked_file
  if /I "!TRACKED:~0,13!"=="node_modules/" goto :blocked_file
  if /I "!TRACKED:~0,5!"=="dist/" goto :blocked_file
)

echo.
echo Arquivos que serao considerados para o commit:
call git status --short

echo.
echo Confira a lista acima. Nenhum .env ou segredo deve aparecer.
choice /c SN /n /m "Publicar como repositorio PUBLICO %REPO_FULL%? (S/N): "
if errorlevel 2 exit /b 0

echo.
echo [4/5] Criando commit...
call git diff --cached --quiet
if errorlevel 1 (
  call git commit -m "Tributo Leve v4.3.1"
  if errorlevel 1 goto :git_error
) else (
  call git rev-parse --verify HEAD >nul 2>&1
  if errorlevel 1 (
    echo [ERRO] Nenhum arquivo foi adicionado ao primeiro commit.
    pause
    exit /b 1
  ) else (
    echo Nenhuma alteracao nova para commit. Usando o commit atual.
  )
)

echo.
echo [5/5] Criando/vinculando repositorio remoto e enviando...
call gh repo view "%REPO_FULL%" >nul 2>&1
if errorlevel 1 (
  echo Repositorio remoto ainda nao existe. Criando %REPO_FULL%...
  call gh repo create "%REPO_NAME%" --public --source=. --remote=origin
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel criar o repositorio no GitHub.
    pause
    exit /b 1
  )
) else (
  echo Repositorio remoto ja existe. Conferindo remote origin...
  call git remote get-url origin >nul 2>&1
  if errorlevel 1 (
    call git remote add origin "%REPO_URL%"
  ) else (
    call git remote set-url origin "%REPO_URL%"
  )
)

call git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERRO] O GitHub foi configurado, mas o push falhou.
  echo Tente novamente com:
  echo   git push -u origin main
  pause
  exit /b 1
)

echo.
echo ============================================================
echo PUBLICADO COM SUCESSO
echo https://github.com/%REPO_FULL%
echo ============================================================
pause
exit /b 0

:ensure_git
where git >nul 2>&1
if not errorlevel 1 exit /b 0

rem Tenta locais padrao do Git for Windows antes de instalar.
if exist "%ProgramFiles%\Git\cmd\git.exe" (
  set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
  exit /b 0
)
if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" (
  set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
  exit /b 0
)
if exist "%LocalAppData%\Programs\Git\cmd\git.exe" (
  set "PATH=%LocalAppData%\Programs\Git\cmd;%PATH%"
  exit /b 0
)

echo [AVISO] Git for Windows nao foi encontrado.
where winget >nul 2>&1
if errorlevel 1 (
  echo Instale o Git for Windows e execute este script novamente:
  echo https://git-scm.com/download/win
  pause
  exit /b 1
)

choice /c SN /n /m "Deseja instalar o Git for Windows automaticamente com winget? (S/N): "
if errorlevel 2 (
  echo Instale manualmente em https://git-scm.com/download/win e rode novamente.
  pause
  exit /b 1
)

call winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  echo [ERRO] A instalacao automatica do Git falhou.
  echo Instale manualmente em https://git-scm.com/download/win
  pause
  exit /b 1
)

rem Atualiza o PATH desta janela sem exigir reinicio do Windows.
if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "PATH=%LocalAppData%\Programs\Git\cmd;%PATH%"
where git >nul 2>&1
if errorlevel 1 (
  echo [AVISO] O Git foi instalado, mas esta janela ainda nao o localizou.
  echo Feche este terminal, abra o script novamente e tente de novo.
  pause
  exit /b 1
)
exit /b 0

:blocked_file
echo.
echo [ERRO DE SEGURANCA] Arquivo proibido foi rastreado pelo Git:
echo   !TRACKED!
echo Nada foi publicado. Revise o .gitignore antes de continuar.
pause
exit /b 1

:git_error
echo.
echo [ERRO] Um comando do Git falhou. Nada foi enviado nesta etapa.
pause
exit /b 1
