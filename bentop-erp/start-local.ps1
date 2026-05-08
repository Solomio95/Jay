$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerDesktop) {
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden -ErrorAction SilentlyContinue
}

Write-Host "Waiting for Docker Desktop..."
$dockerReady = $false
for ($i = 0; $i -lt 30; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    $dockerReady = $true
    break
  }
  Start-Sleep -Seconds 4
}

if (-not $dockerReady) {
  throw "Docker Desktop is not ready. Please start Docker Desktop manually, then run this script again."
}

Write-Host "Starting Bentop database..."
docker compose up -d db

Write-Host "Waiting for database..."
$dbReady = $false
for ($i = 0; $i -lt 30; $i++) {
  docker compose exec -T db pg_isready -U bentop -d bentop_erp *> $null
  if ($LASTEXITCODE -eq 0) {
    $dbReady = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $dbReady) {
  throw "Database is not ready. Check Docker Desktop and run docker compose ps."
}

Write-Host "Applying database schema..."
npm run db:push

Write-Host ""
Write-Host "Starting Bentop ERP..."
Write-Host "Open: http://localhost:3000/login"
Write-Host "Login: admin@bentop.com / admin123"
Write-Host ""
npm run dev
