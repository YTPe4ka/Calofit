export interface StorageUploadResult {
  storageKey: string;
}

export abstract class StorageProvider {
  abstract upload(
    buffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<StorageUploadResult>;
  abstract getSignedUrl(
    storageKey: string,
    expiresIn?: number,
  ): Promise<string>;
  abstract delete(storageKey: string): Promise<void>;
}
