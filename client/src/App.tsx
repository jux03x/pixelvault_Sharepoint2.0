import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useConfigStore } from './store/config';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { UploadPage } from './pages/UploadPage';
import { ImageDetailPage } from './pages/ImageDetailPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { initialize } = useAuthStore();
  const { loadConfig } = useConfigStore();

  useEffect(() => {
    initialize();
    loadConfig();
  }, []);

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="image/:id" element={<ImageDetailPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
