import net from 'net';
import { db } from '../config/database';
import { logger } from '../utils/logger';
import { minioClient, BUCKET } from '../config/storage';

const CLAMAV_HOST = process.env.CLAMAV_HOST || 'clamav';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310');

// Waits until ClamAV accepts connections (virus DB may take minutes to load)
export async function waitForClamAV(): Promise<void> {
  const MAX = 60; // up to 2 minutes – ClamAV loads virus definitions on first start
  for (let i = 1; i <= MAX; i++) {
    const ok = await pingClamAV();
    if (ok) {
      logger.info('✅ ClamAV ready');
      return;
    }
    logger.info(`ClamAV not ready (attempt ${i}/${MAX}) – retrying in 3s…`);
    await sleep(3000);
  }
  // Non-fatal: continue without ClamAV, mark all uploads as 'error'
  logger.warn('⚠️  ClamAV did not become ready – uploads will be marked scan_status=error');
}

function pingClamAV(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.write('PING\n');
    });
    socket.on('data', (data) => {
      resolve(data.toString().includes('PONG'));
      socket.destroy();
    });
    socket.on('error', () => { resolve(false); socket.destroy(); });
    socket.on('timeout', () => { resolve(false); socket.destroy(); });
  });
}

export async function scanBuffer(buffer: Buffer, imageId: string): Promise<void> {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
      socket.setTimeout(30000);

      socket.on('connect', () => {
        const sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32BE(buffer.length, 0);
        const zeroBuf = Buffer.alloc(4);

        socket.write('zINSTREAM\0');
        socket.write(sizeBuf);
        socket.write(buffer);
        socket.write(zeroBuf);
      });

      let data = '';
      socket.on('data', (chunk) => { data += chunk.toString(); });
      socket.on('end', () => resolve(data));
      socket.on('error', reject);
      socket.on('timeout', () => reject(new Error('ClamAV timeout')));
    });

    if (result.includes('FOUND')) {
      logger.warn(`🦠 Infected file detected: ${imageId} – deleting`);
      const row = await db.query('SELECT storage_path, thumbnail_path FROM images WHERE id=$1', [imageId]);
      if (row.rows[0]) {
        await Promise.allSettled([
          minioClient.removeObjects(BUCKET, row.rows[0].storage_path),
          row.rows[0].thumbnail_path ? minioClient.removeObjects(BUCKET, row.rows[0].thumbnail_path) : Promise.resolve(),
        ]);
      }
      await db.query(
        "UPDATE images SET scan_status='infected', is_flagged=TRUE, is_deleted=TRUE WHERE id=$1",
        [imageId]
      );
    } else {
      await db.query("UPDATE images SET scan_status='clean' WHERE id=$1", [imageId]);
    }
  } catch (err) {
    logger.error(`ClamAV scan error for ${imageId}`, err);
    await db.query("UPDATE images SET scan_status='error' WHERE id=$1", [imageId]);
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
