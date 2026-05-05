export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Image {
  id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  is_flagged: boolean;
  scan_status: 'pending' | 'clean' | 'infected' | 'error';
  like_count: number;
  user_liked: boolean;
  url: string;
  thumbnail_url: string | null;
  download_url?: string;
  uploader_email?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AppConfig {
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    font: string;
  };
  branding: {
    title: string;
    description: string;
  };
  features: {
    likesEnabled: boolean;
    uploadEnabled: boolean;
    registrationEnabled: boolean;
  };
}
