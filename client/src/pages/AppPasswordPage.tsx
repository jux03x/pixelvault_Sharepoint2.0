import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './AppPasswordPage.module.css';

interface AppPasswordPageProps {
  onUnlocked: () => void;
}

export function AppPasswordPage({
  onUnlocked,
}: AppPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { config } = useConfigStore();
  const navigate = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) return;

    setLoading(true);

    try {
      await api.appPassword.unlock(password);

      toast.success('App entsperrt');

      onUnlocked();
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Falsches App-Passwort');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }; // <-- diese Klammer hat gefehlt

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.logo}>📸</div>

        <h1 className={styles.title}>
          {config.branding.title}
        </h1>

        <p className={styles.subtitle}>
          App gesperrt
        </p>

        <form
          onSubmit={handle}
          className={styles.form}
        >
          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="app-password"
            >
              App-Passwort
            </label>

            <input
              id="app-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
              autoFocus
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className={styles.btnPrimary}
          >
            {loading
              ? 'Wird überprüft…'
              : 'App entsperren'}
          </button>
        </form>

        <div className={styles.info}>
          <p>
            Zum Zugriff auf diese Anwendung ist das
            App-Passwort erforderlich.
          </p>
        </div>

      </div>
    </div>
  );
}