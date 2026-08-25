import { Inject, Injectable } from '@nestjs/common';
import {
  StorageProvider,
  StorageUploadResult,
} from './interfaces/storage-provider.interface';

@Injectable()
export class StorageService {
  constructor(@Inject('STORAGE_PROVIDER') private provider: StorageProvider) {}

  upload(
    buffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<StorageUploadResult> {
    return this.provider.upload(buffer, mimeType, userId);
  }

  getSignedUrl(storageKey: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(storageKey, expiresIn);
  }

  delete(storageKey: string): Promise<void> {
    return this.provider.delete(storageKey);
  }
}
