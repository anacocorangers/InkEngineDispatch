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

$accessToken = (Read-SecretText 'TikTok user access token with video.list permission').Trim()
if ($accessToken.Length -lt 20) {
    throw 'The TikTok access token appears incomplete.'
}

$secretName = 'tiktok-access-token'
$secretNames = @(& $gcloudPath secrets list --project=$Project --format='value(name)')
if (-not ($secretNames | Where-Object { $_ -eq $secretName -or $_ -like "*/$secretName" })) {
    Invoke-Gcloud secrets create $secretName --project=$Project --replication-policy=automatic
}

$tempFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllText($tempFile, $accessToken, [Text.UTF8Encoding]::new($false))
    Invoke-Gcloud secrets versions add $secretName --project=$Project --data-file=$tempFile
}
finally {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

$runtimeServiceAccount = (& $gcloudPath run services describe $Service --project=$Project --region=$Region --format='value(spec.template.spec.serviceAccountName)').Trim()
if (-not $runtimeServiceAccount) {
    $projectNumber = (& $gcloudPath projects describe $Project --format='value(projectNumber)').Trim()
    $runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

Invoke-Gcloud secrets add-iam-policy-binding $secretName --project=$Project --member="serviceAccount:$runtimeServiceAccount" --role=roles/secretmanager.secretAccessor
Invoke-Gcloud run services update $Service --project=$Project --region=$Region --set-secrets="TIKTOK_ACCESS_TOKEN=$secretName`:latest"

Write-Host 'TikTok Display API access is configured on Cloud Run.'