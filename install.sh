#!/bin/bash
# PixelVault Installer – Ubuntu/Debian/Fedora
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}── $1${NC}"; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗"
echo -e "║   📸 PixelVault Linux Installer      ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"

[ "$EUID" -eq 0 ] && err "Nicht als root ausführen. Normalen User mit sudo nutzen."
sudo -v 2>/dev/null || err "Kein sudo-Zugriff."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Distro erkennen ───────────────────────────────────────────────────────────
step "System erkennen"
[ -f /etc/os-release ] && . /etc/os-release || err "OS nicht erkennbar"
ok "System: ${PRETTY_NAME:-$ID}"
is_debian() { [[ "$ID" == "ubuntu" || "$ID" == "debian" || "${ID_LIKE:-}" == *"debian"* ]]; }
is_fedora() { [[ "$ID" == "fedora" || "$ID" == "rhel" || "$ID" == "centos" || "${ID_LIKE:-}" == *"fedora"* ]]; }

# ── Docker installieren ───────────────────────────────────────────────────────
step "Docker Engine"
if ! command -v docker &>/dev/null; then
  info "Installiere Docker…"
  if is_debian; then
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$ID/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/$ID $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif is_fedora; then
    sudo dnf remove -y docker docker-client docker-client-latest docker-common \
      docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    err "Distro nicht unterstützt. Bitte Docker manuell installieren: https://docs.docker.com/engine/install/"
  fi
  ok "Docker installiert"
else
  ok "Docker bereits vorhanden"
fi

# ── Docker Daemon ─────────────────────────────────────────────────────────────
step "Docker Daemon"
if ! sudo systemctl is-active --quiet docker; then
  sudo systemctl enable docker --now
  ok "Docker Daemon gestartet"
else
  ok "Docker Daemon läuft"
fi

# ── Docker Gruppe ─────────────────────────────────────────────────────────────
step "Docker Berechtigungen"
DOCKER_CMD="docker"; COMPOSE_CMD="docker compose"
if ! groups "$USER" | grep -q docker; then
  sudo usermod -aG docker "$USER"
  DOCKER_CMD="sudo docker"; COMPOSE_CMD="sudo docker compose"
  warn "User zur docker-Gruppe hinzugefügt (gilt nach nächstem Login)"
else
  ok "Docker-Gruppe OK"
fi

# ── BuildKit aktivieren ───────────────────────────────────────────────────────
step "BuildKit"
export DOCKER_BUILDKIT=1
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{"features":{"buildkit":true}}' | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl reload docker
  ok "BuildKit aktiviert"
elif ! grep -q buildkit /etc/docker/daemon.json; then
  sudo python3 -c "
import json
with open('/etc/docker/daemon.json') as f: cfg=json.load(f)
cfg.setdefault('features',{})['buildkit']=True
with open('/etc/docker/daemon.json','w') as f: json.dump(cfg,f,indent=2)
" && sudo systemctl reload docker && ok "BuildKit aktiviert" || warn "BuildKit manuell aktivieren falls nötig"
else
  ok "BuildKit bereits aktiv"
fi

# ── Buildx installieren ───────────────────────────────────────────────────────
step "Docker Buildx"
RAW_ARCH=$(uname -m)
case $RAW_ARCH in
  x86_64)        BX_ARCH="amd64" ;;
  aarch64|arm64) BX_ARCH="arm64" ;;
  armv7l)        BX_ARCH="arm-v7" ;;
  *)             BX_ARCH="amd64" ;;
esac
ok "Architektur: $RAW_ARCH → $BX_ARCH"

# Alle alten Buildx-Versionen entfernen
sudo apt-get remove -y docker-buildx-plugin 2>/dev/null || true
for D in "$HOME/.docker/cli-plugins" "/usr/lib/docker/cli-plugins" \
          "/usr/local/lib/docker/cli-plugins" "/usr/libexec/docker/cli-plugins" \
          "/usr/lib/x86_64-linux-gnu/docker/cli-plugins" "/usr/lib/aarch64-linux-gnu/docker/cli-plugins"; do
  [ -f "$D/docker-buildx" ] && sudo rm -f "$D/docker-buildx" && info "  Entfernt: $D/docker-buildx"
done

# Plugin-Verzeichnis erkennen: gleicher Ort wie docker-compose
COMPOSE_PATH=$($DOCKER_CMD info 2>/dev/null | grep -i "Path:.*docker-compose" | awk '{print $2}' | head -1)
if [ -n "$COMPOSE_PATH" ]; then
  PLUGIN_DIR=$(dirname "$COMPOSE_PATH")
else
  for TRY in "/usr/libexec/docker/cli-plugins" "/usr/lib/docker/cli-plugins" "/usr/local/lib/docker/cli-plugins"; do
    [ -d "$TRY" ] && PLUGIN_DIR="$TRY" && break
  done
  PLUGIN_DIR="${PLUGIN_DIR:-/usr/local/lib/docker/cli-plugins}"
fi
ok "Plugin-Verzeichnis: $PLUGIN_DIR"

BX_VER=$(curl -sf https://api.github.com/repos/docker/buildx/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4 || echo "v0.19.3")
info "Installiere Buildx $BX_VER…"
sudo mkdir -p "$PLUGIN_DIR"
sudo curl -fsSL \
  "https://github.com/docker/buildx/releases/download/${BX_VER}/buildx-${BX_VER}.linux-${BX_ARCH}" \
  -o "$PLUGIN_DIR/docker-buildx"
sudo chmod +x "$PLUGIN_DIR/docker-buildx"
INSTALLED=$($DOCKER_CMD buildx version 2>/dev/null | grep -oP 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "?")
ok "Buildx $INSTALLED aktiv"

# ── .env erstellen ────────────────────────────────────────────────────────────
step "Konfiguration"
if [ ! -f ".env" ]; then
  cp .env.example .env
  ok ".env erstellt"
fi

# JWT_SECRET generieren
if grep -q "bitte-aendern" .env 2>/dev/null || grep -q "^JWT_SECRET=$" .env 2>/dev/null; then
  JWT=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" .env
  ok "JWT_SECRET generiert"
fi

# MinIO Secret
if grep -q "^MINIO_SECRET_KEY=changeme" .env 2>/dev/null; then
  MSEC=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
  sed -i "s|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=$MSEC|" .env
  ok "MinIO Secret generiert"
fi

# Admin Email
ADMIN_EMAIL=$(grep "^ADMIN_EMAIL=" .env | cut -d= -f2)
if [ -z "$ADMIN_EMAIL" ] || [ "$ADMIN_EMAIL" = "admin@example.com" ]; then
  echo ""; read -p "  Admin E-Mail: " IN_EMAIL
  [[ "$IN_EMAIL" == *"@"*"."* ]] && sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=$IN_EMAIL|" .env && ok "Admin E-Mail: $IN_EMAIL" || warn "Ungültig – später in .env setzen"
fi

# Admin Passwort
ADMIN_PW=$(grep "^ADMIN_PASSWORD=" .env | cut -d= -f2)
if [ -z "$ADMIN_PW" ] || [ "$ADMIN_PW" = "bitte-aendern" ]; then
  echo ""; read -s -p "  Admin Passwort (min. 8 Zeichen): " IN_PW; echo ""
  if [ ${#IN_PW} -ge 8 ]; then
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$IN_PW|" .env && ok "Admin Passwort gesetzt"
  else
    warn "Zu kurz – bitte ADMIN_PASSWORD in .env manuell setzen"
  fi
fi

APP_PW=$(grep "^APP_PASSWORD=" .env | cut -d= -f2)
if [ -z "$APP_PW" ] || [ "$APP_PW" = "bitte-aendern" ]; then
  echo ""; read -s -p "  App Passwort (min. 8 Zeichen): " IN_PW; echo ""
  if [ ${#IN_PW} -ge 8 ]; then
    sed -i "s|^APP_PASSWORD=.*|APP_PASSWORD=$IN_PW|" .env && ok "App Passwort gesetzt"
  else
    warn "Zu kurz – bitte ADMIN_PASSWORD in .env manuell setzen"
  fi
fi

# ── Port prüfen ───────────────────────────────────────────────────────────────
PORT=$(grep "^PORT=" .env | cut -d= -f2 || echo "8080"); PORT=${PORT:-8080}
if ss -tlnp 2>/dev/null | grep -q ":$PORT " || netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
  warn "Port $PORT belegt – PORT= in .env ändern"
else
  ok "Port $PORT frei"
fi

# ── Starten ───────────────────────────────────────────────────────────────────
step "PixelVault starten"
info "Baue Container (beim ersten Start: ~5-10 Minuten)…"
DOCKER_BUILDKIT=1 $COMPOSE_CMD up -d --build

# Warten
info "Warte auf PixelVault…"
for i in $(seq 1 40); do
  curl -sf "http://localhost:$PORT" >/dev/null 2>&1 && break
  sleep 3; echo -n "."
done; echo ""

echo -e "\n${BOLD}╔══════════════════════════════════════╗"
echo -e "║    🎉 PixelVault ist bereit!          ║"
echo -e "╚══════════════════════════════════════╝${NC}"
echo -e "\n  👉 http://localhost:$PORT"
echo -e "  Admin-Login mit der E-Mail und dem Passwort aus der .env\n"
echo "  Befehle:"
echo "    Logs:      docker compose logs -f"
echo "    Status:    docker compose ps"
echo "    Stoppen:   docker compose down"
echo "    Update:    git pull && docker compose up -d --build"
[ "$DOCKER_CMD" = "sudo docker" ] && echo -e "\n${YELLOW}⚠  Neu einloggen damit 'docker' ohne sudo funktioniert${NC}"
echo ""
