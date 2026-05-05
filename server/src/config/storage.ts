import * as Minio from 'minio';
import { logger } from '../utils/logger';

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'pixelvault',
  secretKey: process.env.MINIO_SECRET_KEY || 'pixelvault123',
});

export const BUCKET = process.env.MINIO_BUCKET || 'images';

export async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET);
      logger.info(`✅ Created bucket: ${BUCKET}`);
    } else {
      logger.info(`✅ Storage bucket ready`);
    }
  } catch (err) {
    logger.error('❌ MinIO bucket setup failed', err);
  }
}

export async function getSignedUrl(objectPath: string, expiry = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, objectPath, expiry);
}

export async function deleteObject(objectPath: string): Promise<void> {
  await minioClient.removeObject(BUCKET, objectPath);
}
