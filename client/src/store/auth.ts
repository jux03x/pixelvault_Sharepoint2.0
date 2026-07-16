import { create } from 'zustand';
import { api } from '../services/api';

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('pv_token'),
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem('pv_token', token);
    set({ token, user, loading: false });
  },

  logout: () => {
    localStorage.removeItem('pv_token');
    set({ token: null, user: null });
  },

  initialize: async () => {
    const token = localStorage.getItem('pv_token');
    if (!token) { set({ loading: false }); return; }
    try {
      const user = await api.auth.me();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('pv_token');
      set({ token: null, user: null, loading: false });
    }
  },
}));
