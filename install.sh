#!/bin/bash
# PixelVault Linux Installer
# Unterstützt: Ubuntu 20.04+, Debian 11+, Fedora 38+, RHEL/CentOS 8+
# Führe aus mit: bash install.sh
set -e

# ── Farben ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}── $1 ──────────────────────────────────${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      📸 PixelVault Linux Installer       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Root-Check ────────────────────────────────────────────────────────────────
if [ "$EUID" -eq 0 ]; then
  err "Nicht als root ausführen. Nutze einen normalen User mit sudo-Rechten."
fi

# Sudo verfügbar?
if ! sudo -v 2>/dev/null; then
  err "Dieser User hat keine sudo-Rechte. Bitte als sudo-fähigen User einloggen."
fi

# ── Distro erkennen ───────────────────────────────────────────────────────────
step "System erkennen"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO=$ID
  DISTRO_LIKE=${ID_LIKE:-""}
  ok "Erkannt: $PRETTY_NAME"
else
  err "Betriebssystem nicht erkennbar. Unterstützt: Ubuntu, Debian, Fedora, RHEL/CentOS"
fi

is_debian() { [[ "$DISTRO" == "ubuntu" || "$DISTRO" == "debian" || "$DISTRO_LIKE" == *"debian"* ]]; }
is_fedora() { [[ "$DISTRO" == "fedora" || "$DISTRO" == "rhel" || "$DISTRO" == "centos" || "$DISTRO_LIKE" == *"fedora"* ]]; }

# ── Docker installieren ───────────────────────────────────────────────────────
step "Docker Engine installieren"

if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+')
  DOCKER_MAJOR=$(echo $DOCKER_VERSION | cut -d. -f1)
  if [ "$DOCKER_MAJOR" -ge 23 ]; then
    ok "Docker $DOCKER_VERSION bereits installiert"
  else
    warn "Docker $DOCKER_VERSION ist zu alt (brauche 23+). Aktualisiere…"
    INSTALL_DOCKER=true
  fi
else
  info "Docker nicht gefunden. Installiere…"
  INSTALL_DOCKER=true
fi

if [ "${INSTALL_DOCKER:-false}" = "true" ]; then
  if is_debian; then
    # Altes docker.io komplett entfernen falls vorhanden
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

    # Offiziellen Docker GPG Key hinzufügen
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$DISTRO/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Docker Repository hinzufügen
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/$DISTRO $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    ok "Docker installiert"

  elif is_fedora; then
    sudo dnf remove -y docker docker-client docker-client-latest docker-common \
      docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    ok "Docker installiert"
  else
    err "Distro nicht unterstützt für automatische Docker-Installation. Bitte manuell installieren: https://docs.docker.com/engine/install/"
  fi
fi

# ── Docker Daemon starten ─────────────────────────────────────────────────────
step "Docker Daemon starten"
if ! sudo systemctl is-active --quiet docker; then
  sudo systemctl enable docker --now
  ok "Docker Daemon gestartet und für Autostart aktiviert"
else
  ok "Docker Daemon läuft bereits"
fi

# ── User zur docker-Gruppe hinzufügen ─────────────────────────────────────────
step "Docker-Berechtigungen setzen"
if ! groups "$USER" | grep -q docker; then
  sudo usermod -aG docker "$USER"
  warn "User '$USER' zur docker-Gruppe hinzugefügt."
  warn "WICHTIG: Du musst dich einmal neu einloggen damit das wirkt."
  warn "Führe danach nochmal 'bash install.sh' aus oder nutze 'newgrp docker'."
  # Für den Rest dieses Skripts als docker-Gruppe laufen
  DOCKER_CMD="sudo docker"
  COMPOSE_CMD="sudo docker compose"
else
  ok "Docker-Berechtigungen bereits gesetzt"
  DOCKER_CMD="docker"
  COMPOSE_CMD="docker compose"
fi

# ── Docker Compose V2 prüfen ──────────────────────────────────────────────────
step "Docker Compose V2 prüfen"
if $DOCKER_CMD compose version &>/dev/null; then
  COMPOSE_VERSION=$($DOCKER_CMD compose version --short 2>/dev/null || echo "ok")
  ok "Docker Compose V2: $COMPOSE_VERSION"
else
  # Fallback: als Plugin installieren
  info "Installiere Docker Compose Plugin…"
  COMPOSE_PLUGIN_DIR="${DOCKER_CONFIG:-$HOME/.docker}/cli-plugins"
  mkdir -p "$COMPOSE_PLUGIN_DIR"
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o "$COMPOSE_PLUGIN_DIR/docker-compose"
  chmod +x "$COMPOSE_PLUGIN_DIR/docker-compose"
  ok "Docker Compose V2 installiert"
fi

# ── BuildKit aktivieren ───────────────────────────────────────────────────────
step "BuildKit aktivieren"
# BuildKit ist der moderne Docker Build-Engine – deutlich schneller und zuverlässiger
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Persistent in Docker-Daemon-Config setzen
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{"features": {"buildkit": true}}' | sudo tee /etc/docker/daemon.json > /dev/null
  sudo systemctl reload docker 2>/dev/null || sudo systemctl restart docker
  ok "BuildKit aktiviert (persistent)"
else
  # Bestehende Config nicht überschreiben, aber prüfen
  if grep -q "buildkit" /etc/docker/daemon.json; then
    ok "BuildKit bereits konfiguriert"
  else
    warn "BuildKit manuell in /etc/docker/daemon.json aktivieren falls Probleme auftreten"
  fi
fi

# ── .env erstellen ────────────────────────────────────────────────────────────
step "Konfiguration erstellen"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
  cp .env.example .env
  ok ".env aus Vorlage erstellt"
else
  ok ".env existiert bereits"
fi

# JWT_SECRET automatisch generieren wenn noch Standard
if grep -q "bitte-aendern" .env; then
  NEW_JWT=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
  sed -i "s|bitte-aendern-sehr-langer-zufaelliger-sicherheits-schluessel|$NEW_JWT|" .env
  ok "JWT_SECRET automatisch generiert"
fi

# MinIO Secret automatisch generieren wenn noch Standard
if grep -q "pixelvault123" .env; then
  NEW_MINIO=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
  sed -i "s|pixelvault123|$NEW_MINIO|" .env
  ok "MinIO Secret automatisch generiert"
fi

# Admin-Email prüfen
ADMIN_EMAIL=$(grep "^ADMIN_EMAIL=" .env | cut -d= -f2)
if [ -z "$ADMIN_EMAIL" ] || [ "$ADMIN_EMAIL" = "admin@example.com" ]; then
  echo ""
  warn "Deine Admin-Email ist noch nicht gesetzt!"
  read -p "  Gib deine Admin-Email-Adresse ein: " INPUT_EMAIL
  if [[ "$INPUT_EMAIL" == *"@"*"."* ]]; then
    sed -i "s|ADMIN_EMAIL=admin@example.com|ADMIN_EMAIL=$INPUT_EMAIL|" .env
    ok "Admin-Email gesetzt: $INPUT_EMAIL"
  else
    warn "Ungültige Email – bitte später in .env manuell setzen"
  fi
fi

# ── Ports prüfen ─────────────────────────────────────────────────────────────
step "Port-Verfügbarkeit prüfen"
PORT=$(grep "^PORT=" .env | cut -d= -f2 || echo "8080")
PORT=${PORT:-8080}

if ss -tlnp 2>/dev/null | grep -q ":$PORT " || netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
  warn "Port $PORT ist bereits belegt!"
  warn "Ändere PORT= in der .env Datei auf einen freien Port (z.B. 8081)"
else
  ok "Port $PORT ist frei"
fi

# ── PixelVault starten ────────────────────────────────────────────────────────
step "PixelVault starten"
info "Baue und starte alle Container…"
info "(Beim ersten Start: ca. 5-10 Minuten – Abhängigkeiten werden heruntergeladen)"
echo ""

# Mit sudo falls nötig, mit BuildKit
DOCKER_BUILDKIT=1 $COMPOSE_CMD up -d --build 2>&1

# ── Warten bis Server bereit ──────────────────────────────────────────────────
step "Warte auf PixelVault"
info "Warte bis alle Services bereit sind…"

MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
    break
  fi
  sleep 3
  WAITED=$((WAITED + 3))
  echo -n "."
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
  warn "PixelVault antwortet noch nicht nach ${MAX_WAIT}s."
  warn "Das kann beim ersten Start normal sein (ClamAV lädt Virus-Definitionen)."
  warn "Prüfe den Status mit: docker compose logs -f"
else
  ok "PixelVault antwortet!"
fi

# ── Fertig ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       🎉 PixelVault ist gestartet!       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  👉 Öffne im Browser: ${BOLD}http://localhost:$PORT${NC}"
echo ""
echo "  Nützliche Befehle:"
echo "    Logs ansehen:     docker compose logs -f"
echo "    Status prüfen:    docker compose ps"
echo "    Stoppen:          docker compose down"
echo "    Neu starten:      docker compose restart"
echo "    Update:           git pull && docker compose up -d --build"
echo ""

# Hinweis wenn Gruppe erst nach Re-Login aktiv wird
if [ "${DOCKER_CMD}" = "sudo docker" ]; then
  echo -e "${YELLOW}⚠  Hinweis:${NC} Du wurdest zur docker-Gruppe hinzugefügt."
  echo "   Nach einem neuen Login kannst du 'docker' ohne sudo nutzen."
  echo ""
fi
