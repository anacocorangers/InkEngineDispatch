param(
    [string]$Project = 'inkeginelive-dispatch',
    [string]$Region = 'us-east1',
    [string]$Service = 'inkengine-dispatch-api',
    [string]$ClientId = '1534592543784964176',
    [string]$RedirectUri = 'https://inkengine-dispatch-api-482705553707.us-east1.run.app/api/discord/callback',
    [string]$SetupUrl = 'https://dispatch.inkengine.live/discord/setup',
    [switch]$ClientSecretFromClipboard
)

$ErrorActionPreference = 'Stop'
$gcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
$gcloudPath = if ($gcloudCommand) { $gcloudCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Google\CloudSDKPortable\google-cloud-sdk\bin\gcloud.cmd' }
if (-not (Test-Path $gcloudPath)) { throw 'Google Cloud CLI was not found.' }

function Invoke-Gcloud {
    & $gcloudPath @args
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed with exit code $LASTEXITCODE" }
}

function Read-SecretText([string]$Prompt) {
    $secureValue = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$clientSecret = if ($ClientSecretFromClipboard) {
    try { (Get-Clipboard -Raw).Trim() }
    finally { Set-Clipboard -Value $null }
}
else {
    (Read-SecretText 'Discord OAuth2 client secret').Trim()
}
if ($clientSecret.Length -lt 20) { throw 'The Discord OAuth2 client secret appears incomplete.' }

$secretName = 'discord-client-secret'
$secretNames = @(& $gcloudPath secrets list --project=$Project --format='value(name)')
if (-not ($secretNames | Where-Object { $_ -eq $secretName -or $_ -like "*/$secretName" })) {
    Invoke-Gcloud secrets create $secretName --project=$Project --replication-policy=automatic
}

$tempFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllText($tempFile, $clientSecret, [Text.UTF8Encoding]::new($false))
    Invoke-Gcloud secrets versions add $secretName --project=$Project --data-file=$tempFile
}
finally {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

$runtimeServiceAccount = (& $gcloudPath run services describe $Service --project=$Project --region=$Region --format='value(spec.template.spec.serviceAccountName)').Trim()
Invoke-Gcloud secrets add-iam-policy-binding $secretName --project=$Project --member="serviceAccount:$runtimeServiceAccount" --role=roles/secretmanager.secretAccessor
Invoke-Gcloud run services update $Service --project=$Project --region=$Region --update-secrets="DISCORD_CLIENT_SECRET=$secretName`:latest" --update-env-vars="DISCORD_CLIENT_ID=$ClientId,DISCORD_OAUTH_REDIRECT_URI=$RedirectUri,DISCORD_SETUP_URL=$SetupUrl"

Write-Host 'Discord OAuth onboarding is configured on Cloud Run.'