param(
    [string]$Project = 'inkeginelive-dispatch',
    [string]$Region = 'us-east1',
    [string]$Service = 'inkengine-dispatch-api'
)

$ErrorActionPreference = 'Stop'

$gcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
$gcloudPath = if ($gcloudCommand) { $gcloudCommand.Source } else { $null }
if (-not $gcloudPath) {
    $portableGcloud = Join-Path $env:LOCALAPPDATA 'Google\CloudSDKPortable\google-cloud-sdk\bin\gcloud.cmd'
    if (Test-Path $portableGcloud) {
        $gcloudPath = $portableGcloud
    }
}
if (-not $gcloudPath) {
    throw 'Google Cloud CLI was not found.'
}

$portablePython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313-arm64\python.exe'
if (-not $env:CLOUDSDK_PYTHON -and (Test-Path $portablePython)) {
    $env:CLOUDSDK_PYTHON = $portablePython
}

function Invoke-Gcloud {
    & $gcloudPath @args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed with exit code $LASTEXITCODE"
    }
}

function Read-SecretText([string]$Prompt) {
    $secureValue = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Add-SecretVersion([string]$Name, [string]$Value) {
    $secretNames = @(& $gcloudPath secrets list --project=$Project --format='value(name)')
    $secretExists = $secretNames | Where-Object { $_ -eq $Name -or $_ -like "*/$Name" }
    if (-not $secretExists) {
        Invoke-Gcloud secrets create $Name --project=$Project --replication-policy=automatic
    }

    $tempFile = [IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($tempFile, $Value, [Text.UTF8Encoding]::new($false))
        Invoke-Gcloud secrets versions add $Name --project=$Project --data-file=$tempFile
    }
    finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

$botToken = (Read-SecretText 'Discord bot token').Trim()
$channelIds = (Read-Host 'Discord channel IDs (comma-separated)').Trim()

if ($botToken.Length -lt 20) {
    throw "Discord bot token was only $($botToken.Length) character(s); paste the full token from the Discord Developer Portal."
}
if ($channelIds -notmatch '^\d{15,22}(,\s*\d{15,22})*$') {
    throw 'Discord channel IDs must be comma-separated numeric IDs.'
}
$channelIds = ($channelIds -split ',' | ForEach-Object { $_.Trim() }) -join ','

Write-Host "Configuration accepted ($(@($channelIds -split ',').Count) channel(s); token: $($botToken.Length) characters)."
Add-SecretVersion 'discord-bot-token' $botToken

$runtimeServiceAccount = (& $gcloudPath run services describe $Service --project=$Project --region=$Region --format='value(spec.template.spec.serviceAccountName)').Trim()
if (-not $runtimeServiceAccount) {
    $projectNumber = (& $gcloudPath projects describe $Project --format='value(projectNumber)').Trim()
    $runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

Invoke-Gcloud secrets add-iam-policy-binding discord-bot-token --project=$Project --member="serviceAccount:$runtimeServiceAccount" --role=roles/secretmanager.secretAccessor
Invoke-Gcloud run services update $Service --project=$Project --region=$Region --update-secrets='DISCORD_BOT_TOKEN=discord-bot-token:latest' --update-env-vars="DISCORD_CHANNEL_IDS=$channelIds"

Write-Host 'Discord is configured on Cloud Run.'