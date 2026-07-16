import * as Minio from 'minio';
import { logger } from '../utils/logger';

export const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'pixelvault',
  secretKey: process.env.MINIO_SECRET_KEY || 'changeme',
});

export const BUCKET = process.env.MINIO_BUCKET || 'images';

export async function waitForMinio(): Promise<void> {
  const MAX = 30;
  for (let i = 1; i <= MAX; i++) {
    try {
      await minioClient.listBuckets();
      logger.info('✅ MinIO connected');
      return;
    } catch {
      logger.info(`MinIO not ready (attempt ${i}/${MAX}) – retrying in 2s…`);
      await sleep(2000);
    }
  }
  throw new Error('MinIO did not become ready in time');
}

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    logger.info(`✅ Created bucket: ${BUCKET}`);
  } else {
    logger.info(`✅ Bucket ready: ${BUCKET}`);
  }
}

export async function getSignedUrl(objectPath: string, expiry = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, objectPath, expiry);
}

export async function deleteObject(objectPath: string): Promise<void> {
  await minioClient.removeObject(BUCKET, objectPath);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
