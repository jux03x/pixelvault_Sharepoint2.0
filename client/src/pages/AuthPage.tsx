import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { config } = useConfigStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.auth.requestLink(email, accessCode || undefined);
      setSent(true);
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
        <p className={styles.subtitle}>Anmelden ohne Passwort</p>

        {sent ? (
          <div className={styles.successMsg}>
            <div className={styles.successIcon}>✉️</div>
            <h2>Prüfe deine E-Mails!</h2>
            <p>
              Wir haben einen Login-Link an <strong>{email}</strong> gesendet.
              Der Link ist 15 Minuten gültig.
            </p>
            <button onClick={() => setSent(false)} className={styles.btnLink}>
              Anderen Link anfordern
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">E-Mail Adresse</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
                className={styles.input}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className={styles.btnPrimary}
            >
              {loading ? 'Wird gesendet…' : 'Magic Link senden'}
            </button>

            <p className={styles.hint}>
              Du erhältst eine E-Mail mit einem Login-Link. Kein Passwort nötig!
            </p>
          </form>
        )}

        <div className={styles.footer}>
          <Link to="/" className={styles.backLink}>← Zurück zur Startseite</Link>
        </div>
      </div>
    </div>
  );
}
