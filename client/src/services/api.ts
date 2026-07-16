const BASE = '/api';

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

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    me: () => request<any>('/auth/me'),
  },

  images: {
    list: (params: { page?: number; limit?: number; sort?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ images: any[]; pagination: any }>(`/images?${q}`);
    },
    top: () => request<{ images: any[] }>('/images/top'),
    get: (id: string) => request<any>(`/images/${id}`),
    upload: (file: File, onProgress?: (pct: number) => void): Promise<any> =>
      new Promise((resolve, reject) => {
        const token = getToken();
        const fd = new FormData();
        fd.append('image', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/images/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      }),
    delete: (id: string) => request(`/images/${id}`, { method: 'DELETE' }),
  },

  likes: {
    like:   (id: string) => request<{ liked: boolean; like_count: number }>(`/images/${id}/like`, { method: 'POST' }),
    unlike: (id: string) => request<{ liked: boolean; like_count: number }>(`/images/${id}/like`, { method: 'DELETE' }),
  },

  config: {
    get:    () => request<any>('/config'),
    update: (data: any) => request('/config', { method: 'PUT', body: JSON.stringify(data) }),
  },

  admin: {
    stats:   () => request<any>('/admin/stats'),
    images:  (p?: any) => request<any>(`/admin/images?${new URLSearchParams(p || {})}`),
    flagImage:   (id: string, flagged: boolean) =>
      request(`/admin/images/${id}/flag`, { method: 'PUT', body: JSON.stringify({ flagged }) }),
    deleteImage: (id: string) => request(`/admin/images/${id}`, { method: 'DELETE' }),
    users:       () => request<{ users: any[] }>('/admin/users'),
    createUser:  (email: string, password: string, role = 'user') =>
      request('/admin/users', { method: 'POST', body: JSON.stringify({ email, password, role }) }),
    deleteUser:  (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    uploadCss: (file: File): Promise<any> => {
      const token = getToken();
      const fd = new FormData(); fd.append('css', file);
      return fetch(`${BASE}/admin/css`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      }).then(r => r.json());
    },
  },
};
