import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Grid, Upload, Settings, LogIn, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store/config';
import styles from './Layout.module.css';

export function Layout() {
  const { user, logout } = useAuthStore();
  const { config } = useConfigStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <NavLink to="/" className={styles.logo}>
          <span className={styles.logoIcon}>📸</span>
          <span className={styles.logoText}>{config.branding.title}</span>
        </NavLink>

        <div className={styles.navLinks}>
          <NavLink to="/" end className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Home size={18} />
            <span>Start</span>
          </NavLink>
          <NavLink to="/gallery" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Grid size={18} />
            <span>Galerie</span>
          </NavLink>
          {user && (
            <NavLink to="/upload" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              <Upload size={18} />
              <span>Upload</span>
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              <Settings size={18} />
              <span>Admin</span>
            </NavLink>
          )}
        </div>

        <div className={styles.navActions}>
          {user ? (
            <button onClick={handleLogout} className={styles.authBtn} title={`Abmelden (${user.email})`}>
              <LogOut size={18} />
              <span className={styles.authBtnText}>Abmelden</span>
            </button>
          ) : (
            <NavLink to="/auth" className={styles.authBtn}>
              <LogIn size={18} />
              <span className={styles.authBtnText}>Anmelden</span>
            </NavLink>
          )}
        </div>
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
