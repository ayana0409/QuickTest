<#
.SYNOPSIS
    Runner script for QuickTest Dynamic k6 Load & Stress Testing.
.DESCRIPTION
    Runs the resilient k6 load test script with customizable parameters.
    Supports dynamic question adaptation across all question types (Single Choice, Multi Choice, Numeric, Essay)
    and automatic exam discovery or auto-provisioning when no exam is provided.
.PARAMETER AccessCode
    Target exam access code (e.g. 'EXAM01', 'AI101_OPEN').
    If omitted or empty, k6 will automatically discover an active public exam or auto-provision a fresh test exam!
.PARAMETER Users
    Number of concurrent virtual users (VUs). Default: 10
.PARAMETER Duration
    Test duration (e.g. '30s', '1m', '5m'). Default: '30s'
.PARAMETER Iterations
    Total test iterations across all VUs (optional, overrides duration if set).
.PARAMETER BaseUrl
    Base URL of backend. Default: http://100.76.224.64/quick-test-be
.PARAMETER Submit
    Whether candidates should submit exam at the end ($true / $false). Default: $false (Holds session in progress)
.PARAMETER HoldSession
    Whether candidates should hold the session active with heartbeats ($true / $false). Default: $true
.PARAMETER SaveDraft
    Whether candidates should save drafts for each question ($true / $false). Default: $true
.PARAMETER KeepExam
    Whether to keep auto-created test exams after test completes ($true / $false). Default: $false (auto-cleaned)
.EXAMPLE
    .\run_k6_test.ps1
.EXAMPLE
    .\run_k6_test.ps1 -AccessCode EXAM01 -Users 50 -Duration 1m
.EXAMPLE
    .\run_k6_test.ps1 -Users 100 -Duration 5m -Submit $true
.EXAMPLE
    .\run_k6_test.ps1 -Users 20 -Iterations 50
#>

param (
    [string]$AccessCode = "",
    [int]$Users = 10,
    [string]$Duration = "30s",
    [int]$Iterations = 0,
    [string]$BaseUrl = "http://100.76.224.64/quick-test-be",
    [bool]$Submit = $false,
    [bool]$HoldSession = $true,
    [bool]$SaveDraft = $true,
    [bool]$KeepExam = $false
)

# Check if k6 is installed or present in current/parent directory
$k6Exe = $null

# 1. Check in the current script folder (e.g. scripts\test\k6.exe)
if (Test-Path (Join-Path $PSScriptRoot "k6.exe")) {
    $k6Exe = (Join-Path $PSScriptRoot "k6.exe")
}
# 2. Check in parent folder (scripts\k6.exe)
elseif (Test-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "k6.exe")) {
    $k6Exe = (Join-Path (Split-Path $PSScriptRoot -Parent) "k6.exe")
}
# 3. Check in workspace root (QuickTest\k6.exe)
elseif (Test-Path (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "k6.exe")) {
    $k6Exe = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "k6.exe")
}
# 4. Check system PATH
else {
    $k6Check = Get-Command k6 -ErrorAction SilentlyContinue
    if ($k6Check) {
        $k6Exe = "k6"
    }
}

if (-not $k6Exe) {
    Write-Warning "[!] 'k6.exe' was not found in the scripts directory, workspace root, or system PATH."
    Write-Host "Please place 'k6.exe' into this folder: $PSScriptRoot" -ForegroundColor Yellow
    Write-Host "Or install k6 using: winget install k6 --source winget" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "k6_load_test.js"

$k6Args = @("run")
$k6Args += @("-e", "BASE_URL=$BaseUrl")
$k6Args += @("-e", "VUS=$Users")
$k6Args += @("-e", "SUBMIT=$($Submit.ToString().ToLower())")
$k6Args += @("-e", "HOLD_SESSION=$($HoldSession.ToString().ToLower())")
$k6Args += @("-e", "SAVE_DRAFT=$($SaveDraft.ToString().ToLower())")
$k6Args += @("-e", "KEEP_EXAM=$($KeepExam.ToString().ToLower())")

if (-not [string]::IsNullOrWhiteSpace($AccessCode)) {
    $k6Args += @("-e", "ACCESS_CODE=$AccessCode")
}

if ($Iterations -gt 0) {
    $k6Args += @("-e", "ITERATIONS=$Iterations")
    $k6Args += @("--iterations", "$Iterations")
    $k6Args += @("--vus", "$Users")
} else {
    $k6Args += @("-e", "DURATION=$Duration")
    $k6Args += @("--duration", "$Duration")
    $k6Args += @("--vus", "$Users")
}

$k6Args += $scriptPath

$examDisplay = if ([string]::IsNullOrWhiteSpace($AccessCode)) { "Auto-Discovery / Auto-Provisioning (Tu dong tim hoac tu tao de)" } else { $AccessCode }

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " QuickTest Dynamic k6 Load Test Runner" -ForegroundColor Green
Write-Host " Target URL   : $BaseUrl" -ForegroundColor Cyan
Write-Host " Exam Code    : $examDisplay" -ForegroundColor Cyan
Write-Host " Virtual Users: $Users" -ForegroundColor Cyan
if ($Iterations -gt 0) {
    Write-Host " Iterations   : $Iterations" -ForegroundColor Cyan
} else {
    Write-Host " Duration     : $Duration" -ForegroundColor Cyan
}
Write-Host " Submit Exam  : $Submit" -ForegroundColor Cyan
Write-Host " Save Drafts  : $SaveDraft" -ForegroundColor Cyan
Write-Host " Hold Session : $HoldSession" -ForegroundColor Cyan
Write-Host " Using Binary : $k6Exe" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green

& $k6Exe @k6Args
