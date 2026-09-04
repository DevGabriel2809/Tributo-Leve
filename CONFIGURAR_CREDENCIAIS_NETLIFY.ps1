$ErrorActionPreference = "Stop"

function Invoke-Netlify {
    param([string[]]$NetlifyArgs, [switch]$AllowFailure, [switch]$Quiet)
    if ($Quiet) { & npx.cmd --yes netlify-cli@latest @NetlifyArgs *> $null }
    else { & npx.cmd --yes netlify-cli@latest @NetlifyArgs | Out-Host }
    if ($LASTEXITCODE -ne 0) {
        if ($AllowFailure) { return $false }
        throw "O Netlify recusou a configuracao da variavel."
    }
    return $true
}

function Convert-SecureValue {
    param([Security.SecureString]$Value)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Set-PrivateVariable {
    param([string]$Name, [string]$Prompt, [string]$ExpectedPrefix = "")
    while ($true) {
        $secure = Read-Host $Prompt -AsSecureString
        $plain = Convert-SecureValue $secure
        if ([string]::IsNullOrWhiteSpace($plain)) {
            Write-Host "$Name mantida sem alteracao." -ForegroundColor Yellow
            return
        }
        if ($ExpectedPrefix -and -not $plain.StartsWith($ExpectedPrefix)) {
            $plain = $null
            Write-Host "O valor informado nao comeca com $ExpectedPrefix" -ForegroundColor Yellow
            continue
        }
        try {
            $protected = Invoke-Netlify -NetlifyArgs @("env:set", $Name, $plain, "--context", "production", "--secret", "--force") -AllowFailure
            if (-not $protected) {
                Write-Host "O Secrets Controller nao respondeu. Aplicando modo compativel..." -ForegroundColor Yellow
                Invoke-Netlify -NetlifyArgs @("env:set", $Name, $plain, "--context", "production", "--force") | Out-Null
            }
            Write-Host "$Name configurada sem gravar o valor no projeto." -ForegroundColor Green
            return
        }
        finally {
            $plain = $null
            [GC]::Collect()
        }
    }
}

function Set-PublicVariable {
    param([string]$Name, [string]$Prompt)
    $plain = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($plain)) {
        Write-Host "$Name mantida sem alteracao." -ForegroundColor Yellow
        return
    }
    Invoke-Netlify -NetlifyArgs @("env:set", $Name, $plain.Trim(), "--context", "production", "--force") | Out-Null
    Write-Host "$Name configurada para o build de producao." -ForegroundColor Green
}

function Set-PlainVariableValue {
    param([string]$Name, [string]$Value)
    Invoke-Netlify -NetlifyArgs @("env:set", $Name, $Value, "--context", "production", "--force") | Out-Null
}

function Test-NetlifyVariable {
    param([string]$Name, [switch]$Silent)
    & npx.cmd --yes netlify-cli@latest env:get $Name --context production *> $null
    $found = ($LASTEXITCODE -eq 0)
    if (-not $Silent) {
        if ($found) { Write-Host "[OK] $Name encontrada no ambiente Production." -ForegroundColor Green }
        else { Write-Host "[ERRO] $Name nao foi encontrada no ambiente Production." -ForegroundColor Red }
    }
    return $found
}

Write-Host "Configurando dominio publico do Tributo Leve..." -ForegroundColor Cyan
Set-PlainVariableValue "APP_URL" "https://tributoleve.com.br"
Set-PlainVariableValue "VITE_APP_URL" "https://tributoleve.com.br"

Write-Host ""
Write-Host "Supabase - dados publicos do projeto." -ForegroundColor Cyan
Write-Host "A URL e a publishable key podem aparecer no navegador. A seguranca depende de RLS e grants corretos." -ForegroundColor DarkGray
$supabaseUrl = Read-Host "Cole a Project URL do Supabase ou Enter para manter a atual"
if (-not [string]::IsNullOrWhiteSpace($supabaseUrl)) {
    Set-PlainVariableValue "SUPABASE_URL" $supabaseUrl.Trim()
    Set-PlainVariableValue "VITE_SUPABASE_URL" $supabaseUrl.Trim()
    Write-Host "URLs do Supabase atualizadas." -ForegroundColor Green
} else {
    Write-Host "SUPABASE_URL e VITE_SUPABASE_URL mantidas." -ForegroundColor Yellow
}
Set-PublicVariable "VITE_SUPABASE_ANON_KEY" "Cole a Publishable Key do Supabase ou Enter para manter a atual"

Write-Host ""
Write-Host "Mercado Pago." -ForegroundColor Cyan
Set-PublicVariable "VITE_MERCADO_PAGO_PUBLIC_KEY" "Cole a Public Key DE PRODUCAO do Mercado Pago ou Enter para manter a atual"

Write-Host ""
Write-Host "SEO, Analytics e dados publicos opcionais." -ForegroundColor Cyan
Set-PublicVariable "VITE_GA_MEASUREMENT_ID" "GA4 Measurement ID (G-...) ou Enter para manter/desativado"
Set-PublicVariable "VITE_GOOGLE_SITE_VERIFICATION" "Token META do Google Search Console ou Enter para manter/desativado"
Set-PublicVariable "VITE_PUBLIC_CONTACT_EMAIL" "E-mail publico para rodape/seguranca ou Enter para manter"
Set-PublicVariable "VITE_PUBLIC_COMPANY_NAME" "Razao/nome empresarial publico ou Enter para manter"
Set-PublicVariable "VITE_PUBLIC_CNPJ" "CNPJ publico para o rodape ou Enter para manter"
Set-PublicVariable "VITE_PUBLIC_CITY" "Cidade/UF publica para o rodape ou Enter para manter"

Write-Host ""
$turnstile = Read-Host "Deseja configurar/atualizar Cloudflare Turnstile anti-bot agora? (S/N)"
if ($turnstile -match '^[sS]') {
    Set-PublicVariable "VITE_TURNSTILE_SITE_KEY" "Cole a Site Key PUBLICA do Turnstile"
    Set-PrivateVariable "TURNSTILE_SECRET_KEY" "Cole a Secret Key PRIVADA do Turnstile"
    Set-PlainVariableValue "TURNSTILE_REQUIRED" "true"
    Write-Host "Turnstile marcado como obrigatorio em producao." -ForegroundColor Green
} else {
    Write-Host "Configuracao atual do Turnstile mantida." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Chaves privadas: nunca recebem prefixo VITE_ ou NEXT_PUBLIC_." -ForegroundColor Cyan
$configure = Read-Host "Deseja configurar ou atualizar as chaves privadas principais agora? (S/N)"
if ($configure -match '^[sS]') {
    Set-PrivateVariable "SUPABASE_SECRET_KEY" "Cole a chave sb_secret do Supabase ou Enter para manter a atual" "sb_secret_"
    Set-PrivateVariable "MERCADO_PAGO_ACCESS_TOKEN" "Cole o Access Token DE PRODUCAO do Mercado Pago ou Enter para manter o atual" "APP_USR-"
    Set-PrivateVariable "MERCADO_PAGO_WEBHOOK_SECRET" "Cole a assinatura secreta do webhook ou Enter para manter a atual"
} else { Write-Host "Chaves privadas mantidas como estao na Netlify." -ForegroundColor Yellow }

Write-Host ""
Write-Host "Verificando variaveis obrigatorias de producao..." -ForegroundColor Cyan
$ok = $true
foreach ($name in @("APP_URL","VITE_APP_URL","SUPABASE_URL","VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","SUPABASE_SECRET_KEY","VITE_MERCADO_PAGO_PUBLIC_KEY","MERCADO_PAGO_ACCESS_TOKEN","MERCADO_PAGO_WEBHOOK_SECRET")) {
    if (-not (Test-NetlifyVariable $name)) { $ok = $false }
}
if (-not $ok) { throw "Uma ou mais variaveis obrigatorias nao foram encontradas no Netlify." }
Write-Host "Variaveis obrigatorias encontradas. Valores privados nao foram exibidos." -ForegroundColor Green
