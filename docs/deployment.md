# 🌐 PixelVault – Server-Deployment (öffentlich zugänglich machen)

Diese Anleitung erklärt, wie du PixelVault auf einem echten Server mit eigener Domain und HTTPS betreibst.

---

## Voraussetzungen

- Einen VPS / Server (z.B. bei Hetzner, DigitalOcean, Netcup – ab ~4€/Monat)
- Eine Domain (z.B. von Namecheap, INWX, united-domains)
- SSH-Zugriff auf den Server
- Docker und Docker Compose auf dem Server installiert

---

## Schritt 1: Server vorbereiten

```bash
# Docker installieren (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose installieren
sudo apt-get install docker-compose-plugin
```

---

## Schritt 2: PixelVault auf den Server laden

```bash
git clone https://github.com/yourusername/pixelvault.git
cd pixelvault
cp .env.example .env
nano .env   # Konfiguration anpassen
```

---

## Schritt 3: DNS konfigurieren

Gehe zu deinem Domain-Anbieter und erstelle einen **A-Record**:

```
Typ:   A
Name:  @ (oder eine Subdomain, z.B. "galerie")
Wert:  DEINE_SERVER_IP
TTL:   300
```

---

## Schritt 4: HTTPS mit Caddy (empfohlen, kostenlos)

Caddy richtet HTTPS automatisch ein. Installiere es auf dem Server:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Erstelle `/etc/caddy/Caddyfile`:

```
meinegalerie.de {
    reverse_proxy localhost:8080
}
```

```bash
sudo systemctl reload caddy
```

HTTPS wird jetzt **automatisch und kostenlos** eingerichtet! ✅

---

## Schritt 5: APP_URL setzen

In deiner `.env`:

```env
APP_URL=https://meinegalerie.de
PORT=8080
```

---

## Schritt 6: Starten

```bash
docker compose up -d
```

PixelVault ist jetzt unter `https://meinegalerie.de` erreichbar! 🎉

---

## Automatischer Neustart nach Reboot

Die Docker-Container starten automatisch neu (`restart: unless-stopped`). Kein weiterer Aufwand nötig.

---

## Backup

Wichtige Daten liegen in Docker Volumes. Um sie zu sichern:

```bash
# Datenbank sichern
docker compose exec postgres pg_dump -U pixelvault pixelvault > backup_$(date +%Y%m%d).sql

# Bilder sichern (MinIO-Daten)
docker run --rm -v pixelvault_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_backup_$(date +%Y%m%d).tar.gz /data
```
