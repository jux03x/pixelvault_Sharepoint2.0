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

## Option B: Kompletter Stack mit Docker

```bash
cp .env.example .env
# ADMIN_EMAIL in .env setzen
docker compose up -d --build
# → http://localhost:8080
```
