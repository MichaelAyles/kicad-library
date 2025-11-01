/**
 * Admin Regenerate Thumbnail API
 *
 * POST /api/admin/regenerate-thumbnail
 *
 * Allows admins to regenerate thumbnails for circuits
 * Uses service role key to bypass RLS and upload to any user's storage folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnonClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Get the Authorization header with bearer token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Create a client with the anon key to verify the token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createAnonClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the token by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token', details: authError?.message },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const userRole = user.user_metadata?.role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Use admin client for storage operations (bypasses RLS)
    const adminSupabase = createAdminClient();

    // Get request data
    const { circuitId, userId, lightThumbBase64, darkThumbBase64 } = await request.json();

    if (!circuitId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: circuitId, userId' },
        { status: 400 }
      );
    }

    if (!lightThumbBase64 || !darkThumbBase64) {
      return NextResponse.json(
        { error: 'Missing thumbnail data: lightThumbBase64, darkThumbBase64' },
        { status: 400 }
      );
    }

    // Get current thumbnail version and increment
    const { data: circuit, error: circuitError } = await adminSupabase
      .from('circuits')
      .select('thumbnail_version')
      .eq('id', circuitId)
      .single();

    if (circuitError || !circuit) {
      return NextResponse.json(
        { error: 'Circuit not found', details: circuitError?.message },
        { status: 404 }
      );
    }

    const newVersion = (circuit.thumbnail_version || 0) + 1;

    // Convert base64 to buffer for upload (with versioning)
    const uploadThumbnail = async (base64Data: string, theme: 'light' | 'dark') => {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64String, 'base64');

      const filePath = `${userId}/${circuitId}-v${newVersion}-${theme}.png`;

      // Upload using admin client (bypasses RLS)
      // Set upsert: false to ensure we create new files, not overwrite
      const { data, error } = await adminSupabase.storage
        .from('thumbnails')
        .upload(filePath, buffer, {
          contentType: 'image/png',
          upsert: false, // Create new version, don't overwrite
        });

      if (error) {
        throw new Error(`Failed to upload ${theme} thumbnail: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = adminSupabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

      return publicUrl;
    };

    // Upload both thumbnails
    const lightUrl = await uploadThumbnail(lightThumbBase64, 'light');
    const darkUrl = await uploadThumbnail(darkThumbBase64, 'dark');

    // Mark previous versions as not current
    const { error: historyUpdateError } = await adminSupabase
      .from('thumbnail_history')
      .update({ is_current: false })
      .eq('circuit_id', circuitId)
      .eq('is_current', true);

    if (historyUpdateError) {
      console.error('Error updating thumbnail history:', historyUpdateError);
    }

    // Insert new version into history
    const { error: historyInsertError } = await adminSupabase
      .from('thumbnail_history')
      .insert({
        circuit_id: circuitId,
        version: newVersion,
        thumbnail_light_url: lightUrl,
        thumbnail_dark_url: darkUrl,
        regenerated_by: user.id,
        is_current: true,
        notes: 'Admin regeneration',
      });

    if (historyInsertError) {
      console.error('Error inserting thumbnail history:', historyInsertError);
      return NextResponse.json(
        { error: 'Failed to save thumbnail history', details: historyInsertError.message },
        { status: 500 }
      );
    }

    // Update circuit record with new thumbnail URLs and version (using admin client)
    const { error: updateError } = await adminSupabase
      .from('circuits')
      .update({
        thumbnail_light_url: lightUrl,
        thumbnail_dark_url: darkUrl,
        thumbnail_version: newVersion,
      })
      .eq('id', circuitId);

    if (updateError) {
      console.error('Error updating circuit with thumbnail URLs:', updateError);
      return NextResponse.json(
        { error: 'Failed to update circuit', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lightUrl,
      darkUrl,
      version: newVersion,
      message: `Thumbnails uploaded successfully (v${newVersion})`,
    });
  } catch (error: any) {
    console.error('Error in regenerate thumbnail endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/admin/regenerate-thumbnail',
    description: 'Regenerate thumbnails for a circuit (admin only)',
    authentication: 'Bearer token in Authorization header',
    request_format: {
      circuitId: 'string (UUID)',
      userId: 'string (UUID) - owner of the circuit',
      lightThumbBase64: 'string (base64 encoded PNG)',
      darkThumbBase64: 'string (base64 encoded PNG)',
    },
  });
}
