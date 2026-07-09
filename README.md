# 📸 PixelVault

> Sichere, selbst gehostete Bildergalerie – open source, kein Abo, deine Daten.

---

## ✨ Funktionen

- 🖼️ Bilder hochladen, anschauen, herunterladen
- ❤️ Like-System mit Ranking
- 🔐 Login via Magic Link (kein Passwort)
- 🛡️ Automatischer Malware-Scan (ClamAV)
- 🎨 Design im Admin-Bereich anpassbar
- 📱 Mobile-first, funktioniert auf allen Geräten

---

## 🚀 Installation (Linux)

### Voraussetzungen

- Linux (Ubuntu 20.04+, Debian 11+, Fedora 38+)
- Einen User mit `sudo`-Rechten
- Internetzugang (für den ersten Download)

**Das war's.** Docker wird automatisch installiert falls nicht vorhanden.

---

### Schritt 1: Projekt herunterladen

```bash
git clone https://github.com/DEIN-USERNAME/pixelvault.git
cd pixelvault
```

Kein git? ZIP herunterladen, entpacken, Terminal in den Ordner:
```bash
unzip pixelvault.zip
cd pixelvault
```

---

### Schritt 2: Installer ausführen

```bash
bash install.sh
```

Das Skript macht automatisch:
- ✅ Docker Engine installieren (offiziell, nicht das veraltete `docker.io`)
- ✅ Docker Compose V2 sicherstellen
- ✅ BuildKit aktivieren
- ✅ Berechtigungen setzen
- ✅ Sichere Zufalls-Secrets generieren
- ✅ Admin-Email abfragen
- ✅ Alle Container bauen und starten

**Beim ersten Start:** 5–10 Minuten (Images werden heruntergeladen, Sharp wird kompiliert).

---

### Schritt 3: Browser öffnen

```
http://localhost:8080
```

---

## 🔑 Erster Login

1. Öffne `http://localhost:8080`
2. Klicke **"Anmelden"**
3. Gib deine Admin-Email ein (die du beim Setup eingetragen hast)
4. Prüfe deine E-Mails → klicke den Magic Link

> **Kein SMTP konfiguriert?** Der Login-Link erscheint direkt in den Server-Logs:
> ```bash
> docker compose logs server | grep "Magic link"
> ```

---

## ⚙️ Konfiguration

Alle Einstellungen in der `.env` Datei:

```env
# ── Pflicht ──────────────────────────────────────────
ADMIN_EMAIL=deine@email.de        # Wird automatisch Admin

# ── Port ─────────────────────────────────────────────
PORT=8080                          # Unter welchem Port PixelVault läuft

# ── Upload ───────────────────────────────────────────
MAX_FILE_SIZE=50MB                 # Max. Dateigröße pro Upload

# ── E-Mail (für Magic Links) ──────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine@gmail.com
SMTP_PASS=dein-app-passwort
SMTP_FROM=PixelVault <deine@gmail.com>

# ── Zugang einschränken (optional) ───────────────────
# Nur diese E-Mails dürfen sich registrieren:
# ALLOWED_EMAILS=anna@mail.de,max@mail.de
#
# Oder nur diese Domain:
# ALLOWED_DOMAIN=meinefirma.de
#
# Oder Zugangscode:
# ACCESS_CODE=geheim123
```

Nach Änderungen neu starten:
```bash
docker compose up -d
```

---

## 🛠️ Nützliche Befehle

```bash
# Status aller Container
docker compose ps

# Logs in Echtzeit
docker compose logs -f

# Nur Server-Logs
docker compose logs -f server

# Neu starten
docker compose restart

# Stoppen (Daten bleiben erhalten)
docker compose down

# Update auf neue Version
git pull && docker compose up -d --build
```

---

## 🌐 Öffentlich erreichbar machen

Siehe [`docs/deployment.md`](docs/deployment.md) für die vollständige Anleitung mit:
- Domain + DNS einrichten
- Caddy als Reverse Proxy (HTTPS automatisch)
- Firewall konfigurieren

---

## 🔧 Häufige Probleme

**"permission denied" beim docker-Befehl**
```bash
# Neu einloggen nach Gruppenänderung, oder:
newgrp docker
```

**Port 8080 bereits belegt**
```bash
# In .env ändern:
PORT=8081
docker compose up -d
```

**ClamAV braucht sehr lange beim ersten Start**
```
Normal – ClamAV lädt beim ersten Start Virus-Definitionen herunter (~200MB).
Das passiert nur einmal. Danach startet es in Sekunden.
```

**Magic Link E-Mail kommt nicht an**
```bash
# Link direkt aus den Logs holen:
docker compose logs server | grep -i "magic link"
```

**Bilder werden nicht angezeigt nach Upload**
```bash
# MinIO Status prüfen:
docker compose logs minio
docker compose logs minio-setup
```

---

## 📁 Projektstruktur

```
pixelvault/
├── install.sh          ← Linux-Installer (hier starten)
├── docker-compose.yml  ← Alle Services
├── .env.example        ← Konfigurationsvorlage
├── client/             ← React Frontend
├── server/             ← Node.js Backend
├── nginx/              ← Reverse Proxy
├── scripts/            ← Datenbank-Schema, Mock-Server
└── docs/               ← Weitere Anleitungen
```

---

## 📄 Lizenz

MIT – kostenlos nutzbar, auch kommerziell.
