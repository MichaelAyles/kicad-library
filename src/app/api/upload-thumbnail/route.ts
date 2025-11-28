import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase client for database updates
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { circuitId, lightDataUrl, darkDataUrl } = await request.json();

    if (!circuitId) {
      return NextResponse.json({ error: 'Missing circuitId' }, { status: 400 });
    }

    if (!lightDataUrl && !darkDataUrl) {
      return NextResponse.json({ error: 'Missing thumbnail data' }, { status: 400 });
    }

    const r2Client = getR2Client();
    const supabase = getSupabase();
    const bucket = process.env.R2_BUCKET_NAME!;
    const publicUrl = process.env.R2_PUBLIC_URL!;

    const results: { light?: string; dark?: string } = {};

    // Upload light thumbnail
    if (lightDataUrl) {
      const lightKey = `thumbnails/${circuitId}/light.png`;
      const lightBuffer = Buffer.from(lightDataUrl.split(',')[1], 'base64');

      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: lightKey,
          Body: lightBuffer,
          ContentType: 'image/png',
        })
      );

      results.light = `${publicUrl}/${lightKey}`;
    }

    // Upload dark thumbnail
    if (darkDataUrl) {
      const darkKey = `thumbnails/${circuitId}/dark.png`;
      const darkBuffer = Buffer.from(darkDataUrl.split(',')[1], 'base64');

      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: darkKey,
          Body: darkBuffer,
          ContentType: 'image/png',
        })
      );

      results.dark = `${publicUrl}/${darkKey}`;
    }

    // Update Supabase database with the new R2 URLs
    const updateData: { thumbnail_light_url?: string; thumbnail_dark_url?: string } = {};
    if (results.light) updateData.thumbnail_light_url = results.light;
    if (results.dark) updateData.thumbnail_dark_url = results.dark;

    const { error: dbError } = await supabase
      .from('circuits')
      .update(updateData)
      .eq('id', circuitId);

    if (dbError) {
      console.error('Failed to update Supabase:', dbError);
      return NextResponse.json(
        { error: 'Uploaded to R2 but failed to update database', urls: results },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      circuitId,
      urls: results,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
