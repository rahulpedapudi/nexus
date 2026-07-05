#Requires -Version 5.1
<#
.SYNOPSIS
    Nexus installer for Windows
.DESCRIPTION
    Installs Nexus (API + TUI) on Windows. Requires Docker Desktop, Node.js, and Git.
    Run from an elevated PowerShell prompt:
        irm https://raw.githubusercontent.com/rahulpedapudi/nexus/main/install.ps1 | iex
    Or locally:
        Set-ExecutionPolicy Bypass -Scope Process -Force
        .\install.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────
$NexusHome  = if ($env:NEXUS_HOME) { $env:NEXUS_HOME } else { Join-Path $env:USERPROFILE ".nexus" }
$RepoUrl    = "https://github.com/rahulpedapudi/nexus"
$InstallDir = Join-Path $NexusHome "repo"
$BinDir     = Join-Path $NexusHome "bin"

# ── Helpers ───────────────────────────────────────────────────
function Write-Info    { param($msg) Write-Host "[nexus] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[nexus] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[nexus] $msg" -ForegroundColor Red; exit 1 }
function Write-Section { param($msg) Write-Host "`n$msg" -ForegroundColor Cyan }

function Read-EnvFile {
    param($Path)
    $map = @{}
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^([^#=\s][^=]*)=(.*)$') { $map[$matches[1].Trim()] = $matches[2].Trim() }
    }
    return $map
}

function Set-EnvFileLine {
    param($Path, $Key, $Value)
    $content = Get-Content $Path
    $replaced = $false
    $content = $content | ForEach-Object {
        if ($_ -match "^${Key}=") { "${Key}=${Value}"; $replaced = $true }
        else { $_ }
    }
    if (-not $replaced) { $content += "${Key}=${Value}" }
    $content | Set-Content $Path -Encoding UTF8
}

function New-HexSecret {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ($buf | ForEach-Object { '{0:x2}' -f $_ }) -join ''
}

# ── 1. System deps ────────────────────────────────────────────
Write-Section "Checking dependencies..."

# Helper: install a package via winget
function Install-WithWinget {
    param($PackageId, $DisplayName)
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Installing $DisplayName via winget..."
        winget install --id $PackageId --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { Write-Err "Failed to install $DisplayName via winget. Install manually and re-run." }
    } else {
        Write-Err "$DisplayName not found and winget is unavailable.`n  Install $DisplayName manually and re-run this script."
    }
}

# Docker Desktop -- winget can install it but it needs a full reboot + manual start before docker.exe is usable
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warn "Docker not found. Attempting to install Docker Desktop..."
    Install-WithWinget "Docker.DockerDesktop" "Docker Desktop"
    Write-Host ""
    Write-Host "  Docker Desktop was installed." -ForegroundColor Yellow
    Write-Host "  >> Please REBOOT your machine, then START Docker Desktop," -ForegroundColor Yellow
    Write-Host "    and finally re-run this installer." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# Temporarily allow stderr from native commands (Docker emits harmless warnings there)
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"

# Verify Compose plugin (ships with Docker Desktop)
docker compose version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    $ErrorActionPreference = $prevEAP
    Write-Err "Docker Compose plugin missing. Update Docker Desktop to a recent version."
}

# Make sure Docker daemon is actually running
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    $ErrorActionPreference = $prevEAP
    Write-Err "Docker is installed but not running.`n  Start Docker Desktop and re-run this script."
}

$ErrorActionPreference = $prevEAP

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn "Node.js not found. Installing via winget..."
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
    # Refresh PATH for current session so node/npm are usable immediately
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Warn "node not on PATH yet -- you may need to restart your terminal after install."
    } else {
        Write-Info "Node.js installed: $(node --version)"
    }
}

# Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warn "Git not found. Installing via winget..."
    Install-WithWinget "Git.Git" "Git"
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "Git installed but not on PATH. Restart your terminal and re-run."
    } else {
        Write-Info "Git installed: $(git --version)"
    }
}

Write-Info "All dependencies ready."

# ── 2. Clone / update ─────────────────────────────────────────
Write-Section "Setting up Nexus files..."

@(
    (Join-Path $NexusHome "data\pgdata"),
    (Join-Path $NexusHome "context"),
    (Join-Path $NexusHome "logs")
) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

if (Test-Path (Join-Path $InstallDir ".git")) {
    Write-Info "Updating existing install..."
    git -C $InstallDir pull --ff-only
} else {
    Write-Info "Cloning Nexus..."
    git clone $RepoUrl $InstallDir
}

# ── 3. Generate .env ──────────────────────────────────────────
Write-Section "Configuring environment..."

$EnvFile         = Join-Path $NexusHome ".env"
$CredentialsFile = Join-Path $NexusHome "credentials.json"

if (-not (Test-Path $CredentialsFile)) {
    Write-Info "Creating credentials.json..."
    $credSrc = Join-Path $InstallDir ".credentials.json.example"
    if (Test-Path $credSrc) { Copy-Item $credSrc $CredentialsFile }
    else { '{}' | Set-Content $CredentialsFile -Encoding UTF8 }
} else {
    Write-Info "credentials.json already exists -- skipping."
}

if (-not (Test-Path $EnvFile)) {
    Write-Info "Generating secrets..."
    Copy-Item (Join-Path $InstallDir ".env.example") $EnvFile

    $JwtSecret        = New-HexSecret -Bytes 32
    $PostgresPassword = New-HexSecret -Bytes 16

    # Try Python for Fernet key, fall back to base64 random bytes
    $FernetKey = $null
    try {
        $FernetKey = & python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>$null
    } catch {}
    if (-not $FernetKey) {
        Write-Err "Python (with 'cryptography' package) is required to generate a Fernet key.`n  Run: pip install cryptography`n  Then re-run this installer."
    }   

    Set-EnvFileLine $EnvFile "JWT_SECRET"        $JwtSecret
    Set-EnvFileLine $EnvFile "POSTGRES_PASSWORD" $PostgresPassword
    Set-EnvFileLine $EnvFile "FERNET_KEY"        $FernetKey
    Set-EnvFileLine $EnvFile "DATABASE_URL"      "postgresql://nexus:${PostgresPassword}@db:5432/nexus"

    Write-Warn "LLM/bot keys left blank -- fill them in at: $CredentialsFile"
} else {
    Write-Info ".env already exists -- skipping."
}

# ── 4. Seed context files ─────────────────────────────────────
foreach ($f in @("SOUL.md", "DIRECTIVES.md")) {
    $dest = Join-Path $NexusHome "context\$f"
    $src  = Join-Path $InstallDir "context\$f"
    if (-not (Test-Path $dest)) {
        if (Test-Path $src) {
            Copy-Item $src $dest
            Write-Info "Created context/$f"
        } else {
            New-Item -ItemType File -Path $dest | Out-Null
            Write-Warn "context/$f not found in repo -- created empty file"
        }
    } else {
        Write-Info "context/$f already exists -- skipping."
    }
}

# ── 5. Start services ─────────────────────────────────────────
Write-Section "Starting services..."

$envMap = Read-EnvFile $EnvFile
$env:POSTGRES_PASSWORD = $envMap["POSTGRES_PASSWORD"]
$env:NEXUS_HOME        = $NexusHome
$env:PORT              = if ($envMap["PORT"]) { $envMap["PORT"] } else { "8421" }

# Docker on Windows needs forward slashes in paths for volume mounts
$ComposeFile = Join-Path $InstallDir "compose.yaml"

docker compose -f "$ComposeFile" --env-file $EnvFile up -d --build
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose up failed." }

#Postgres readiness check
Write-Info "Waiting for Postgres to be ready..."
$pgReady = $false
for ($i = 1; $i -le 20; $i++) {
    docker compose -f "$ComposeFile" --env-file $EnvFile exec -T db pg_isready -U nexus 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 2
}
Write-Host ""
if (-not $pgReady) { Write-Err "Postgres did not become ready in time. Check 'docker compose logs db'." }

# ── 6. Run migrations ─────────────────────────────────────────
Write-Info "Running database migrations..."
docker compose -f "$ComposeFile" --env-file $EnvFile exec -T api alembic upgrade head
if ($LASTEXITCODE -ne 0) { Write-Err "Alembic migration failed." }

# ── 7. Wait for API ───────────────────────────────────────────
Write-Info "Waiting for API to be ready..."
$ApiPort = if ($envMap["PORT"]) { $envMap["PORT"] } else { "8421" }
$ready   = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $r = Invoke-WebRequest "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 2
}
Write-Host ""
if (-not $ready) { Write-Warn "API health check timed out -- it may still be starting up." }

# ── 8. Build TUI + install nexus command ─────────────────────
Write-Section "Installing nexus command..."

Push-Location (Join-Path $InstallDir "tui")
try {
    npm install --silent
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed." }
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Err "npm run build failed." }
} finally {
    Pop-Location
}

# Write nexus.cmd launcher into $NexusHome\bin\
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$TuiEntry   = Join-Path $InstallDir "tui\dist\index.js"
$LauncherPath = Join-Path $BinDir "nexus.cmd"

@"
@echo off
if "%NEXUS_API_URL%"=="" set NEXUS_API_URL=http://localhost:$ApiPort
node "$TuiEntry" %*
"@ | Set-Content $LauncherPath -Encoding ASCII

# Add $BinDir to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if (($userPath -split ';') -notcontains $BinDir) {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$BinDir", "User")
    Write-Warn "Added $BinDir to PATH. Restart your terminal for 'nexus' to be available."
} else {
    Write-Info "PATH already contains $BinDir"
}

Write-Info "nexus command installed at $LauncherPath"

# ── 9. Done ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  [OK] Nexus is ready." -ForegroundColor Green
Write-Host ""
Write-Host "  API      -> http://localhost:$ApiPort"
Write-Host "  Config   -> $EnvFile"
Write-Host "  Context  -> $(Join-Path $NexusHome 'context\')"
Write-Host ""
Write-Host "  Run 'nexus' to open the terminal UI"
if ($userPath -notlike "*$BinDir*") {
    Write-Host "  (restart your terminal first so PATH is updated)" -ForegroundColor Yellow
}
Write-Host ""
