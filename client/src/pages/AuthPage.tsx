import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { config }              = useConfigStore();
  const { setAuth }             = useAuthStore();
  const navigate                = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { token, user } = await api.auth.login(email, password);
      setAuth(token, user);
      toast.success('Willkommen!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>📸</div>
        <h1 className={styles.title}>{config.branding.title}</h1>
        <p className={styles.subtitle}>Anmelden</p>

        <form onSubmit={handle} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">E-Mail</label>
            <input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              className={styles.input} required autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Passwort</label>
            <input
              id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input} required
            />
          </div>
          <button type="submit" disabled={loading || !email || !password} className={styles.btnPrimary}>
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link to="/" className={styles.backLink}>← Zurück zur Startseite</Link>
        </div>
      </div>
    </div>
  );
}
