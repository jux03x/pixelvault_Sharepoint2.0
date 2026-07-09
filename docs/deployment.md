# 🌐 PixelVault – Deployment auf einem Linux-Server

Diese Anleitung erklärt wie du PixelVault auf einem echten Server mit Domain und HTTPS betreibst.

---

## Voraussetzungen

- Linux-Server (Hetzner CX22 empfohlen: ~4€/Monat)
- Eine Domain (z.B. von INWX oder Namecheap)
- SSH-Zugang zum Server

---

## Schritt 1: Server erstellen (Hetzner)

1. Account bei [hetzner.com/cloud](https://www.hetzner.com/cloud) erstellen
2. **New Server** → Ubuntu 24.04 → CX22 → Region: Nürnberg oder Helsinki
3. SSH-Key hinzufügen (empfohlen) oder Passwort setzen
4. Server erstellen → IP-Adresse notieren (z.B. `123.456.789.0`)

---

## Schritt 2: DNS einrichten

Bei deinem Domain-Anbieter (INWX/Namecheap) einen A-Record erstellen:

```
Typ:   A
Name:  @          (für meinegalerie.de)
       fotos      (für fotos.meinedomain.de)
Wert:  123.456.789.0   ← deine Server-IP
TTL:   300
```

DNS-Propagation abwarten (1–30 Minuten). Prüfen mit:
```bash
ping meinegalerie.de
```

---

## Schritt 3: Server einrichten

Per SSH einloggen:
```bash
ssh root@123.456.789.0
```

Einen normalen User anlegen (nicht als root arbeiten):
```bash
adduser pixelvault
usermod -aG sudo pixelvault
su - pixelvault
```

---

## Schritt 4: PixelVault installieren

```bash
git clone https://github.com/DEIN-USERNAME/pixelvault.git
cd pixelvault
bash install.sh
```

Der Installer richtet Docker, Compose und alle Services automatisch ein.

---

## Schritt 5: APP_URL setzen

In der `.env`:
```env
APP_URL=https://meinegalerie.de
PORT=8080
ADMIN_EMAIL=deine@email.de
```

---

## Schritt 6: Caddy installieren (Reverse Proxy + HTTPS)

```bash
# Caddy installieren
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Caddyfile erstellen:
```bash
sudo nano /etc/caddy/Caddyfile
```

Inhalt (ersetze die Domain):
```
meinegalerie.de {
    reverse_proxy localhost:8080
}
```

Caddy starten:
```bash
sudo systemctl enable caddy --now
sudo systemctl reload caddy
```

HTTPS läuft jetzt **automatisch** – kein weiterer Aufwand. ✅

---

## Schritt 7: Firewall einrichten

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

PixelVault läuft jetzt unter `https://meinegalerie.de` 🎉

---

## Automatischer Neustart nach Reboot

Docker-Container starten automatisch neu (`restart: unless-stopped`).
Caddy startet ebenfalls automatisch durch systemd.

Nichts weiter zu tun.

---

## Backup

```bash
# Datenbank sichern
docker compose exec postgres pg_dump -U pixelvault pixelvault > backup_$(date +%Y%m%d).sql

# Bilder sichern (MinIO Volume)
docker run --rm \
  -v pixelvault_minio_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data
```

---

## Update

```bash
cd pixelvault
git pull
docker compose up -d --build
```
