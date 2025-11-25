# RunSmart Development Server Startup Script
Write-Host "🚀 Starting RunSmart Development Server..." -ForegroundColor Green
Write-Host ""

# Change to the V0 directory
Set-Location $PSScriptRoot

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Start the development server
Write-Host "🌐 Starting development server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

npm run dev 