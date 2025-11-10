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

    // Fetch all circuits from circuitsnips-importer
    const { data: circuits, error: fetchError } = await adminClient
      .from('circuits')
      .select('id, user_id, thumbnail_light_url, thumbnail_dark_url')
      .eq('user_id', importerUser.id);

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
        message: 'No circuits found for circuitsnips-importer',
        deletedCount: 0
      });
    }

    // Delete ALL thumbnail files for these circuits from storage
    // This includes all versions, not just current ones
    let deletedFiles = 0;
    let failedFiles = 0;

    for (const circuit of circuits) {
      // List all files in the user's folder for this circuit
      // Files are stored as: {userId}/{circuitId}-v{version}-{theme}.png
      const folderPath = `${circuit.user_id}`;

      try {
        // List all files in the user's folder
        const { data: fileList, error: listError } = await adminClient.storage
          .from('thumbnails')
          .list(folderPath);

        if (listError) {
          console.warn(`Error listing files for ${folderPath}:`, listError);
          continue;
        }

        // Find all files that belong to this circuit (any version)
        const circuitFiles = fileList
          ?.filter(file => file.name.startsWith(`${circuit.id}-`))
          .map(file => `${folderPath}/${file.name}`) || [];

        if (circuitFiles.length > 0) {
          console.log(`Deleting ${circuitFiles.length} files for circuit ${circuit.id}`);

          const { error: deleteError } = await adminClient.storage
            .from('thumbnails')
            .remove(circuitFiles);

          if (deleteError) {
            console.error(`Error deleting files for circuit ${circuit.id}:`, deleteError);
            failedFiles += circuitFiles.length;
          } else {
            deletedFiles += circuitFiles.length;
          }
        }
      } catch (error) {
        console.error(`Error processing circuit ${circuit.id}:`, error);
        failedFiles++;
      }
    }

    // Delete all thumbnail history records for these circuits
    const circuitIds = circuits.map(c => c.id);

    try {
      const { error: historyDeleteError } = await adminClient
        .from('thumbnail_history')
        .delete()
        .in('circuit_id', circuitIds);

      if (historyDeleteError) {
        console.warn('Error deleting thumbnail history (non-critical):', historyDeleteError);
      } else {
        console.log('Deleted thumbnail history for all circuits');
      }
    } catch (error) {
      console.warn('Thumbnail history deletion skipped (table may not exist)');
    }

    // Update database to set thumbnail URLs to null and reset version to 0
    const { error: updateError } = await adminClient
      .from('circuits')
      .update({
        thumbnail_light_url: null,
        thumbnail_dark_url: null,
        thumbnail_version: 0
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
      message: `Deleted all thumbnails from ${circuits.length} @circuitsnips-importer circuits`,
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
