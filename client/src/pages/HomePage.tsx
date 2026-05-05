import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Upload } from 'lucide-react';
import { api } from '../services/api';
import { Image } from '../types';
import { ImageCard } from '../components/ImageCard';
import { useConfigStore } from '../store/config';
import { useAuthStore } from '../store/auth';
import styles from './HomePage.module.css';

export function HomePage() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const { config } = useConfigStore();
  const { user } = useAuthStore();

  useEffect(() => {
    api.images.top().then(data => {
      setImages(data.images);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleLikeChange = (id: string, liked: boolean, count: number) => {
    setImages(imgs => imgs.map(img => img.id === id ? { ...img, user_liked: liked, like_count: count } : img));
  };

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{config.branding.title}</h1>
          <p className={styles.heroDesc}>{config.branding.description}</p>
          <div className={styles.heroCtas}>
            {user ? (
              <Link to="/upload" className={styles.ctaPrimary}>
                <Upload size={18} />
                Bild hochladen
              </Link>
            ) : (
              <Link to="/auth" className={styles.ctaPrimary}>Jetzt anmelden</Link>
            )}
            <Link to="/gallery" className={styles.ctaSecondary}>
              Galerie ansehen
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Top Images */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🏆 Beliebteste Bilder</h2>
          <Link to="/gallery?sort=likes" className={styles.sectionLink}>
            Alle ansehen <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`skeleton ${styles.skeletonCard}`} />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            <p>Noch keine Bilder – sei der Erste!</p>
            {user && (
              <Link to="/upload" className={styles.ctaPrimary} style={{ marginTop: '16px' }}>
                Erstes Bild hochladen
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map(img => (
              <ImageCard key={img.id} image={img} onLikeChange={handleLikeChange} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
