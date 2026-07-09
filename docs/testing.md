# 🧪 PixelVault – Lokal testen ohne Docker

Diese Anleitung zeigt wie du das Frontend vollständig testen kannst, ohne Docker oder eine echte Datenbank zu brauchen.

---

## Was du brauchst

- [Node.js](https://nodejs.org) (Version 18 oder neuer) – das ist alles

Prüfen ob Node.js installiert ist:
```bash
node --version   # sollte v18.x.x oder höher zeigen
```

---

## Option A: Frontend + Mock-Server (empfohlen zum Testen)

Der Mock-Server simuliert die komplette Backend-API mit echten Testbildern. Kein Docker, keine Datenbank.

### Schritt 1: Abhängigkeiten installieren

```bash
# Im pixelvault/ Ordner:
cd client
npm install
cd ..
```

### Schritt 2: Mock-Server starten (Terminal 1)

```bash
node scripts/mock-server.js
```

Du siehst:
```
╔══════════════════════════════════════════════════╗
║      📸 PixelVault Mock-Server gestartet         ║
║  API läuft auf:  http://localhost:3000            ║
╚══════════════════════════════════════════════════╝
```

### Schritt 3: Frontend starten (Terminal 2)

```bash
cd client
npm run dev
```

### Schritt 4: Browser öffnen

👉 **http://localhost:5173**

---

## Als Admin einloggen (im Mock)

1. Klicke auf "Anmelden"
2. Gib irgendeine E-Mail ein (z.B. `test@test.de`)
3. Klicke "Magic Link senden"
4. **Schau in Terminal 1** – dort siehst du den Link:
   ```
   ⚡ Mock-Token: mock-token-123
   👉 http://localhost:5173/auth/verify?token=mock-token-123
   ```
5. Öffne diesen Link – du bist eingeloggt als Admin

---

## Was du testen kannst

| Feature | Mock-Server | Ohne Backend |
|---|---|---|
| Startseite mit Top-Bildern | ✅ | ⚠️ leer |
| Galerie mit Infinite Scroll | ✅ | ⚠️ leer |
| Like-System | ✅ | ❌ |
| Login-Formular | ✅ | ⚠️ nur UI |
| Upload-Seite (UI) | ✅ | ✅ |
| Upload tatsächlich | ✅ simuliert | ❌ |
| Admin-Dashboard | ✅ | ❌ |
| Design-Tab (Farben etc.) | ✅ | ✅ |
| Bilddetailseite | ✅ | ❌ |

---

## Option B: Nur Frontend (ohne Mock-Server)

```bash
cd client
npm install
npm run dev
```

Die UI lädt, API-Calls schlagen still fehl. Gut zum Testen von Layout und CSS.

---

## Option C: Kompletter Stack mit Docker

```bash
cp .env.example .env
# ADMIN_EMAIL in .env setzen
docker compose up -d --build
# → http://localhost:8080
```

---

## Mock-Server – wichtige Details

- **Alle Änderungen gehen bei Neustart verloren** – Likes, Uploads etc. sind nur im RAM
- **Immer Admin** – im Mock hat jeder eingeloggte User Admin-Rechte, damit du alles testen kannst
- **Echte Bilder** – der Mock nutzt Unsplash-Bilder als Platzhalter, sieht also wie die echte App aus
- **Kein SMTP** – E-Mails werden nicht wirklich verschickt, der Token erscheint im Terminal
