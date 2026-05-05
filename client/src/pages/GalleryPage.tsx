import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Image, Pagination } from '../types';
import { ImageCard } from '../components/ImageCard';
import styles from './GalleryPage.module.css';

export function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [images, setImages] = useState<Image[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const sort = searchParams.get('sort') || 'newest';
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadImages = useCallback(async (pageNum: number, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await api.images.list({ page: pageNum, limit: 24, sort });
      setImages(prev => reset ? data.images : [...prev, ...data.images]);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [sort, loading]);

  useEffect(() => {
    setImages([]);
    setPage(1);
    loadImages(1, true);
  }, [sort]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && pagination && page < pagination.pages && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadImages(nextPage);
        }
      },
      { rootMargin: '200px' }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [pagination, page, loading, loadImages]);

  const handleLikeChange = (id: string, liked: boolean, count: number) => {
    setImages(imgs => imgs.map(img => img.id === id ? { ...img, user_liked: liked, like_count: count } : img));
  };

  const handleSortChange = (newSort: string) => {
    setSearchParams({ sort: newSort });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Galerie</h1>
        <div className={styles.sortBtns}>
          <button
            className={`${styles.sortBtn} ${sort === 'newest' ? styles.active : ''}`}
            onClick={() => handleSortChange('newest')}
          >
            Neueste
          </button>
          <button
            className={`${styles.sortBtn} ${sort === 'likes' ? styles.active : ''}`}
            onClick={() => handleSortChange('likes')}
          >
            Beliebteste
          </button>
        </div>
      </div>

      {images.length === 0 && !loading ? (
        <div className={styles.empty}>
          <p>Noch keine Bilder vorhanden.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {images.map(img => (
            <ImageCard key={img.id} image={img} onLikeChange={handleLikeChange} />
          ))}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={`sk-${i}`} className={`skeleton ${styles.skeletonCard}`} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {pagination && (
        <p className={styles.count}>
          {images.length} von {pagination.total} Bildern
        </p>
      )}
    </div>
  );
}
