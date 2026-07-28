# 📸 PixelVault

Selbst gehostete Bildergalerie – open source, kein Abo, deine Daten.

**Funktionen:** Bilder hochladen · Like-System · Admin-Konsole · Malware-Scan · Apple-inspiriertes Design

---

## Installation (Linux)

### Voraussetzungen
- Ubuntu 20.04+, Debian 11+ oder Fedora 38+
- User mit `sudo`-Rechten
- Internetverbindung

Docker, Node und alles weitere wird automatisch installiert.

### 1. Herunterladen

```bash
git clone https://github.com/DEIN-USERNAME/pixelvault.git
cd pixelvault
```

### 2. Starten

```bash
bash install.sh
```

Das Skript fragt nach deiner Admin-E-Mail und einem Passwort, installiert alles Nötige und startet PixelVault.

**Beim ersten Start:** 5–10 Minuten (Images werden heruntergeladen).

### 3. Öffnen

```
http://localhost:8080
```

Login mit der E-Mail und dem Passwort das du beim Setup eingegeben hast.

---

## Konfiguration (.env)

```env
# Admin-Account
ADMIN_EMAIL=deine@email.de
ADMIN_PASSWORD=sicheres-passwort

# Port (Standard: 8080)
PORT=8080

# Max. Upload-Größe
MAX_FILE_SIZE=50MB

# Registrierung
# false = nur Admin legt Nutzer an (Standard, empfohlen)
# true  = jeder kann sich selbst registrieren
REGISTRATION_OPEN=false
```

Nach Änderungen: `docker compose up -d`

---

## Nutzer verwalten

Melde dich als Admin an → **Admin → Nutzer** → Neuen Nutzer anlegen.

Oder über die `.env`:
- `REGISTRATION_OPEN=true` setzen → Nutzer können sich selbst registrieren

---

## Nützliche Befehle

```bash
docker compose logs -f          # Logs in Echtzeit
docker compose ps               # Status aller Container
docker compose down             # Stoppen (Daten bleiben)
docker compose up -d --build    # Nach Update neu bauen
docker compose restart server   # Nur Backend neu starten
```

---

## Auf einem echten Server betreiben

1. Server bei Hetzner erstellen (CX22, Ubuntu 24.04, ~4€/Monat)
2. `bash install.sh` ausführen
3. In `.env`: `APP_URL=https://deine-domain.de` setzen
4. Caddy installieren für automatisches HTTPS:

```bash
sudo apt install caddy
sudo nano /etc/caddy/Caddyfile
```

```
deine-domain.de {
    reverse_proxy localhost:8080
}
```

```bash
sudo systemctl reload caddy
```

HTTPS läuft sofort, kostenlos, automatisch erneuert.

---

## Häufige Probleme

**Minio alias was not configured properly**
```bash
docker exec -it pixelvault_sharepoint20-minio-1 mc alias set local http://localhost:9000 pixelvault changeme
```

**Port belegt**
```bash
# PORT= in .env ändern, dann:
docker compose up -d
```

**docker: permission denied**
```bash
# Neu einloggen nach install.sh, oder:
newgrp docker
```

**Server startet nicht**
```bash
docker compose logs server
# Fehlermeldung gibt den genauen Grund an
```

**ClamAV braucht lange**
```
Normal beim ersten Start – lädt Virus-Definitionen (~200MB).
Uploads werden zwischenzeitlich als "pending" markiert und nach dem Scan freigegeben.
```

---

## Lizenz

MIT – kostenlos nutzbar, auch kommerziell.
