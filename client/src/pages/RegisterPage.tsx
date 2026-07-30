import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './RegisterPage.module.css';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { config } = useConfigStore();
  const navigate = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      toast.error('Die Passwörter stimmen nicht überein.');
      return;
    }

    if (password.length < 8) {
      toast.error('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setLoading(true);

    try {
      await api.auth.register(email, password);

      toast.success('Konto erfolgreich erstellt!');
      navigate('/login');
    } catch (err: any) {
      const message = err.message || '';

      if (message.includes('Email already registered')) {
        toast.error('Diese E-Mail-Adresse ist bereits registriert.');
      } else if (message.includes('Registration is closed')) {
        toast.error('Die Registrierung ist derzeit deaktiviert.');
      } else if (message.includes('Password must be at least 8 characters')) {
        toast.error('Das Passwort muss mindestens 8 Zeichen lang sein.');
      } else {
        toast.error(message || 'Registrierung fehlgeschlagen.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>📸</div>

        <h1 className={styles.title}>{config.branding.title}</h1>
        <p className={styles.subtitle}>Neues Konto erstellen</p>

        <form onSubmit={handle} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              className={styles.input}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
              minLength={8}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password || !confirmPassword}
            className={styles.btnPrimary}
          >
            {loading ? 'Konto wird erstellt…' : 'Registrieren'}
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Bereits ein Konto?{' '}
            <Link to="/auth" className={styles.link}>
              Jetzt anmelden
            </Link>
          </p>

          <Link to="/" className={styles.backLink}>
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

