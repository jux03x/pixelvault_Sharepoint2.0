@echo off
echo.
echo ==========================================
echo       📸 PixelVault Setup (Windows)
echo ==========================================
echo.

:: Docker prüfen
docker info > nul 2>&1
if errorlevel 1 (
  echo ❌ Docker ist nicht gestartet oder nicht installiert.
  echo    Bitte installiere Docker Desktop: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)
echo ✅ Docker gefunden

:: .env erstellen
if not exist ".env" (
  copy ".env.example" ".env"
  echo ✅ Konfigurationsdatei .env erstellt
  echo.
  echo ⚠️  Bitte öffne die Datei ".env" und trage deine Admin-E-Mail ein!
  echo    Öffne die Datei mit Notepad und ändere: ADMIN_EMAIL=deine@email.de
  echo.
  notepad .env
  echo Drücke eine Taste wenn du die .env gespeichert hast...
  pause > nul
) else (
  echo ✅ .env bereits vorhanden
)

echo.
echo 🚀 Starte PixelVault...
echo    (Beim ersten Start dauert es ein paar Minuten)
echo.

docker compose up -d --build

echo.
echo ==========================================
echo       🎉 PixelVault ist gestartet!
echo ==========================================
echo.
echo    Öffne im Browser: http://localhost:8080
echo.
echo    Zum Stoppen: docker compose down
echo.
pause
