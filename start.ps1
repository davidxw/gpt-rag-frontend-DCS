Write-Host "starting script"

# Loading env variables from .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -and $_ -notmatch '^\s*#') {
            $parts = $_ -split '=', 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                # Strip surrounding quotes (single or double)
                $value = $value -replace '^["''](.*)["'']$', '$1'
                [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
            }
        }
    }
} else {
    Write-Host ".env file not found. Please create it."
    exit 1
}

Write-Host 'Creating python virtual environment "backend/backend_env"'
python -m venv backend/backend_env

Write-Host ""
Write-Host "Restoring backend python packages"
Write-Host ""

Push-Location backend
& ./backend_env/Scripts/python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restore backend python packages"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Restoring frontend npm packages"
Write-Host ""

Pop-Location
Push-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restore frontend npm packages"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Building frontend"
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build frontend"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Restoring tester npm packages"
Write-Host ""

Pop-Location
Push-Location tester
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restore tester npm packages"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Building tester"
Write-Host ""

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build tester"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Starting backend"
Write-Host ""

Pop-Location
Push-Location backend
Start-Process "http://localhost:8000"
& ./backend_env/Scripts/python ./app.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start backend"
    Pop-Location
    exit $LASTEXITCODE
}
Pop-Location
