import { NextRequest, NextResponse } from 'next/server';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client
function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const circuitId = searchParams.get('circuitId');

    if (!circuitId) {
      return NextResponse.json({ error: 'Missing circuitId' }, { status: 400 });
    }

    const r2Client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const publicUrl = process.env.R2_PUBLIC_URL!;

    const lightKey = `thumbnails/${circuitId}/light.png`;
    const darkKey = `thumbnails/${circuitId}/dark.png`;

    let lightExists = false;
    let darkExists = false;
    let lightSize = 0;
    let darkSize = 0;

    // Check light thumbnail
    try {
      const lightResponse = await r2Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: lightKey,
        })
      );
      lightExists = true;
      lightSize = lightResponse.ContentLength || 0;
    } catch (err: any) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
        console.error('Error checking light thumbnail:', err);
      }
    }

    // Check dark thumbnail
    try {
      const darkResponse = await r2Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: darkKey,
        })
      );
      darkExists = true;
      darkSize = darkResponse.ContentLength || 0;
    } catch (err: any) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
        console.error('Error checking dark thumbnail:', err);
      }
    }

    return NextResponse.json({
      circuitId,
      hasR2Thumbnails: lightExists && darkExists,
      light: lightExists
        ? {
            exists: true,
            url: `${publicUrl}/${lightKey}`,
            size: lightSize,
          }
        : { exists: false },
      dark: darkExists
        ? {
            exists: true,
            url: `${publicUrl}/${darkKey}`,
            size: darkSize,
          }
        : { exists: false },
    });
  } catch (error) {
    console.error('Check R2 thumbnail failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}
