import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/admin/delete-all-thumbnails
 *
 * Admin endpoint to delete all thumbnails from circuitsnips-importer circuits
 * - Deletes thumbnail files from storage
 * - Sets thumbnail_light_url and thumbnail_dark_url to null in database
 */
export async function DELETE(request: NextRequest) {
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
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const userRole = user.user_metadata?.role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Use admin client for operations
    const adminClient = createAdminClient();

    // Get the circuitsnips-importer user ID
    const { data: importerUser, error: importerError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', 'circuitsnips-importer')
      .single();

    if (importerError || !importerUser) {
      return NextResponse.json(
        { error: 'circuitsnips-importer user not found' },
        { status: 404 }
      );
    }

    // Fetch all circuits with thumbnails from circuitsnips-importer
    const { data: circuits, error: fetchError } = await adminClient
      .from('circuits')
      .select('id, thumbnail_light_url, thumbnail_dark_url')
      .eq('user_id', importerUser.id)
      .or('thumbnail_light_url.not.is.null,thumbnail_dark_url.not.is.null');

    if (fetchError) {
      console.error('Error fetching circuits:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch circuits' },
        { status: 500 }
      );
    }

    if (!circuits || circuits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No thumbnails to delete',
        deletedCount: 0
      });
    }

    // Delete thumbnail files from storage
    let deletedFiles = 0;
    let failedFiles = 0;

    for (const circuit of circuits) {
      // Extract file paths from URLs
      const filePaths: string[] = [];

      if (circuit.thumbnail_light_url) {
        const lightPath = circuit.thumbnail_light_url.split('/thumbnails/')[1];
        if (lightPath) filePaths.push(lightPath);
      }

      if (circuit.thumbnail_dark_url) {
        const darkPath = circuit.thumbnail_dark_url.split('/thumbnails/')[1];
        if (darkPath) filePaths.push(darkPath);
      }

      // Delete files from storage
      if (filePaths.length > 0) {
        const { error: deleteError } = await adminClient.storage
          .from('thumbnails')
          .remove(filePaths);

        if (deleteError) {
          console.error(`Error deleting files for circuit ${circuit.id}:`, deleteError);
          failedFiles += filePaths.length;
        } else {
          deletedFiles += filePaths.length;
        }
      }
    }

    // Update database to set thumbnail URLs to null
    const { error: updateError } = await adminClient
      .from('circuits')
      .update({
        thumbnail_light_url: null,
        thumbnail_dark_url: null,
        thumbnail_version: 1
      })
      .eq('user_id', importerUser.id);

    if (updateError) {
      console.error('Error updating database:', updateError);
      return NextResponse.json(
        { error: 'Failed to update database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted thumbnails from ${circuits.length} @circuitsnips-importer circuits`,
      circuitsUpdated: circuits.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles
    });

  } catch (error) {
    console.error('Error in delete-all-thumbnails:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
