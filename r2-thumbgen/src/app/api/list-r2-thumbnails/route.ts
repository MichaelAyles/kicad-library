import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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

export async function GET() {
  try {
    const r2Client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    // Set to track circuit IDs that have both light and dark thumbnails
    const lightThumbnails = new Set<string>();
    const darkThumbnails = new Set<string>();

    let continuationToken: string | undefined;

    // Paginate through all objects in the thumbnails folder
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'thumbnails/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await r2Client.send(command);

      // Parse each key to extract circuit ID and theme
      for (const obj of response.Contents || []) {
        if (!obj.Key) continue;

        // Key format: thumbnails/{circuitId}/light.png or thumbnails/{circuitId}/dark.png
        const match = obj.Key.match(/^thumbnails\/([^/]+)\/(light|dark)\.png$/);
        if (match) {
          const [, circuitId, theme] = match;
          if (theme === 'light') {
            lightThumbnails.add(circuitId);
          } else if (theme === 'dark') {
            darkThumbnails.add(circuitId);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Find circuits with both thumbnails
    const completeCircuits = Array.from(lightThumbnails).filter((id) => darkThumbnails.has(id));

    return NextResponse.json({
      totalLight: lightThumbnails.size,
      totalDark: darkThumbnails.size,
      totalComplete: completeCircuits.length,
      completeCircuitIds: completeCircuits,
    });
  } catch (error) {
    console.error('List R2 thumbnails failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'List failed' },
      { status: 500 }
    );
  }
}
