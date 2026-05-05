import { db } from '../config/database';
import { deleteObject } from '../config/storage';
import { logger } from '../utils/logger';

export async function scanFile(buffer: Buffer, imageId: string): Promise<void> {
  try {
    const net = await import('net');

    const result = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection(
        { host: process.env.CLAMAV_HOST || 'clamav', port: parseInt(process.env.CLAMAV_PORT || '3310') },
        () => {
          const sizeBuffer = Buffer.alloc(4);
          sizeBuffer.writeUInt32BE(buffer.length, 0);

          client.write('zINSTREAM\0');
          client.write(sizeBuffer);
          client.write(buffer);

          const zeroBuffer = Buffer.alloc(4);
          zeroBuffer.writeUInt32BE(0, 0);
          client.write(zeroBuffer);
        }
      );

      let data = '';
      client.on('data', (chunk) => { data += chunk.toString(); });
      client.on('end', () => resolve(data));
      client.on('error', reject);

      setTimeout(() => { client.destroy(); reject(new Error('ClamAV timeout')); }, 30000);
    });

    const infected = result.includes('FOUND');

    if (infected) {
      logger.warn(`🦠 Infected file detected: ${imageId}`);
      const imgResult = await db.query('SELECT storage_path, thumbnail_path FROM images WHERE id = $1', [imageId]);
      if (imgResult.rows.length > 0) {
        const { storage_path, thumbnail_path } = imgResult.rows[0];
        await Promise.allSettled([
          deleteObject(storage_path),
          thumbnail_path ? deleteObject(thumbnail_path) : Promise.resolve(),
        ]);
      }
      await db.query(
        "UPDATE images SET scan_status = 'infected', is_flagged = TRUE, is_deleted = TRUE WHERE id = $1",
        [imageId]
      );
    } else {
      await db.query("UPDATE images SET scan_status = 'clean' WHERE id = $1", [imageId]);
      logger.info(`✅ File scan clean: ${imageId}`);
    }
  } catch (err) {
    logger.error(`ClamAV scan error for ${imageId}:`, err);
    await db.query("UPDATE images SET scan_status = 'error' WHERE id = $1", [imageId]);
  }
}
