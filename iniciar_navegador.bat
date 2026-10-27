@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
    )
)

echo Iniciando DMS MTG Manager em modo Navegador Web...
call npm run dev -- --open
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o servidor web.
    pause
)
