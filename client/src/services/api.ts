const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('pv_token');
}

function headers(extra?: Record<string, string>) {
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
    headers: { ...headers(), ...(options?.headers || {}) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  auth: {
    requestLink: (email: string, accessCode?: string) =>
      request('/auth/request-link', {
        method: 'POST',
        body: JSON.stringify({ email, accessCode }),
      }),

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
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Upload failed'));
          }
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
