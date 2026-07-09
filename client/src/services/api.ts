// ─────────────────────────────────────────────────────────────────────────────
// PixelVault API Service
//
// VITE_USE_MOCK=true  → alle Funktionen geben lokale In-Memory-Daten zurück.
//                       Kein Backend, kein Server, funktioniert auf Vercel.
//
// (kein Flag)         → echte fetch()-Calls gegen /api (das echte Backend)
// ─────────────────────────────────────────────────────────────────────────────

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const BASE = '/api';

// ── Echter HTTP-Layer ─────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('pv_token');
}

function authHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Mock-Daten ────────────────────────────────────────────────────────────────
// Läuft komplett im Browser – kein Node.js, kein Server, kein Netzwerk nötig.

const UNSPLASH = [
  { id: 'img-001', photo: '1506905925346-21bda4d32df4', name: 'Berge im Nebel.jpg',     likes: 42 },
  { id: 'img-002', photo: '1501854140801-50d01698950b', name: 'Grüne Landschaft.jpg',   likes: 38 },
  { id: 'img-003', photo: '1518020382113-a7e8fc38eac9', name: 'Hund am Strand.jpg',     likes: 31 },
  { id: 'img-004', photo: '1543466835-00a7907e9de1',   name: 'Welpe.jpg',               likes: 27 },
  { id: 'img-005', photo: '1507003211169-0a1dd7228f2d', name: 'Portrait.jpg',            likes: 24 },
  { id: 'img-006', photo: '1475924156734-496f6cac6ec1', name: 'Sonnenuntergang.jpg',     likes: 19 },
  { id: 'img-007', photo: '1449824913935-59a10b8d2000', name: 'Stadt bei Nacht.jpg',    likes: 17 },
  { id: 'img-008', photo: '1519681393784-d120267933ba', name: 'Schneeberge.jpg',         likes: 15 },
  { id: 'img-009', photo: '1518098268026-4e89f1a2cd8e', name: 'Wald.jpg',               likes: 12 },
  { id: 'img-010', photo: '1505144808419-1957a94ca61e', name: 'Strand.jpg',              likes:  9 },
  { id: 'img-011', photo: '1470071459604-3b5ec3a7fe05', name: 'Nebel im Tal.jpg',       likes:  7 },
  { id: 'img-012', photo: '1439405326854-014607f694d7', name: 'Ozean.jpg',              likes:  5 },
];

function makeImage(src: typeof UNSPLASH[0], index: number) {
  return {
    id: src.id,
    filename: src.name,
    original_filename: src.name,
    storage_path: `originals/${src.id}.jpg`,
    thumbnail_path: `thumbnails/${src.id}.webp`,
    mime_type: 'image/jpeg',
    size_bytes: 1800000 + index * 300000,
    uploaded_by: 'user-001',
    created_at: new Date(Date.now() - index * 4 * 3600 * 1000).toISOString(),
    is_flagged: false,
    is_deleted: false,
    scan_status: 'clean',
    like_count: src.likes,
    user_liked: false,
    url: `https://images.unsplash.com/photo-${src.photo}?w=1200&auto=format&fit=crop`,
    thumbnail_url: `https://images.unsplash.com/photo-${src.photo}?w=400&auto=format&fit=crop`,
    download_url: `https://images.unsplash.com/photo-${src.photo}?w=1200&auto=format&fit=crop`,
    uploader_email: index === 0 ? 'admin@example.com' : 'user@example.com',
  };
}

// In-Memory State – lebt nur für diese Browser-Session
const mockState = {
  images: UNSPLASH.map(makeImage),
  liked: new Set<string>(),
  uploadCount: UNSPLASH.length,
  loggedIn: false,

  // Liest user_liked dynamisch aus dem liked-Set
  withLiked(imgs: ReturnType<typeof makeImage>[]) {
    return imgs.map(img => ({ ...img, user_liked: this.liked.has(img.id) }));
  },

  active() {
    return this.images.filter(img => !img.is_deleted && !img.is_flagged && img.scan_status !== 'infected');
  },

  paginate<T>(arr: T[], page = 1, limit = 24) {
    const offset = (page - 1) * limit;
    return {
      items: arr.slice(offset, offset + limit),
      pagination: { page, limit, total: arr.length, pages: Math.ceil(arr.length / limit) },
    };
  },
};

// Kleine künstliche Verzögerung damit es sich "echt" anfühlt
function delay(ms = 180) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Mock-Implementierungen ────────────────────────────────────────────────────

const mock = {
  auth: {
    async requestLink(email: string) {
      await delay();
      // Statt E-Mail: Token direkt in der UI anzeigen (wird im AuthPage gehandelt)
      console.info(`[Mock] Magic Link für ${email} → Token: mock-token-123`);
      return { message: 'mock-token-123' };
    },

    async verify(token: string): Promise<{ token: string; user: { id: string; email: string; role: string } }> {
      await delay();
      if (token === 'mock-token-123' || token.startsWith('mock-')) {
        mockState.loggedIn = true;
        return {
          token: 'mock-jwt',
          user: { id: 'user-001', email: 'admin@example.com', role: 'admin' },
        };
      }
      throw new Error('Ungültiger Token. Nutze "mock-token-123"');
    },

    async me(): Promise<{ id: string; email: string; role: string }> {
      await delay(50);
      const token = getToken();
      if (token === 'mock-jwt') {
        return { id: 'user-001', email: 'admin@example.com', role: 'admin' };
      }
      throw new Error('Nicht eingeloggt');
    },
  },

  images: {
    async list(params: { page?: number; limit?: number; sort?: string }) {
      await delay();
      let list = [...mockState.active()];
      if (params.sort === 'likes') list.sort((a, b) => b.like_count - a.like_count);
      else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const { items, pagination } = mockState.paginate(mockState.withLiked(list), params.page, params.limit);
      return { images: items, pagination };
    },

    async top() {
      await delay();
      const top = [...mockState.active()]
        .sort((a, b) => b.like_count - a.like_count)
        .slice(0, 10);
      return { images: mockState.withLiked(top) };
    },

    async get(id: string) {
      await delay();
      const img = mockState.images.find(i => i.id === id);
      if (!img) throw new Error('Bild nicht gefunden');
      return { ...img, user_liked: mockState.liked.has(id) };
    },

    async upload(_file: File, onProgress?: (pct: number) => void): Promise<any> {
      // Simuliere Upload-Fortschritt
      for (const pct of [20, 50, 80, 100]) {
        await delay(300);
        onProgress?.(pct);
      }
      mockState.uploadCount++;
      const idx = mockState.uploadCount;
      const src = UNSPLASH[idx % UNSPLASH.length];
      const newImg = {
        ...makeImage(src, 0),
        id: `img-upload-${idx}`,
        filename: `upload-${idx}.jpg`,
        original_filename: _file.name,
        created_at: new Date().toISOString(),
        like_count: 0,
        url: `https://images.unsplash.com/photo-${src.photo}?w=1200&auto=format&fit=crop&sig=${idx}`,
        thumbnail_url: `https://images.unsplash.com/photo-${src.photo}?w=400&auto=format&fit=crop&sig=${idx}`,
        size_bytes: _file.size,
      };
      mockState.images.unshift(newImg);
      return newImg;
    },

    async delete(id: string) {
      const img = mockState.images.find(i => i.id === id);
      if (img) img.is_deleted = true;
      return { message: 'Gelöscht' };
    },
  },

  likes: {
    async like(imageId: string) {
      await delay(100);
      if (mockState.liked.has(imageId)) throw new Error('Bereits geliked');
      mockState.liked.add(imageId);
      const img = mockState.images.find(i => i.id === imageId)!;
      img.like_count++;
      return { liked: true, like_count: img.like_count };
    },

    async unlike(imageId: string) {
      await delay(100);
      mockState.liked.delete(imageId);
      const img = mockState.images.find(i => i.id === imageId)!;
      img.like_count = Math.max(0, img.like_count - 1);
      return { liked: false, like_count: img.like_count };
    },
  },

  config: {
    async get() {
      await delay(50);
      return {
        theme: { primaryColor: '#0a0a0a', accentColor: '#007AFF', backgroundColor: '#fafafa' },
        branding: { title: 'PixelVault', description: 'Share your moments beautifully' },
        features: { likesEnabled: true, uploadEnabled: true, registrationEnabled: true },
      };
    },
    async update(data: any) {
      await delay();
      console.info('[Mock] Config update (nicht gespeichert):', data);
      return data;
    },
  },

  admin: {
    async images(params?: any) {
      await delay();
      const list = mockState.images.filter(i => !i.is_deleted);
      const { items, pagination } = mockState.paginate(list, params?.page, params?.limit);
      return { images: items, pagination };
    },
    async flagImage(id: string, flagged: boolean) {
      const img = mockState.images.find(i => i.id === id);
      if (img) img.is_flagged = flagged;
      return { message: 'Flag gesetzt' };
    },
    async deleteImage(id: string) {
      const img = mockState.images.find(i => i.id === id);
      if (img) img.is_deleted = true;
      return { message: 'Gelöscht' };
    },
    async users() {
      await delay();
      return {
        users: [
          { id: 'user-001', email: 'admin@example.com', role: 'admin', image_count: 8, created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
          { id: 'user-002', email: 'max@example.com',   role: 'user',  image_count: 3, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
          { id: 'user-003', email: 'anna@example.com',  role: 'user',  image_count: 1, created_at: new Date(Date.now() - 86400000).toISOString() },
        ],
      };
    },
    async stats() {
      await delay(50);
      return {
        total_images: mockState.images.filter(i => !i.is_deleted).length,
        total_users: 3,
        total_likes: mockState.images.reduce((s, i) => s + i.like_count, 0),
      };
    },
    async uploadCss(_file: File) {
      await delay(400);
      console.info('[Mock] CSS Upload (nicht gespeichert)');
      return { message: 'CSS hochgeladen (Mock)' };
    },
  },
};

// ── Öffentliche API – wählt automatisch Mock oder Echt ───────────────────────

export const api = USE_MOCK ? mock : {
  auth: {
    requestLink: (email: string, accessCode?: string) =>
      request('/auth/request-link', { method: 'POST', body: JSON.stringify({ email, accessCode }) }),

    verify: (token: string): Promise<{ token: string; user: { id: string; email: string; role: string } }> =>
      request('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }),

    me: (): Promise<{ id: string; email: string; role: string }> =>
      request('/auth/me'),
  },

  images: {
    list: (params: { page?: number; limit?: number; sort?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ images: any[]; pagination: any }>(`/images?${q}`);
    },
    top: () => request<{ images: any[] }>('/images/top'),
    get: (id: string) => request<any>(`/images/${id}`),
    upload: async (file: File, onProgress?: (pct: number) => void): Promise<any> => {
      const token = getToken();
      const formData = new FormData();
      formData.append('image', file);
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/images/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });
    },
    delete: (id: string) => request(`/images/${id}`, { method: 'DELETE' }),
  },

  likes: {
    like: (imageId: string) =>
      request<{ liked: boolean; like_count: number }>(`/images/${imageId}/like`, { method: 'POST' }),
    unlike: (imageId: string) =>
      request<{ liked: boolean; like_count: number }>(`/images/${imageId}/like`, { method: 'DELETE' }),
  },

  config: {
    get: () => request<any>('/config'),
    update: (data: any) => request('/config', { method: 'PUT', body: JSON.stringify(data) }),
  },

  admin: {
    images: (params?: any) => {
      const q = params ? new URLSearchParams(params).toString() : '';
      return request<{ images: any[]; pagination: any }>(`/admin/images?${q}`);
    },
    flagImage: (id: string, flagged: boolean) =>
      request(`/admin/images/${id}/flag`, { method: 'PUT', body: JSON.stringify({ flagged }) }),
    deleteImage: (id: string) => request(`/admin/images/${id}`, { method: 'DELETE' }),
    users: () => request<{ users: any[] }>('/admin/users'),
    stats: () => request<any>('/admin/stats'),
    uploadCss: async (file: File): Promise<any> => {
      const token = getToken();
      const formData = new FormData();
      formData.append('css', file);
      const res = await fetch(`${BASE}/admin/css`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('CSS upload failed');
      return res.json();
    },
  },
};
