import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import {
  StorageProvider,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class SupabaseStorageProvider extends StorageProvider {
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private readonly logger = new Logger(SupabaseStorageProvider.name);

  constructor(private config: ConfigService) {
    super();
    this.client = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    this.bucket = config.get<string>('SUPABASE_BUCKET', 'food-images');
  }

  async upload(
    buffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<StorageUploadResult> {
    const ext = mimeType.split('/')[1] || 'jpeg';
    const date = format(new Date(), 'yyyy-MM-dd');
    const uuid = randomUUID();
    const storageKey = `${userId}/${date}/${uuid}.${ext}`;

    try {
      const { error } = await this.client.storage
        .from(this.bucket)
        .upload(storageKey, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        this.logger.warn(`Supabase storage upload notice: ${error.message}`);
      }
    } catch (err: any) {
      this.logger.warn(`Supabase storage exception caught: ${err?.message}`);
    }

    return { storageKey };
  }

  async getSignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .createSignedUrl(storageKey, expiresIn);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {}

    return `${this.config.get<string>('SUPABASE_URL')}/storage/v1/object/public/${this.bucket}/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      this.logger.warn(
        `Storage delete failed for key: ${storageKey}`,
        error.message,
      );
    }
  }
}
