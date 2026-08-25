import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageProvider,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly logger = new Logger(LocalStorageProvider.name);

  constructor(private config: ConfigService) {
    super();
    // Resolve frontend public uploads directory
    this.uploadDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'frontend',
      'public',
      'uploads',
    );

    // Fallback base url (frontend dev server)
    const corsOrigins = this.config.get<string>(
      'CORS_ORIGINS',
      'http://localhost:3001',
    );
    this.baseUrl = corsOrigins.split(',')[0];

    const storageProvider = this.config.get<string>(
      'STORAGE_PROVIDER',
      'supabase',
    );
    if (storageProvider === 'local') {
      try {
        if (!fs.existsSync(this.uploadDir)) {
          fs.mkdirSync(this.uploadDir, { recursive: true });
          this.logger.log(`Created local upload directory: ${this.uploadDir}`);
        }
      } catch (err) {
        this.logger.error('Failed to create local upload directory', err);
      }
    }
  }

  async upload(
    buffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<StorageUploadResult> {
    const ext = mimeType.split('/')[1] || 'jpg';
    const filename = `${userId}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    try {
      await fs.promises.writeFile(filePath, buffer);
      this.logger.log(`Locally uploaded file: ${filename}`);
      return { storageKey: filename };
    } catch (err) {
      this.logger.error('Local upload failed', err);
      throw new Error('LOCAL_UPLOAD_FAILED');
    }
  }

  async getSignedUrl(storageKey: string, expiresIn?: number): Promise<string> {
    // Simply return the static frontend public url
    return `${this.baseUrl}/uploads/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storageKey);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted local file: ${storageKey}`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete local file: ${storageKey}`, err);
    }
  }
}
