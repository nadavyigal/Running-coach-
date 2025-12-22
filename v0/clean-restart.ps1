# Clean restart script for Next.js
Write-Host "Stopping any running dev servers..."
Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*node.exe"} | Stop-Process -Force

Write-Host "Removing .next directory..."
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cleaning npm cache..."
npm cache clean --force 2>&1 | Out-Null

Write-Host "Cache cleared! Starting dev server..."
npm run dev

