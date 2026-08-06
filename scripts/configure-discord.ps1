param(
    [string]$Project = 'inkeginelive-dispatch',
    [string]$Region = 'us-east1',
    [string]$Service = 'inkengine-dispatch-api',
    [switch]$TokenFromClipboard,
    [string]$ChannelIds
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

$botToken = if ($TokenFromClipboard) {
    try {
        (Get-Clipboard -Raw).Trim()
    }
    finally {
        Set-Clipboard -Value $null
    }
}
else {
    (Read-SecretText 'Discord bot token').Trim()
}
if ($botToken.StartsWith('Bot ', [StringComparison]::OrdinalIgnoreCase)) {
    $botToken = $botToken.Substring(4).Trim()
}
$botToken = $botToken.Trim('"', "'")
$botToken = $botToken -replace '\s', ''
if ([string]::IsNullOrWhiteSpace($ChannelIds)) {
    $ChannelIds = Read-Host 'Discord channel IDs (comma-separated)'
}
$channelIds = $ChannelIds.Trim()

if ($botToken.Length -lt 20) {
    throw "Discord bot token was only $($botToken.Length) character(s); paste the full token from the Discord Developer Portal."
}
if ($botToken -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
    throw 'The copied value is not a Discord bot token. Use Copy beside Token on the Developer Portal Bot page.'
}
if ($channelIds -notmatch '^\d{15,22}(,\s*\d{15,22})*$') {
    throw 'Discord channel IDs must be comma-separated numeric IDs.'
}
$channelIds = ($channelIds -split ',' | ForEach-Object { $_.Trim() }) -join ','

$discordHeaders = @{ Authorization = "Bot $botToken" }
try {
    $bot = Invoke-RestMethod -Uri 'https://discord.com/api/v10/users/@me' -Headers $discordHeaders
}
catch {
    throw 'Discord rejected the bot token. Reset and copy the full token from the Developer Portal Bot page.'
}

foreach ($channelId in $channelIds -split ',') {
    try {
        $channel = Invoke-RestMethod -Uri "https://discord.com/api/v10/channels/$channelId" -Headers $discordHeaders
    }
    catch {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $discordError = $_.ErrorDetails.Message
        Write-Host "Discord denied channel $channelId metadata (HTTP $statusCode): $discordError"
        $discordErrorCode = try { ($discordError | ConvertFrom-Json).code } catch { $null }
        if ($discordErrorCode -eq 40333) {
            Write-Warning "Discord reported a transient internal network error for channel $channelId. Cloud Run will retry from its own network."
            continue
        }
        Write-Host "Checking the bot's visible servers and channels..."
        try {
            $guilds = @(Invoke-RestMethod -Uri 'https://discord.com/api/v10/users/@me/guilds' -Headers $discordHeaders)
            foreach ($guild in $guilds) {
                $guildPermissions = [UInt64]$guild.permissions
                $isAdministrator = ($guildPermissions -band 8) -ne 0
                $canViewChannels = ($guildPermissions -band 1024) -ne 0
                $canReadHistory = ($guildPermissions -band 65536) -ne 0
                Write-Host "Visible server: $($guild.name) ($($guild.id)); Administrator: $isAdministrator; View Channels: $canViewChannels; Read Message History: $canReadHistory"
                try {
                    $visibleChannels = @(Invoke-RestMethod -Uri "https://discord.com/api/v10/guilds/$($guild.id)/channels" -Headers $discordHeaders)
                    $visibleChannels |
                        Where-Object { $_.type -in @(0, 5, 15, 16) } |
                        ForEach-Object { Write-Host "  #$($_.name) ($($_.id))" }
                }
                catch {
                    Write-Host '  Discord did not allow channel enumeration for this server.'
                }
            }
        }
        catch {
            Write-Host 'Discord did not allow server enumeration for this bot.'
        }
        throw "Discord cannot access channel $channelId metadata (HTTP $statusCode). Confirm the ID belongs to a channel in the server where the bot is installed."
    }
    try {
        Invoke-RestMethod -Uri "https://discord.com/api/v10/channels/$channelId/messages?limit=1" -Headers $discordHeaders | Out-Null
        Write-Host "Verified read access to #$($channel.name) ($channelId)."
    }
    catch {
        $statusCode = [int]$_.Exception.Response.StatusCode
        throw "Discord cannot read messages in #$($channel.name) ($channelId, HTTP $statusCode). Allow View Channel and Read Message History for the bot on that channel."
    }
}

Write-Host "Configuration accepted for $($bot.username) ($(@($channelIds -split ',').Count) channel(s); token: $($botToken.Length) characters)."
Add-SecretVersion 'discord-bot-token' $botToken

$runtimeServiceAccount = (& $gcloudPath run services describe $Service --project=$Project --region=$Region --format='value(spec.template.spec.serviceAccountName)').Trim()
if (-not $runtimeServiceAccount) {
    $projectNumber = (& $gcloudPath projects describe $Project --format='value(projectNumber)').Trim()
    $runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

Invoke-Gcloud secrets add-iam-policy-binding discord-bot-token --project=$Project --member="serviceAccount:$runtimeServiceAccount" --role=roles/secretmanager.secretAccessor
Invoke-Gcloud run services update $Service --project=$Project --region=$Region --update-secrets='DISCORD_BOT_TOKEN=discord-bot-token:latest' --update-env-vars="DISCORD_CHANNEL_IDS=$channelIds"

Write-Host 'Discord is configured on Cloud Run.'