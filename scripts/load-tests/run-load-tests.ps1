<#
.SYNOPSIS
    Hotel SaaS Platform v2 — Windows PowerShell Load Test Runner (SignalR Hub & VNPay)
.DESCRIPTION
    Executes k6 SignalR NotificationHub and VNPay Checkout/IPN load tests for a target
    tier (smoke | load | stress) and exports summary JSON reports to docs/reports/load-tests/.
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:5000' }),

    [ValidateSet('smoke', 'load', 'stress')]
    [string]$Profile = 'smoke',

    [string]$ReportDir = './docs/reports/load-tests',

    [string]$VnpTmnCode = $env:VNP_TMN_CODE,
    [string]$VnpHashSecret = $env:VNP_HASH_SECRET,
    [string]$JwtToken = $env:JWT_TOKEN,
    [string]$PropertyId = $env:PROPERTY_ID,
    [string]$ForbiddenPropertyId = $env:FORBIDDEN_PROPERTY_ID,
    [string]$StaffEmail = $env:STAFF_EMAIL,
    [string]$StaffPassword = $env:STAFF_PASSWORD,
    [string]$ReservationId = $env:RESERVATION_ID,
    [string]$ReservationCode = $env:RESERVATION_CODE,
    [string]$LookupToken = $env:LOOKUP_TOKEN,
    [string]$AmountVnd = $env:AMOUNT_VND
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-K6Executable {
    $candidates = @('k6.exe', 'k6', 'C:\Program Files\k6\k6.exe')
    foreach ($candidate in $candidates) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) {
            return $cmd.Source
        }
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    throw "k6 executable not found on PATH or at 'C:\Program Files\k6\k6.exe'."
}

function Protect-SummaryReport {
    param([string]$SummaryPath)
    if (-not (Test-Path $SummaryPath)) {
        return
    }
    $raw = Get-Content -Path $SummaryPath -Raw -Encoding UTF8
    $scrubbed = [regex]::Replace(
        $raw,
        '("(?:token|checkoutLookupToken)"\s*:\s*)"[^"]*"',
        '$1"<redacted>"'
    )
    # Validate JSON integrity before overwriting summary artifact
    $null = $scrubbed | ConvertFrom-Json
    [System.IO.File]::WriteAllText($SummaryPath, $scrubbed, [System.Text.UTF8Encoding]::new($false))
}

$k6Exe = Resolve-K6Executable
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$signalrSummaryPath = Join-Path $ReportDir "signalr-summary-$Profile.json"
$vnpaySummaryPath = Join-Path $ReportDir "vnpay-summary-$Profile.json"

Write-Host "=================================================================="
Write-Host (" Hotel SaaS v2 Load Test Suite — Profile: {0}" -f $Profile.ToUpperInvariant())
Write-Host (" Target API: {0}" -f $BaseUrl)
Write-Host (" k6 Binary : {0}" -f $k6Exe)
Write-Host "=================================================================="

$commonEnvArgs = @(
    '-e', "BASE_URL=$BaseUrl",
    '-e', "TEST_TIER=$Profile"
)

if (-not [string]::IsNullOrWhiteSpace($JwtToken))            { $commonEnvArgs += @('-e', "JWT_TOKEN=$JwtToken") }
if (-not [string]::IsNullOrWhiteSpace($PropertyId))          { $commonEnvArgs += @('-e', "PROPERTY_ID=$PropertyId") }
if (-not [string]::IsNullOrWhiteSpace($ForbiddenPropertyId)) { $commonEnvArgs += @('-e', "FORBIDDEN_PROPERTY_ID=$ForbiddenPropertyId") }
if (-not [string]::IsNullOrWhiteSpace($StaffEmail))          { $commonEnvArgs += @('-e', "STAFF_EMAIL=$StaffEmail") }
if (-not [string]::IsNullOrWhiteSpace($StaffPassword))       { $commonEnvArgs += @('-e', "STAFF_PASSWORD=$StaffPassword") }
if (-not [string]::IsNullOrWhiteSpace($VnpTmnCode))          { $commonEnvArgs += @('-e', "VNP_TMN_CODE=$VnpTmnCode") }
if (-not [string]::IsNullOrWhiteSpace($VnpHashSecret))       { $commonEnvArgs += @('-e', "VNP_HASH_SECRET=$VnpHashSecret") }
if (-not [string]::IsNullOrWhiteSpace($ReservationId))       { $commonEnvArgs += @('-e', "RESERVATION_ID=$ReservationId") }
if (-not [string]::IsNullOrWhiteSpace($ReservationCode))     { $commonEnvArgs += @('-e', "RESERVATION_CODE=$ReservationCode") }
if (-not [string]::IsNullOrWhiteSpace($LookupToken))         { $commonEnvArgs += @('-e', "LOOKUP_TOKEN=$LookupToken") }
if (-not [string]::IsNullOrWhiteSpace($AmountVnd))           { $commonEnvArgs += @('-e', "AMOUNT_VND=$AmountVnd") }

Write-Host "[1/2] Running SignalR NotificationHub WebSocket & Multi-Branch Isolation Load Test..."
& $k6Exe run @commonEnvArgs --summary-export $signalrSummaryPath 'scripts/load-tests/signalr-hub.k6.js'
$signalrExit = $LASTEXITCODE
Protect-SummaryReport -SummaryPath $signalrSummaryPath
if ($signalrExit -ne 0) {
    throw "SignalR k6 load test failed with exit code $signalrExit."
}

Write-Host "[2/2] Running VNPay Checkout & IPN Concurrency Storm Load Test..."
& $k6Exe run @commonEnvArgs --summary-export $vnpaySummaryPath 'scripts/load-tests/vnpay-checkout-ipn.k6.js'
$vnpayExit = $LASTEXITCODE
Protect-SummaryReport -SummaryPath $vnpaySummaryPath
if ($vnpayExit -ne 0) {
    throw "VNPay k6 load test failed with exit code $vnpayExit."
}

Write-Host "Load test suite completed. Reports saved to $ReportDir/"
