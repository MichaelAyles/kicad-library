import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET() {
  try {
    // Check if all required env vars are present
    const requiredVars = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_URL',
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      return NextResponse.json({
        connected: false,
        error: `Missing environment variables: ${missing.join(', ')}`,
      });
    }

    // Try to connect to R2
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // List objects (just to test connection)
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      MaxKeys: 1,
    });

    const response = await r2Client.send(command);

    return NextResponse.json({
      connected: true,
      bucket: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
      objectCount: response.KeyCount ?? 0,
    });
  } catch (error) {
    console.error('R2 connection test failed:', error);
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
