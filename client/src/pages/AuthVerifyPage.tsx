import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import styles from './AuthVerifyPage.module.css';

export function AuthVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Kein Token in der URL gefunden.');
      return;
    }

    api.auth.verify(token)
      .then(({ token: jwt, user }) => {
        setAuth(jwt, user as any);
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Der Link ist ungültig oder abgelaufen.');
      });
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {status === 'verifying' && (
          <>
            <div className={styles.spinner} />
            <h2>Anmeldung wird überprüft…</h2>
            <p>Einen Moment bitte.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className={styles.icon}>✅</div>
            <h2>Erfolgreich angemeldet!</h2>
            <p>Du wirst weitergeleitet…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className={styles.icon}>❌</div>
            <h2>Anmeldung fehlgeschlagen</h2>
            <p className={styles.errorText}>{error}</p>
            <Link to="/auth" className={styles.btnPrimary}>Neuen Link anfordern</Link>
          </>
        )}
      </div>
    </div>
  );
}
