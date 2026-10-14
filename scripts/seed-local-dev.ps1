<#
.SYNOPSIS
    Provision mock data for local development in a dedicated developer database.
    Ticket: BE-SEED-01 (Hotel SaaS Platform)

.DESCRIPTION
    This script executes the local mock data seeder against the developer's personal
    database (hotel_saas_dev_<username>). It ensures:
    - 1 Active Tenant ("Grand Hotel Group")
    - 2 Active Branches/Properties ("CN-Q1" and "CN-PN")
    - 1 Tenant Owner (tenant-wide, PropertyId = null)
    - 1 Manager with memberships at both branches
    - 1 Receptionist assigned to CN-Q1 only
    - Branch-specific RoomTypes and Rooms in various statuses (Clean, Dirty, Cleaning)

.PARAMETER Username
    Developer username used to construct database name: hotel_saas_dev_<username>.
    Defaults to $env:USERNAME (lowercased, special characters stripped).

.PARAMETER Host
    PostgreSQL host (default: localhost).

.PARAMETER Port
    PostgreSQL port (default: 5432).

.PARAMETER DbUser
    PostgreSQL administrative or dev user (default: postgres).

.PARAMETER DbPassword
    PostgreSQL server password. If omitted, uses $env:PGPASSWORD or prompts securely.

.PARAMETER SeedUserPassword
    Password to assign to seeded accounts (Owner, Manager, Receptionist).
    Default: "HotelDev@2026!" (minimum 8 characters).

.PARAMETER ConnectionString
    Full PostgreSQL connection string. Must target 'hotel_saas_dev_<username>'.
    Overrides Host, Port, DbUser, DbPassword, and Username.

.EXAMPLE
    .\scripts\seed-local-dev.ps1 -Username "ngoc" -DbPassword "postgres"

.EXAMPLE
    .\scripts\seed-local-dev.ps1 -ConnectionString "Host=localhost;Database=hotel_saas_dev_ngoc;Username=postgres;Password=postgres"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Username,

    [Parameter(Mandatory = $false)]
    [string]$Host = "localhost",

    [Parameter(Mandatory = $false)]
    [int]$Port = 5432,

    [Parameter(Mandatory = $false)]
    [string]$DbUser = "postgres",

    [Parameter(Mandatory = $false)]
    [string]$DbPassword,

    [Parameter(Mandatory = $false)]
    [string]$SeedUserPassword = "HotelDev@2026!",

    [Parameter(Mandatory = $false)]
    [string]$ConnectionString
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path $scriptDir "SeedLocalDev"

if (-not (Test-Path $projectDir)) {
    Write-Error "SeedLocalDev project directory not found at '$projectDir'."
    exit 1
}

# Determine Connection String
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    if ([string]::IsNullOrWhiteSpace($Username)) {
        $Username = $env:USERNAME
    }

    if ([string]::IsNullOrWhiteSpace($Username)) {
        Write-Error "Could not determine developer username. Please pass -Username <name>."
        exit 1
    }

    # Sanitize username (lowercase, alphanumeric + underscore only)
    $cleanUsername = ($Username -replace '[^a-zA-Z0-9_]', '').ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($cleanUsername)) {
        Write-Error "Username '$Username' contains no valid alphanumeric characters."
        exit 1
    }

    $targetDb = "hotel_saas_dev_$cleanUsername"

    if ([string]::IsNullOrWhiteSpace($DbPassword)) {
        if (-not [string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
            $DbPassword = $env:PGPASSWORD
        } else {
            $DbPassword = Read-Host -Prompt "Enter PostgreSQL password for user '$DbUser'" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
            $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        }
    }

    $ConnectionString = "Host=$Host;Port=$Port;Database=$targetDb;Username=$DbUser;Password=$DbPassword;Include Error Detail=true"
}

Write-Host "Running local mock data seeder..." -ForegroundColor Cyan
Write-Host "Project: $projectDir" -ForegroundColor Gray

# Execute CLI seeder tool
& dotnet run --project "$projectDir" -- --connection "$ConnectionString" --password "$SeedUserPassword"

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Error "Local mock data seeding failed with exit code $exitCode."
    exit $exitCode
}

Write-Host "Local seeding finished successfully." -ForegroundColor Green
exit 0
