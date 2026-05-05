import { useEffect, useState } from 'react';
import { Trash2, Flag, Users, Image as ImageIcon, Heart, Settings, Palette, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './AdminPage.module.css';

type Tab = 'dashboard' | 'images' | 'users' | 'design';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { config, applyConfig } = useConfigStore();

  // Design state
  const [accentColor, setAccentColor] = useState(config.theme?.accentColor || '#007AFF');
  const [bgColor, setBgColor] = useState(config.theme?.backgroundColor || '#fafafa');
  const [title, setTitle] = useState(config.branding?.title || 'PixelVault');
  const [description, setDescription] = useState(config.branding?.description || '');
  const [likesEnabled, setLikesEnabled] = useState(config.features?.likesEnabled ?? true);
  const [savingDesign, setSavingDesign] = useState(false);

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'images') {
      setLoading(true);
      api.admin.images().then(d => { setImages(d.images); setLoading(false); }).catch(() => setLoading(false));
    }
    if (tab === 'users') {
      api.admin.users().then(d => setUsers(d.users)).catch(() => {});
    }
  }, [tab]);

  const handleDeleteImage = async (id: string) => {
    if (!confirm('Bild wirklich löschen?')) return;
    try {
      await api.admin.deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
      toast.success('Bild gelöscht');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleFlagImage = async (id: string, flagged: boolean) => {
    try {
      await api.admin.flagImage(id, flagged);
      setImages(prev => prev.map(img => img.id === id ? { ...img, is_flagged: flagged } : img));
      toast.success(flagged ? 'Bild geflaggt' : 'Flag entfernt');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveDesign = async () => {
    setSavingDesign(true);
    try {
      const updated = await api.config.update({
        theme: { accentColor, backgroundColor: bgColor },
        branding: { title, description },
        features: { likesEnabled },
      });
      applyConfig({ ...config, ...updated });
      toast.success('Design gespeichert!');
    } catch (err: any) { toast.error(err.message); }
    setSavingDesign(false);
  };

  const handleCssUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.admin.uploadCss(file);
      toast.success('CSS hochgeladen!');
    } catch (err: any) { toast.error(err.message); }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Settings size={16} /> },
    { id: 'images', label: 'Bilder', icon: <ImageIcon size={16} /> },
    { id: 'users', label: 'Nutzer', icon: <Users size={16} /> },
    { id: 'design', label: 'Design', icon: <Palette size={16} /> },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Admin-Konsole</h1>

        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.activeTab : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div className={styles.tabContent}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <ImageIcon size={24} className={styles.statIcon} />
                <div className={styles.statValue}>{stats?.total_images ?? '–'}</div>
                <div className={styles.statLabel}>Bilder</div>
              </div>
              <div className={styles.statCard}>
                <Users size={24} className={styles.statIcon} />
                <div className={styles.statValue}>{stats?.total_users ?? '–'}</div>
                <div className={styles.statLabel}>Nutzer</div>
              </div>
              <div className={styles.statCard}>
                <Heart size={24} className={styles.statIcon} />
                <div className={styles.statValue}>{stats?.total_likes ?? '–'}</div>
                <div className={styles.statLabel}>Likes</div>
              </div>
            </div>
          </div>
        )}

        {/* Images */}
        {tab === 'images' && (
          <div className={styles.tabContent}>
            {loading ? (
              <div className={styles.loadingGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`skeleton ${styles.skeletonCard}`} />
                ))}
              </div>
            ) : (
              <div className={styles.adminGrid}>
                {images.map(img => (
                  <div key={img.id} className={`${styles.adminCard} ${img.is_flagged ? styles.flagged : ''}`}>
                    <div className={styles.adminCardImg}>
                      <img src={img.thumbnail_url || img.url || ''} alt={img.filename} loading="lazy" />
                      {img.is_flagged && <span className={styles.flagBadge}>Geflaggt</span>}
                      {img.scan_status === 'infected' && <span className={styles.infectedBadge}>Infiziert</span>}
                    </div>
                    <div className={styles.adminCardMeta}>
                      <span className={styles.adminCardName} title={img.original_filename}>
                        {img.original_filename || img.filename}
                      </span>
                      <span className={styles.adminCardInfo}>
                        {img.uploader_email || 'Unbekannt'} · ❤️ {img.like_count}
                      </span>
                    </div>
                    <div className={styles.adminCardActions}>
                      <button
                        onClick={() => handleFlagImage(img.id, !img.is_flagged)}
                        className={`${styles.iconBtn} ${img.is_flagged ? styles.iconBtnActive : ''}`}
                        title={img.is_flagged ? 'Flag entfernen' : 'Flaggen'}
                      >
                        <Flag size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className={styles.tabContent}>
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span>E-Mail</span>
                <span>Rolle</span>
                <span>Bilder</span>
                <span>Registriert</span>
              </div>
              {users.map(user => (
                <div key={user.id} className={styles.tableRow}>
                  <span className={styles.userEmail}>{user.email}</span>
                  <span>
                    <span className={`${styles.roleBadge} ${user.role === 'admin' ? styles.adminBadge : ''}`}>
                      {user.role}
                    </span>
                  </span>
                  <span>{user.image_count}</span>
                  <span className={styles.dateCell}>
                    {new Date(user.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Design */}
        {tab === 'design' && (
          <div className={styles.tabContent}>
            <div className={styles.designGrid}>
              <div className={styles.designSection}>
                <h3 className={styles.sectionTitle}>Branding</h3>
                <div className={styles.field}>
                  <label className={styles.label}>App-Titel</label>
                  <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Beschreibung</label>
                  <input className={styles.input} value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              </div>

              <div className={styles.designSection}>
                <h3 className={styles.sectionTitle}>Farben</h3>
                <div className={styles.colorRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Akzentfarbe</label>
                    <div className={styles.colorInput}>
                      <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className={styles.colorPicker} />
                      <input className={styles.input} value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Hintergrundfarbe</label>
                    <div className={styles.colorInput}>
                      <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className={styles.colorPicker} />
                      <input className={styles.input} value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.designSection}>
                <h3 className={styles.sectionTitle}>Funktionen</h3>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={likesEnabled}
                    onChange={e => setLikesEnabled(e.target.checked)}
                    className={styles.toggleInput}
                  />
                  <span className={styles.toggleSlider} />
                  <span>Like-System aktiviert</span>
                </label>
              </div>

              <div className={styles.designSection}>
                <h3 className={styles.sectionTitle}>Custom CSS</h3>
                <p className={styles.hint}>Eigenes CSS hochladen um das Design anzupassen.</p>
                <label className={styles.fileLabel}>
                  <input type="file" accept=".css" onChange={handleCssUpload} style={{ display: 'none' }} />
                  CSS-Datei auswählen
                </label>
              </div>
            </div>

            <div className={styles.saveRow}>
              <button onClick={handleSaveDesign} disabled={savingDesign} className={styles.btnPrimary}>
                {savingDesign ? <><RefreshCw size={16} className={styles.spin} /> Speichern…</> : 'Design speichern'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
