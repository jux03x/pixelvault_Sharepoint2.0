# 📸 PixelVault

> Eine sichere, schöne Bildergalerie für dein Team oder deine Community – selbst gehostet, open source, ohne monatliche Kosten.

![PixelVault Screenshot](docs/screenshot-placeholder.png)

---

## ✨ Was ist PixelVault?

PixelVault ist eine selbst gehostete Bildergalerie, die du auf deinem eigenen Server betreiben kannst. Deine Bilder gehören dir – kein Cloud-Abo, keine Datenweitergabe, kein Vendor Lock-in.

**Funktionen:**
- 🖼️ Bilder hochladen, anschauen und herunterladen
- ❤️ Like-System mit Ranking der beliebtesten Bilder
- 🔐 Sicherer Login via Magic Link (kein Passwort nötig!)
- 🛡️ Automatischer Malware-Scan aller Uploads
- 🎨 Anpassbares Design direkt im Admin-Bereich
- 📱 Funktioniert perfekt auf Handy und Desktop

---

## 🚀 Schnellstart (5 Minuten)

### Was du brauchst

- Ein Computer oder Server mit installiertem [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Das ist alles! ✅

> **Kein IT-Wissen erforderlich.** Wenn du Docker installiert hast, reichen zwei Befehle.

---

### Schritt 1: PixelVault herunterladen

Öffne ein Terminal (auf Windows: "PowerShell", auf Mac: "Terminal") und gib ein:

```bash
git clone https://github.com/yourusername/pixelvault.git
cd pixelvault
```

**Kein Git?** Klicke oben auf der GitHub-Seite auf den grünen Button **"Code"** → **"Download ZIP"**, entpacke die ZIP-Datei und öffne den Ordner im Terminal.

---

### Schritt 2: Konfiguration anpassen (optional)

Kopiere die Beispiel-Konfiguration:

```bash
cp .env.example .env
```

Öffne die Datei `.env` mit einem Texteditor (z.B. Notepad auf Windows, TextEdit auf Mac) und ändere mindestens diese Zeile:

```
ADMIN_EMAIL=deine@email.de
```

Das war's – alle anderen Einstellungen funktionieren sofort mit sinnvollen Standardwerten.

---

### Schritt 3: Starten!

```bash
docker compose up -d
```

⏳ Beim ersten Start werden alle Komponenten heruntergeladen (ca. 2–5 Minuten je nach Internetverbindung).

Dann öffne deinen Browser und gehe zu:

**👉 http://localhost:8080**

---

## 🔑 Erster Login als Admin

1. Öffne **http://localhost:8080**
2. Klicke auf "Anmelden"
3. Gib deine Admin-E-Mail ein (die du in `.env` eingetragen hast)
4. Du erhältst eine E-Mail mit einem Magic Link – klicke darauf
5. Du bist eingeloggt und hast sofort Admin-Rechte! 🎉

> **Wichtig für den Mailversand:** Trage in der `.env` deine SMTP-Daten ein (z.B. von deinem E-Mail-Anbieter). Für lokale Tests wird der Link auch direkt in der Konsole angezeigt.

---

## ⚙️ Alle Konfigurationsoptionen

Öffne die Datei `.env` in einem Texteditor. Hier ist jede Einstellung erklärt:

```env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PFLICHT: Diese Einstellungen anpassen
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Deine Admin-E-Mail (wird automatisch Admin beim ersten Login)
ADMIN_EMAIL=admin@example.com

# Geheimer Schlüssel für Logins (beliebige lange Zeichenkette, z.B. mit https://passwordsgenerator.net/)
JWT_SECRET=bitte-aendern-sehr-langer-zufaelliger-text

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E-MAIL KONFIGURATION (für Magic Links)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Dein E-Mail-Provider (z.B. smtp.gmail.com für Gmail)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=deine@email.de
SMTP_PASS=dein-passwort
SMTP_FROM=PixelVault <deine@email.de>

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OPTIONALE EINSTELLUNGEN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Maximale Dateigröße pro Upload (Standard: 50MB)
MAX_FILE_SIZE=50MB

# Port, unter dem PixelVault erreichbar ist (Standard: 8080)
PORT=8080

# Optionaler Zugangscode (wenn gesetzt, müssen Nutzer diesen Code eingeben)
# ACCESS_CODE=mein-geheimer-code

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TECHNISCHE EINSTELLUNGEN (nicht ändern)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DB_URL=postgresql://pixelvault:pixelvault@postgres:5432/pixelvault
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=pixelvault
MINIO_SECRET_KEY=pixelvault123
MINIO_BUCKET=images
NODE_ENV=production
```

---

## 🛑 PixelVault stoppen

```bash
docker compose down
```

Deine Bilder und Daten bleiben dabei erhalten!

---

## 🔄 Updates installieren

```bash
git pull
docker compose up -d --build
```

---

## 🌐 Im Internet erreichbar machen

Um PixelVault öffentlich zugänglich zu machen (z.B. unter deiner eigenen Domain):

1. Ändere `APP_URL` in der `.env` auf deine Domain: `APP_URL=https://meinegalerie.de`
2. Richte einen Reverse Proxy ein (z.B. mit Caddy oder Traefik) – eine Anleitung findest du in [`docs/deployment.md`](docs/deployment.md)
3. Aktiviere HTTPS (kostenlos mit Let's Encrypt)

---

## 🎨 Design anpassen

Melde dich als Admin an und gehe zu **Admin → Design**. Dort kannst du:
- Farben und Schriften ändern
- Titel und Beschreibung setzen
- Eigenes CSS hochladen

Keine Programmierkenntnisse nötig!

---

## 🆘 Hilfe & häufige Probleme

**Problem: Seite lädt nicht**
→ Warte 30 Sekunden nach dem Start und lade die Seite neu. Beim ersten Start dauert es etwas länger.

**Problem: Ich bekomme keine Magic-Link E-Mail**
→ Schaue in den Spam-Ordner. Oder schau in die Server-Logs: `docker compose logs server` – dort wird der Link auch ausgegeben.

**Problem: Upload schlägt fehl**
→ Prüfe ob die Datei kleiner als `MAX_FILE_SIZE` ist.

**Fragen & Bugs:** Öffne ein [Issue auf GitHub](https://github.com/yourusername/pixelvault/issues) – wir helfen gerne!

---

## 🏗️ Technischer Stack

| Komponente | Technologie |
|-----------|-------------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Datenbank | PostgreSQL |
| Dateispeicher | MinIO (S3-kompatibel) |
| Malware-Scan | ClamAV |
| Reverse Proxy | Nginx |

---

## 📄 Lizenz

MIT License – kostenlos nutzbar, auch kommerziell. Siehe [LICENSE](LICENSE).

---

<p align="center">Made with ❤️ – Open Source forever</p>
