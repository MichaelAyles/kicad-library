import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const bucketName = process.env.R2_BUCKET_NAME!;

/**
 * Upload a thumbnail to R2
 */
export async function uploadThumbnail(
  circuitId: string,
  theme: 'light' | 'dark',
  imageBuffer: Buffer,
  contentType: string = 'image/png'
): Promise<string> {
  const key = `thumbnails/${circuitId}-${theme}.png`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: imageBuffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await r2Client.send(command);

  // Return the public URL
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return publicUrl;
}

/**
 * Check if a thumbnail exists in R2
 */
export async function thumbnailExists(circuitId: string, theme: 'light' | 'dark'): Promise<boolean> {
  const key = `thumbnails/${circuitId}-${theme}.png`;

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the public URL for a thumbnail
 */
export function getThumbnailUrl(circuitId: string, theme: 'light' | 'dark'): string {
  return `${process.env.R2_PUBLIC_URL}/thumbnails/${circuitId}-${theme}.png`;
}
