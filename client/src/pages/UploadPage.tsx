import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import styles from './UploadPage.module.css';
import heic2any from 'heic2any';

interface UploadFile {
  id: string;
  file?: File;
  preview?: string;
  status: 'converting' | 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  imageId?: string;
}

export function UploadPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    // Sofort Skeletons anzeigen
    const placeholders: UploadFile[] = accepted.map(() => ({
      id: crypto.randomUUID(),
      status: 'converting',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...placeholders]);

    accepted.forEach(async (file, index) => {
      const placeholderId = placeholders[index].id;

      try {
        let finalFile = file;

        if (
          file.type === 'image/heic' ||
          file.type === 'image/heif' ||
          file.name.toLowerCase().endsWith('.heic') ||
          file.name.toLowerCase().endsWith('.heif')
        ) {
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          });

          const jpegBlob = Array.isArray(convertedBlob)
            ? convertedBlob[0]
            : convertedBlob;

          finalFile = new File(
            [jpegBlob],
            file.name.replace(/\.(heic|heif)$/i, '.jpg'),
            {
              type: 'image/jpeg',
            }
          );
        }

        setFiles(prev =>
          prev.map(f =>
            f.id === placeholderId
              ? {
                  ...f,
                  file: finalFile,
                  preview: URL.createObjectURL(finalFile),
                  status: 'pending',
                }
              : f
          )
        );
      } catch (err: any) {
        setFiles(prev =>
          prev.map(f =>
            f.id === placeholderId
              ? {
                  ...f,
                  status: 'error',
                  error: err.message || 'HEIC konnte nicht konvertiert werden',
                }
              : f
          )
        );
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic', '.heif'],
    },
    maxSize: 100 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      if (prev[index]?.preview) {
        URL.revokeObjectURL(prev[index].preview!);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadAll = async () => {
    if (!user) {
      toast.error('Bitte anmelden');
      return;
    }

    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending' || !files[i].file) continue;

      setFiles(prev =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      try {
        const result = await api.images.upload(files[i].file!, progress => {
          setFiles(prev =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress } : f
            )
          );
        });

        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'done',
                  progress: 100,
                  imageId: result.id,
                }
              : f
          )
        );

        successCount++;
      } catch (err: any) {
        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error',
                  error: err.message,
                }
              : f
          )
        );
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(
        `${successCount} Bild${successCount > 1 ? 'er' : ''} hochgeladen!`
      );
      setTimeout(() => navigate('/gallery'), 1500);
    }
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.authPrompt}>
          <ImageIcon size={48} />
          <h2>Anmeldung erforderlich</h2>
          <p>Um Bilder hochzuladen, musst du angemeldet sein.</p>
          <button
            onClick={() => navigate('/auth')}
            className={styles.btnPrimary}
          >
            Jetzt anmelden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Bilder hochladen</h1>
        <p className={styles.subtitle}>
          JPG, PNG, WEBP oder HEIC – bis zu 100 MB pro Datei
        </p>

        <div
          {...getRootProps()}
          className={`${styles.dropzone} ${
            isDragActive ? styles.dragActive : ''
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={40} className={styles.dropzoneIcon} />
          <p className={styles.dropzoneText}>
            {isDragActive
              ? 'Loslassen zum Hochladen'
              : 'Bilder hier ablegen oder klicken zum Auswählen'}
          </p>
          <p className={styles.dropzoneHint}>
            Unterstützte Formate: JPG, PNG, WEBP, HEIC
          </p>
        </div>

        {files.length > 0 && (
          <>
            <div className={styles.fileList}>
              {files.map((file, index) => (
                <div key={file.id} className={styles.fileItem}>
                  {file.status === 'converting' ? (
                    <div className={styles.skeletonPreview} />
                  ) : (
                    <img
                      src={file.preview}
                      alt=""
                      className={styles.filePreview}
                    />
                  )}

                  <div className={styles.fileInfo}>
                    {file.status === 'converting' ? (
                      <>
                        <div className={styles.skeletonLine} />
                        <div className={styles.skeletonLineShort} />
                        <span className={styles.convertingText}>
                          HEIC wird konvertiert…
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.fileName}>
                          {file.file?.name}
                        </span>
                        <span className={styles.fileSize}>
                          {file.file
                            ? `${(file.file.size / 1024 / 1024).toFixed(1)} MB`
                            : ''}
                        </span>

                        {file.status === 'uploading' && (
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}

                        {file.status === 'error' && (
                          <span className={styles.fileError}>
                            {file.error}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className={styles.fileStatus}>
                    {file.status === 'done' && (
                      <CheckCircle
                        size={20}
                        color="var(--color-success)"
                      />
                    )}

                    {file.status === 'error' && (
                      <AlertCircle
                        size={20}
                        color="var(--color-danger)"
                      />
                    )}

                    {(file.status === 'pending' ||
                      file.status === 'converting') && (
                      <button
                        onClick={() => removeFile(index)}
                        className={styles.removeBtn}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              <button
                onClick={uploadAll}
                disabled={
                  uploading ||
                  files.some(f => f.status === 'converting') ||
                  files.every(f => f.status === 'done')
                }
                className={styles.btnPrimary}
              >
                {uploading
                  ? 'Wird hochgeladen…'
                  : files.some(f => f.status === 'converting')
                  ? 'Bilder werden vorbereitet…'
                  : `${files.filter(f => f.status === 'pending').length} Bild${
                      files.filter(f => f.status === 'pending').length !== 1
                        ? 'er'
                        : ''
                    } hochladen`}
              </button>

              <button
                onClick={() => setFiles([])}
                disabled={uploading}
                className={styles.btnSecondary}
              >
                Alle entfernen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
