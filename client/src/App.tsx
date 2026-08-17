import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useConfigStore } from './store/config';
import { AppPasswordPage } from './pages/AppPasswordPage';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { UploadPage } from './pages/UploadPage';
import { ImageDetailPage } from './pages/ImageDetailPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { RegisterPage } from './pages/RegisterPage';
import { api } from './services/api';


function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) return null;

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}


function AuthenticatedApp() {
  const { initialize } = useAuthStore();
  const { loadConfig } = useConfigStore();

  useEffect(() => {
    initialize();
    loadConfig();
  }, [initialize, loadConfig]);

  return (
    <Routes>
      <Route
        path="/auth"
        element={<AuthPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="/"
        element={<Layout />}
      >
        <Route
          index
          element={<HomePage />}
        />

        <Route
          path="gallery"
          element={<GalleryPage />}
        />

        <Route
          path="upload"
          element={<UploadPage />}
        />

        <Route
          path="image/:id"
          element={<ImageDetailPage />}
        />

        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}


export default function App() {
  const [appUnlocked, setAppUnlocked] =
    useState<boolean | null>(null);

  useEffect(() => {
    checkAppPassword();
  }, []);

  const checkAppPassword = async () => {
    try {
      await api.appPassword.check();

      setAppUnlocked(true);
    } catch {
      setAppUnlocked(false);
    }
  };

  if (appUnlocked === null) {
    return null;
  }

  if (!appUnlocked) {
  return (
    <AppPasswordPage
      onUnlocked={() => setAppUnlocked(true)}
    />
  );
}

  return <AuthenticatedApp />;
}