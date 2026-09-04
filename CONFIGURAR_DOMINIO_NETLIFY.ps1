$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Run-Netlify([string[]]$Arguments) {
    & npx.cmd --yes netlify-cli@latest @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Netlify CLI retornou codigo $LASTEXITCODE." }
}

$statePath = Join-Path $PSScriptRoot ".netlify\state.json"
if (-not (Test-Path $statePath)) {
    throw "Projeto ainda nao esta vinculado. Execute 0_PUBLICAR_SITE.bat uma vez para vincular o site."
}
$siteId = (Get-Content $statePath -Raw | ConvertFrom-Json).siteId
if (-not $siteId) { throw "siteId nao encontrado em .netlify\state.json." }

Write-Host "" 
Write-Host "============================================================" -ForegroundColor Green
Write-Host "     TRIBUTO LEVE - DOMINIO E IDENTIDADE NO NETLIFY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Site ID: $siteId"

# 1) Tenta renomear o projeto. Se o nome estiver ocupado, o dominio customizado continua funcionando.
try {
    $renameData = @{ site_id = $siteId; body = @{ name = "tributoleve" } } | ConvertTo-Json -Compress -Depth 6
    Run-Netlify @("api", "updateSite", "--data", $renameData)
    Write-Host "[OK] Nome do projeto solicitado: tributoleve" -ForegroundColor Green
} catch {
    Write-Warning "Nao foi possivel renomear o subdominio .netlify.app automaticamente. Isso NAO impede o dominio tributoleve.com.br."
    Write-Warning $_.Exception.Message
}

# 2) Anexa o dominio comprado como dominio principal de producao.
try {
    $domainData = @{
        site_id = $siteId
        body = @{
            custom_domain = "tributoleve.com.br"
            domain_aliases = @("www.tributoleve.com.br")
        }
    } | ConvertTo-Json -Compress -Depth 8
    Run-Netlify @("api", "updateSite", "--data", $domainData)
    Write-Host "[OK] Dominio tributoleve.com.br enviado ao Netlify." -ForegroundColor Green
} catch {
    Write-Warning "Nao foi possivel anexar o dominio pela API. Abra Netlify > Domain management e adicione tributoleve.com.br manualmente."
    Write-Warning $_.Exception.Message
}

# 3) Variaveis que fazem links, convites e build apontarem para a nova URL.
Run-Netlify @("env:set", "APP_URL", "https://tributoleve.com.br", "--context", "production", "--force")
Run-Netlify @("env:set", "VITE_APP_URL", "https://tributoleve.com.br", "--context", "production", "--force")
Write-Host "[OK] APP_URL e VITE_APP_URL atualizadas." -ForegroundColor Green

Write-Host ""
Write-Host "AGORA, NA GODADDY > DNS:" -ForegroundColor Yellow
Write-Host "  A      @      75.2.60.5"
Write-Host "  CNAME  www    SEU-SITE.netlify.app  (use o destino exato mostrado pelo Netlify)"
Write-Host ""
Write-Host "Se o Netlify informar outro destino CNAME, use o valor exibido em Domain management > Production domains." -ForegroundColor Yellow
Write-Host "O SSL HTTPS sera provisionado pelo Netlify depois que o DNS estiver correto." -ForegroundColor Cyan
Write-Host ""
