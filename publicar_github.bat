@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   DMS MTG Manager - Publicacao no GitHub Pages
echo   URL Alvo: https://davipmelo.github.io/dms-mtg-manager
echo ========================================================
echo.

git status --short
echo.

echo Enviando codigo para o GitHub (origin/main)...
git push -u origin main

if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] Nao foi possivel enviar para https://github.com/davipmelo/dms-mtg-manager.git
    echo Certifique-se de que:
    echo   1. O repositorio "dms-mtg-manager" foi criado na sua conta GitHub ^(davipmelo^)
    echo   2. Em Settings ^> Pages do repositorio, a opcao "Source" esta como "GitHub Actions"
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCESSO] Codigo enviado! O GitHub Actions ira publicar automaticamente em:
echo https://davipmelo.github.io/dms-mtg-manager
echo.
pause
