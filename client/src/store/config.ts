import { create } from 'zustand';
import { AppConfig } from '../types';
import { api } from '../services/api';

const DEFAULT_CONFIG: AppConfig = {
  theme: {
    primaryColor: '#0a0a0a',
    accentColor: '#007AFF',
    backgroundColor: '#fafafa',
    font: "'DM Sans', sans-serif",
  },
  branding: {
    title: 'PixelVault',
    description: 'Share your moments beautifully',
  },
  features: {
    likesEnabled: true,
    uploadEnabled: true,
    registrationEnabled: true,
  },
};

interface ConfigState {
  config: AppConfig;
  loading: boolean;
  loadConfig: () => Promise<void>;
  applyConfig: (config: AppConfig) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: DEFAULT_CONFIG,
  loading: true,

  loadConfig: async () => {
    try {
      const data = await api.config.get();
      const config = { ...DEFAULT_CONFIG, ...data };
      set({ config, loading: false });

      // Apply CSS variables
      const root = document.documentElement;
      if (config.theme?.accentColor) {
        root.style.setProperty('--color-accent', config.theme.accentColor);
      }
      if (config.theme?.backgroundColor) {
        root.style.setProperty('--color-bg', config.theme.backgroundColor);
      }
      if (config.branding?.title) {
        document.title = config.branding.title;
      }
    } catch {
      set({ loading: false });
    }
  },

  applyConfig: (config) => {
    set({ config });
    const root = document.documentElement;
    if (config.theme?.accentColor) root.style.setProperty('--color-accent', config.theme.accentColor);
    if (config.theme?.backgroundColor) root.style.setProperty('--color-bg', config.theme.backgroundColor);
    if (config.branding?.title) document.title = config.branding.title;
  },
}));
