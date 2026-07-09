import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [mockToken, setMockToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { config } = useConfigStore();
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const result: any = await api.auth.requestLink(email);
      // Im Mock-Modus gibt requestLink den Token direkt zurück
      if (IS_MOCK && result?.message) {
        setMockToken(result.message);
      }
      setSent(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Im Mock: Ein-Klick-Login mit dem angezeigten Token
  const handleMockLogin = async () => {
    const token = tokenInput || mockToken;
    if (!token) return;
    setVerifying(true);
    try {
      const { token: jwt, user } = await api.auth.verify(token);
      setAuth(jwt, user as any);
      toast.success(`Eingeloggt als ${user.email}`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>📸</div>
        <h1 className={styles.title}>{config.branding.title}</h1>
        <p className={styles.subtitle}>Anmelden ohne Passwort</p>

        {IS_MOCK && (
          <div className={styles.mockBanner}>
            🧪 Demo-Modus – keine echte E-Mail nötig
          </div>
        )}

        {sent ? (
          <div className={styles.successMsg}>
            {IS_MOCK ? (
              // Mock: Token direkt in der UI eingebbar
              <>
                <div className={styles.successIcon}>🔑</div>
                <h2>Demo-Login</h2>
                <p>Dein Einmal-Token:</p>

                <div className={styles.mockTokenBox} onClick={() => setTokenInput(mockToken)}>
                  <code className={styles.mockToken}>{mockToken}</code>
                  <span className={styles.mockTokenHint}>klicken zum Übernehmen</span>
                </div>

                <div className={styles.field} style={{ width: '100%', marginTop: '12px' }}>
                  <input
                    className={styles.input}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Token hier einfügen…"
                  />
                </div>

                <button
                  onClick={handleMockLogin}
                  disabled={verifying || !tokenInput}
                  className={styles.btnPrimary}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {verifying ? 'Wird geprüft…' : 'Einloggen'}
                </button>

                <button onClick={() => { setSent(false); setTokenInput(''); }} className={styles.btnLink}>
                  Zurück
                </button>
              </>
            ) : (
              // Echter Modus: E-Mail-Hinweis
              <>
                <div className={styles.successIcon}>✉️</div>
                <h2>Prüfe deine E-Mails!</h2>
                <p>
                  Wir haben einen Login-Link an <strong>{email}</strong> gesendet.
                  Der Link ist 15 Minuten gültig.
                </p>
                <button onClick={() => setSent(false)} className={styles.btnLink}>
                  Anderen Link anfordern
                </button>
              </>
            )}
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
              {loading ? 'Wird gesendet…' : IS_MOCK ? 'Demo-Token generieren' : 'Magic Link senden'}
            </button>

            <p className={styles.hint}>
              {IS_MOCK
                ? 'Im Demo-Modus bekommst du einen Token direkt angezeigt – keine E-Mail nötig.'
                : 'Du erhältst eine E-Mail mit einem Login-Link. Kein Passwort nötig!'}
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
