# 🚀 Frontend auf Vercel deployen (kostenlos)

Das Frontend läuft auf Vercel mit eingebettetem Mock – kein Backend, kein Docker nötig.
Jeder Push auf GitHub deployt automatisch eine neue Version.

---

## Einmalig einrichten (~10 Minuten)

### 1. GitHub Repo erstellen

```bash
cd pixelvault
git init
git add .
git commit -m "Initial commit"
```

Auf GitHub: **New Repository** → Name: `pixelvault` → Create

```bash
git remote add origin https://github.com/DEIN-USERNAME/pixelvault.git
git push -u origin main
```

---

### 2. Vercel verbinden

1. [vercel.com](https://vercel.com) → kostenlos mit GitHub-Account registrieren
2. **"Add New Project"** → dein `pixelvault` Repo auswählen
3. Diese Einstellungen setzen:

| Feld | Wert |
|---|---|
| **Root Directory** | `client` |
| **Framework Preset** | Vite (wird automatisch erkannt) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Unter **Environment Variables** hinzufügen:

| Key | Value |
|---|---|
| `VITE_USE_MOCK` | `true` |

5. **Deploy** klicken

Nach ~60 Sekunden läuft die App unter `https://pixelvault-XXX.vercel.app` ✅

---

## Einloggen auf Vercel (Mock-Modus)

1. Klicke auf **"Anmelden"**
2. Gib irgendeine E-Mail ein
3. Klicke **"Demo-Token generieren"**
4. Der Token `mock-token-123` erscheint direkt auf der Seite
5. Klicke darauf → er wird ins Feld übernommen
6. **"Einloggen"** klicken → du bist Admin

---

## Updates deployen

```bash
# Änderung machen, dann:
git add .
git commit -m "Beschreibung der Änderung"
git push
```

Vercel erkennt den Push und deployt automatisch. ~30-60 Sekunden.

---

## Lokal mit Mock testen (ohne Vercel)

```bash
cd client
cp .env.mock .env.local   # einmalig
npm install               # einmalig
npm run dev               # → http://localhost:5173
```

---

## Später: Echtes Backend verbinden

Wenn du irgendwann das echte Backend deployst (z.B. auf einem VPS):

1. In Vercel → Project Settings → Environment Variables
2. `VITE_USE_MOCK` auf `false` setzen (oder löschen)
3. `VITE_API_URL` auf deine Backend-URL setzen: `https://api.meinegalerie.de`
4. Neu deployen

---

## Was im Mock-Modus funktioniert

| Feature | Status |
|---|---|
| Startseite mit Top-Bildern | ✅ echte Unsplash-Bilder |
| Galerie mit Infinite Scroll | ✅ |
| Like-System | ✅ (nur diese Browser-Session) |
| Login-Flow | ✅ Token erscheint direkt in der UI |
| Upload (simuliert) | ✅ Fortschrittsbalken, Vorschau |
| Admin-Dashboard | ✅ Stats, Bildverwaltung, User-Liste |
| Design-Tab | ✅ Farben/Titel ändern |
| Datenspeicherung | ⚠️ nur im RAM, geht bei Reload verloren |
