import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Image } from '../types';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store/config';
import toast from 'react-hot-toast';
import styles from './ImageCard.module.css';

interface Props {
  image: Image;
  onLikeChange?: (id: string, liked: boolean, count: number) => void;
}

export function ImageCard({ image, onLikeChange }: Props) {
  const { user } = useAuthStore();
  const { config } = useConfigStore();
  const [liked, setLiked] = useState(image.user_liked);
  const [likeCount, setLikeCount] = useState(Number(image.like_count));
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Bitte anmelden zum Liken');
      return;
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);

    try {
      const result = newLiked
        ? await api.likes.like(image.id)
        : await api.likes.unlike(image.id);
      setLikeCount(result.like_count);
      onLikeChange?.(image.id, result.liked, result.like_count);
    } catch (err: any) {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? c - 1 : c + 1);
      toast.error(err.message);
    }
  };

  return (
    <Link to={`/image/${image.id}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {!imgLoaded && <div className={`skeleton ${styles.imagePlaceholder}`} />}
        <img
          src={image.thumbnail_url || image.url}
          alt={image.original_filename || image.filename}
          className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ''}`}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
        />
      </div>
      {config.features.likesEnabled && (
        <button
          className={`${styles.likeBtn} ${liked ? styles.liked : ''}`}
          onClick={handleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
      )}
    </Link>
  );
}
