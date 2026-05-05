#!/bin/bash
# PixelVault Setup-Skript
# Führe dieses Skript einmal aus, um PixelVault einzurichten

set -e

echo ""
echo "╔════════════════════════════════════════╗"
echo "║        📸 PixelVault Setup             ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Prüfen ob Docker läuft
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker ist nicht gestartet oder nicht installiert."
  echo "   Bitte installiere Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

echo "✅ Docker gefunden"

# .env erstellen falls nicht vorhanden
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ Konfigurationsdatei .env erstellt"
  echo ""
  echo "⚠️  WICHTIG: Bitte öffne die Datei '.env' und trage deine Admin-E-Mail ein!"
  echo "   ADMIN_EMAIL=deine@email.de"
  echo ""
  read -p "Drücke ENTER wenn du fertig bist..."
else
  echo "✅ .env bereits vorhanden"
fi

# JWT Secret generieren falls noch Standard
if grep -q "bitte-aendern" .env; then
  echo ""
  echo "🔐 Generiere sicheren JWT-Schlüssel..."
  NEW_SECRET=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1 2>/dev/null || echo "pixelvault-$(date +%s)-$(hostname)")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/bitte-aendern-sehr-langer-zufaelliger-sicherheits-schluessel/$NEW_SECRET/" .env
  else
    sed -i "s/bitte-aendern-sehr-langer-zufaelliger-sicherheits-schluessel/$NEW_SECRET/" .env
  fi
  echo "✅ JWT-Schlüssel automatisch gesetzt"
fi

echo ""
echo "🚀 Starte PixelVault..."
echo "   (Beim ersten Start werden Abhängigkeiten heruntergeladen – das dauert ein paar Minuten)"
echo ""

docker compose up -d --build

echo ""
echo "╔════════════════════════════════════════╗"
echo "║      🎉 PixelVault ist gestartet!      ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "   👉 Öffne: http://localhost:8080"
echo ""
echo "   Zum Stoppen: docker compose down"
echo "   Logs ansehen: docker compose logs -f"
echo ""
