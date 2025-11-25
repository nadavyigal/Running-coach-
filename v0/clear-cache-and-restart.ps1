# Clear Next.js cache and restart development server
Write-Host "🧹 Clearing Next.js cache..." -ForegroundColor Yellow

# Stop any running Next.js processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Clear Next.js cache directories
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared .next directory" -ForegroundColor Green
}

if (Test-Path "node_modules/.cache") {
    Remove-Item -Recurse -Force "node_modules/.cache" -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared node_modules/.cache" -ForegroundColor Green
}

# Clear npm cache
npm cache clean --force
Write-Host "✅ Cleared npm cache" -ForegroundColor Green

# Reinstall dependencies
Write-Host "📦 Reinstalling dependencies..." -ForegroundColor Yellow
npm install

# Start development server
Write-Host "🚀 Starting development server..." -ForegroundColor Green
npm run dev 