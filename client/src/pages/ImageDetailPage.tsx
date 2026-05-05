import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Heart, ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Image } from '../types';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './ImageDetailPage.module.css';

export function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { config } = useConfigStore();
  const [image, setImage] = useState<Image | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.images.get(id).then(data => {
      setImage(data);
      setLiked(data.user_liked);
      setLikeCount(Number(data.like_count));
      setLoading(false);
    }).catch(() => { toast.error('Bild nicht gefunden'); navigate('/gallery'); });
  }, [id]);

  const handleLike = async () => {
    if (!user) { toast.error('Bitte anmelden zum Liken'); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      const result = newLiked
        ? await api.likes.like(image!.id)
        : await api.likes.unlike(image!.id);
      setLikeCount(result.like_count);
    } catch (err: any) {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? c - 1 : c + 1);
      toast.error(err.message);
    }
  };

  const handleDownload = async () => {
    if (!image) return;
    const url = image.download_url || image.url;
    const a = document.createElement('a');
    a.href = url;
    a.download = image.original_filename || image.filename;
    a.click();
  };

  const handleDelete = async () => {
    if (!image || !confirm('Bild wirklich löschen?')) return;
    try {
      await api.images.delete(image.id);
      toast.success('Bild gelöscht');
      navigate('/gallery');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`skeleton ${styles.skeleton}`} />
      </div>
    );
  }

  if (!image) return null;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ArrowLeft size={18} />
          Zurück
        </button>
        <div className={styles.actions}>
          {config.features.likesEnabled && (
            <button onClick={handleLike} className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}>
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
              <span>{likeCount}</span>
            </button>
          )}
          <button onClick={handleDownload} className={styles.actionBtn}>
            <Download size={18} />
            <span className={styles.actionBtnText}>Download</span>
          </button>
          {user?.role === 'admin' && (
            <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.dangerBtn}`}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className={styles.imageContainer}>
        <img
          src={image.url}
          alt={image.original_filename || image.filename}
          className={styles.image}
        />
      </div>

      <div className={styles.meta}>
        <p className={styles.filename}>{image.original_filename || image.filename}</p>
        <p className={styles.metaText}>
          {image.size_bytes ? `${(image.size_bytes / 1024 / 1024).toFixed(1)} MB · ` : ''}
          {new Date(image.created_at).toLocaleDateString('de-DE', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
