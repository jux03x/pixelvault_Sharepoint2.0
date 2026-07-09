#!/usr/bin/env node
/**
 * PixelVault Mock Server
 * ─────────────────────
 * Simuliert die echte Backend-API mit Testdaten.
 * Kein Docker, keine Datenbank, kein MinIO nötig.
 *
 * Starten:  node scripts/mock-server.js
 * Läuft auf: http://localhost:3000
 */

const http = require('http');
const url = require('url');

// ── Testdaten ────────────────────────────────────────────────────────────────

// Echte Unsplash-Bilder als Platzhalter (verschiedene Größen/Seitenverhältnisse)
const SAMPLE_IMAGES = [
  { id: 'img-001', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', name: 'Berge im Nebel.jpg', likes: 42 },
  { id: 'img-002', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800', thumb: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400', name: 'Grüne Landschaft.jpg', likes: 38 },
  { id: 'img-003', url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=800', thumb: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400', name: 'Hund am Strand.jpg', likes: 31 },
  { id: 'img-004', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800', thumb: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400', name: 'Welpe.jpg', likes: 27 },
  { id: 'img-005', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800', thumb: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', name: 'Portrait.jpg', likes: 24 },
  { id: 'img-006', url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800', thumb: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400', name: 'Sonnenuntergang.jpg', likes: 19 },
  { id: 'img-007', url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800', thumb: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400', name: 'Stadt bei Nacht.jpg', likes: 17 },
  { id: 'img-008', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', thumb: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', name: 'Schneeberge.jpg', likes: 15 },
  { id: 'img-009', url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800', thumb: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=400', name: 'Wald.jpg', likes: 12 },
  { id: 'img-010', url: 'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800', thumb: 'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400', name: 'Strand.jpg', likes: 9 },
  { id: 'img-011', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800', thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400', name: 'Nebel im Tal.jpg', likes: 7 },
  { id: 'img-012', url: 'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=800', thumb: 'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=400', name: 'Ozean.jpg', likes: 5 },
];

// In-Memory State (wird nicht gespeichert, geht bei Neustart verloren)
let images = SAMPLE_IMAGES.map((img, i) => ({
  id: img.id,
  filename: img.name,
  original_filename: img.name,
  storage_path: `originals/${img.id}.jpg`,
  thumbnail_path: `thumbnails/${img.id}.webp`,
  mime_type: 'image/jpeg',
  size_bytes: Math.floor(Math.random() * 8000000) + 500000,
  uploaded_by: 'user-001',
  created_at: new Date(Date.now() - i * 3600000 * 4).toISOString(),
  is_flagged: false,
  is_deleted: false,
  scan_status: 'clean',
  like_count: img.likes,
  user_liked: false,
  url: img.url,
  thumbnail_url: img.thumb,
  download_url: img.url,
  uploader_email: i === 0 ? 'admin@example.com' : 'user@example.com',
}));

let likedImages = new Set();
let isLoggedIn = false;
let isAdmin = false;
let uploadCounter = images.length;

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function paginate(arr, page = 1, limit = 24) {
  const offset = (page - 1) * limit;
  return {
    items: arr.slice(offset, offset + limit),
    total: arr.length,
    page,
    limit,
    pages: Math.ceil(arr.length / limit),
  };
}

function activeImages() {
  return images.filter(img => !img.is_deleted && !img.is_flagged && img.scan_status !== 'infected');
}

// ── Request Handler ──────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const query = parsed.query;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') return json(res, {});

  console.log(`${method} ${path}`);

  // ── Health ────────────────────────────────────────────────────────────────
  if (path === '/health') {
    return json(res, { status: 'ok', mock: true, timestamp: new Date().toISOString() });
  }

  // ── Config ────────────────────────────────────────────────────────────────
  if (path === '/config' && method === 'GET') {
    return json(res, {
      theme: { primaryColor: '#0a0a0a', accentColor: '#007AFF', backgroundColor: '#fafafa' },
      branding: { title: '📸 PixelVault (Mock)', description: 'Testmodus – kein echtes Backend' },
      features: { likesEnabled: true, uploadEnabled: true, registrationEnabled: true },
    });
  }

  if (path === '/config' && method === 'PUT') {
    const body = await readBody(req);
    console.log('  Config update (wird nicht gespeichert):', body);
    return json(res, { ...body, _mock: true });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (path === '/auth/request-link' && method === 'POST') {
    const body = await readBody(req);
    const email = body.email || '';
    console.log(`  Magic Link angefordert für: ${email}`);
    console.log(`  ⚡ Mock-Token: mock-token-123`);
    console.log(`  👉 Verifizierungs-URL: http://localhost:5173/auth/verify?token=mock-token-123`);
    return json(res, { message: `Mock: Magic Link für ${email} – Token ist "mock-token-123"` });
  }

  if (path === '/auth/verify' && method === 'POST') {
    const body = await readBody(req);
    if (body.token === 'mock-token-123' || body.token?.startsWith('mock-')) {
      isLoggedIn = true;
      isAdmin = true; // Im Mock immer Admin damit man alles testen kann
      return json(res, {
        token: 'mock-jwt-token-fuer-tests',
        user: { id: 'user-001', email: 'admin@example.com', role: 'admin' },
      });
    }
    return json(res, { error: 'Ungültiger Token. Nutze "mock-token-123"' }, 401);
  }

  if (path === '/auth/me' && method === 'GET') {
    const auth = req.headers.authorization;
    if (auth === 'Bearer mock-jwt-token-fuer-tests') {
      return json(res, { id: 'user-001', email: 'admin@example.com', role: 'admin' });
    }
    return json(res, { error: 'Nicht eingeloggt' }, 401);
  }

  // ── Images ────────────────────────────────────────────────────────────────
  if (path === '/images' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 24;
    const sort = query.sort;

    let list = [...activeImages()];
    if (sort === 'likes') {
      list.sort((a, b) => b.like_count - a.like_count);
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // user_liked setzen
    list = list.map(img => ({ ...img, user_liked: likedImages.has(img.id) }));

    const paged = paginate(list, page, limit);
    return json(res, { images: paged.items, pagination: { page: paged.page, limit: paged.limit, total: paged.total, pages: paged.pages } });
  }

  if (path === '/images/top' && method === 'GET') {
    const top = [...activeImages()]
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 10)
      .map(img => ({ ...img, user_liked: likedImages.has(img.id) }));
    return json(res, { images: top });
  }

  if (path === '/images/upload' && method === 'POST') {
    // Simuliere Upload – liest den Request-Body (multipart) aber ignoriert ihn
    await new Promise(resolve => { req.on('data', () => {}); req.on('end', resolve); });
    uploadCounter++;
    const newId = `img-upload-${uploadCounter}`;
    const newImage = {
      id: newId,
      filename: `upload-${uploadCounter}.jpg`,
      original_filename: `mein-foto-${uploadCounter}.jpg`,
      storage_path: `originals/${newId}.jpg`,
      thumbnail_path: `thumbnails/${newId}.webp`,
      mime_type: 'image/jpeg',
      size_bytes: 2400000,
      uploaded_by: 'user-001',
      created_at: new Date().toISOString(),
      is_flagged: false,
      is_deleted: false,
      scan_status: 'clean',
      like_count: 0,
      user_liked: false,
      url: `https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=800&sig=${uploadCounter}`,
      thumbnail_url: `https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&sig=${uploadCounter}`,
      download_url: `https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=800&sig=${uploadCounter}`,
      uploader_email: 'admin@example.com',
    };
    images.unshift(newImage);
    console.log(`  ✅ Mock-Upload erfolgreich: ${newImage.filename}`);
    return json(res, newImage, 201);
  }

  // GET /images/:id
  const imageMatch = path.match(/^\/images\/([^/]+)$/);
  if (imageMatch && method === 'GET') {
    const img = images.find(i => i.id === imageMatch[1]);
    if (!img) return json(res, { error: 'Nicht gefunden' }, 404);
    return json(res, { ...img, user_liked: likedImages.has(img.id) });
  }

  // DELETE /images/:id
  if (imageMatch && method === 'DELETE') {
    const idx = images.findIndex(i => i.id === imageMatch[1]);
    if (idx === -1) return json(res, { error: 'Nicht gefunden' }, 404);
    images[idx].is_deleted = true;
    return json(res, { message: 'Gelöscht' });
  }

  // ── Likes ─────────────────────────────────────────────────────────────────
  const likeMatch = path.match(/^\/images\/([^/]+)\/like$/);
  if (likeMatch) {
    const imgId = likeMatch[1];
    const img = images.find(i => i.id === imgId);
    if (!img) return json(res, { error: 'Nicht gefunden' }, 404);

    if (method === 'POST') {
      if (likedImages.has(imgId)) return json(res, { error: 'Bereits geliked' }, 409);
      likedImages.add(imgId);
      img.like_count++;
      return json(res, { liked: true, like_count: img.like_count });
    }
    if (method === 'DELETE') {
      likedImages.delete(imgId);
      img.like_count = Math.max(0, img.like_count - 1);
      return json(res, { liked: false, like_count: img.like_count });
    }
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  if (path === '/admin/stats' && method === 'GET') {
    return json(res, {
      total_images: images.filter(i => !i.is_deleted).length,
      total_users: 3,
      total_likes: images.reduce((sum, i) => sum + i.like_count, 0),
    });
  }

  if (path === '/admin/images' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 24;
    const list = images.filter(i => !i.is_deleted);
    const paged = paginate(list, page, limit);
    return json(res, { images: paged.items, pagination: { page: paged.page, limit: paged.limit, total: paged.total, pages: paged.pages } });
  }

  if (path === '/admin/users' && method === 'GET') {
    return json(res, {
      users: [
        { id: 'user-001', email: 'admin@example.com', role: 'admin', image_count: 8, created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
        { id: 'user-002', email: 'max@example.com', role: 'user', image_count: 3, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
        { id: 'user-003', email: 'anna@example.com', role: 'user', image_count: 1, created_at: new Date(Date.now() - 86400000).toISOString() },
      ],
    });
  }

  const adminFlagMatch = path.match(/^\/admin\/images\/([^/]+)\/flag$/);
  if (adminFlagMatch && method === 'PUT') {
    const body = await readBody(req);
    const img = images.find(i => i.id === adminFlagMatch[1]);
    if (img) img.is_flagged = body.flagged !== false;
    return json(res, { message: 'Flag gesetzt' });
  }

  const adminDeleteMatch = path.match(/^\/admin\/images\/([^/]+)$/);
  if (adminDeleteMatch && method === 'DELETE') {
    const img = images.find(i => i.id === adminDeleteMatch[1]);
    if (img) img.is_deleted = true;
    return json(res, { message: 'Gelöscht' });
  }

  if (path === '/admin/css' && method === 'POST') {
    await new Promise(resolve => { req.on('data', () => {}); req.on('end', resolve); });
    return json(res, { message: 'CSS hochgeladen (Mock – wird nicht gespeichert)' });
  }

  // 404
  console.log(`  ⚠️  Unbekannte Route: ${method} ${path}`);
  return json(res, { error: `Route nicht gefunden: ${method} ${path}` }, 404);
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      📸 PixelVault Mock-Server gestartet         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  API läuft auf:  http://localhost:${PORT}            ║`);
  console.log('║                                                  ║');
  console.log('║  Starte das Frontend parallel:                   ║');
  console.log('║  cd client && npm run dev                        ║');
  console.log('║  → http://localhost:5173                         ║');
  console.log('║                                                  ║');
  console.log('║  Login-Token für Tests:  mock-token-123          ║');
  console.log('║  → /auth → E-Mail eingeben → Token eingeben      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ${images.length} Testbilder geladen`);
  console.log('  Alle Änderungen (Likes, Uploads) gehen bei Neustart verloren');
  console.log('');
});
