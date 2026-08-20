// Storage provider stub — not yet implemented.
// To add storage: implement these functions against S3, Cloudinary,
// Supabase Storage, or any other provider. Swap this file only.

export async function uploadFile(
  _bucket: string,
  _path: string,
  _file: Buffer | Blob,
  _contentType?: string
): Promise<string> {
  throw new Error('Storage provider not configured. Implement src/lib/storage/provider.ts');
}

export async function deleteFile(_bucket: string, _path: string): Promise<void> {
  throw new Error('Storage provider not configured. Implement src/lib/storage/provider.ts');
}

export async function getFileUrl(_bucket: string, _path: string): Promise<string> {
  throw new Error('Storage provider not configured. Implement src/lib/storage/provider.ts');
}
