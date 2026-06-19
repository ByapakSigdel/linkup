import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StorageResult {
  storageKey: string;
  storageBucket: string;
  cdnUrl: string;
  filename: string;
}

export interface StorageProvider {
  store(
    file: Express.Multer.File,
    coupleId: string,
    type: string,
  ): Promise<StorageResult>;
  delete(storageKey: string): Promise<void>;
  getUrl(storageKey: string): string;
}

/**
 * Local filesystem storage provider.
 * Files are stored in <projectRoot>/uploads/<coupleId>/<type>/<filename>
 * Served via a static file endpoint at /api/v1/media/files/<storageKey>
 *
 * Designed with a StorageProvider interface so we can swap in S3 later.
 */
@Injectable()
export class StorageService implements StorageProvider {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    // Resolve to <projectRoot>/uploads (two levels up from dist/)
    this.uploadDir = path.resolve(process.cwd(), '..', '..', 'uploads');
    this.baseUrl =
      process.env.API_URL || `http://localhost:${process.env.API_PORT || '4000'}`;

    // Ensure the base upload directory exists
    this.ensureDir(this.uploadDir);
    this.logger.log(`Storage initialized at ${this.uploadDir}`);
  }

  async store(
    file: Express.Multer.File,
    coupleId: string,
    type: string,
  ): Promise<StorageResult> {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filename = `${timestamp}-${hash}${ext}`;
    const storageKey = `${coupleId}/${type}/${filename}`;

    const dirPath = path.join(this.uploadDir, coupleId, type);
    this.ensureDir(dirPath);

    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, file.buffer);

    this.logger.log(
      `Stored file: ${storageKey} (${file.size} bytes, ${file.mimetype})`,
    );

    return {
      storageKey,
      storageBucket: 'local',
      cdnUrl: this.getUrl(storageKey),
      filename,
    };
  }

  /**
   * Store a raw buffer (e.g. decoded base64 canvas/audio data) directly.
   */
  async storeBuffer(
    buffer: Buffer,
    coupleId: string,
    type: string,
    ext: string,
  ): Promise<StorageResult> {
    const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filename = `${timestamp}-${hash}${safeExt}`;
    const storageKey = `${coupleId}/${type}/${filename}`;

    const dirPath = path.join(this.uploadDir, coupleId, type);
    this.ensureDir(dirPath);

    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, buffer);

    this.logger.log(`Stored buffer: ${storageKey} (${buffer.length} bytes)`);

    return {
      storageKey,
      storageBucket: 'local',
      cdnUrl: this.getUrl(storageKey),
      filename,
    };
  }

  /**
   * Decode a data URL (e.g. "data:image/png;base64,...") into a stored file.
   */
  async storeDataUrl(
    dataUrl: string,
    coupleId: string,
    type: string,
  ): Promise<StorageResult> {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new Error('Invalid data URL');
    }
    const mime = match[1]!;
    const buffer = Buffer.from(match[2]!, 'base64');
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/webm': '.webm',
      'audio/wav': '.wav',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
    };
    const ext = extMap[mime] || '.bin';
    return this.storeBuffer(buffer, coupleId, type, ext);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storageKey);
    try {
      await fs.promises.unlink(filePath);
      this.logger.log(`Deleted file: ${storageKey}`);
    } catch (err) {
      // File may already be gone
      this.logger.warn(`Failed to delete file: ${storageKey}`, err);
    }
  }

  getUrl(storageKey: string): string {
    return `${this.baseUrl}/api/v1/media/files/${storageKey}`;
  }

  /**
   * Get the absolute filesystem path for a storage key.
   * Used by the file-serving endpoint.
   */
  getAbsolutePath(storageKey: string): string {
    return path.join(this.uploadDir, storageKey);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
