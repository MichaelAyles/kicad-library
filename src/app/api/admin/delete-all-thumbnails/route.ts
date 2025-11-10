import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin';

// Increase timeout for large operations
export const maxDuration = 60; // 60 seconds max (requires Vercel Pro)
export const dynamic = 'force-dynamic';

// Error categories for better user feedback
enum ErrorCategory {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  STORAGE = 'STORAGE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

// Helper to create categorized error responses
function createErrorResponse(
  category: ErrorCategory,
  message: string,
  details?: string,
  suggestion?: string,
  statusCode: number = 500
) {
  return NextResponse.json(
    {
      error: message,
      category,
      details,
      suggestion,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

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
      return createErrorResponse(
        ErrorCategory.AUTHENTICATION,
        'No authentication token provided',
        'The Authorization header is missing or invalid',
        'Please include a valid Bearer token in the Authorization header',
        401
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
      return createErrorResponse(
        ErrorCategory.AUTHENTICATION,
        'Invalid authentication token',
        authError?.message,
        'Please log in again to get a fresh authentication token',
        401
      );
    }

    // Check if user has admin role using centralized helper
    const adminStatus = await isAdmin(user);
    if (!adminStatus) {
      return createErrorResponse(
        ErrorCategory.AUTHORIZATION,
        'Admin access required',
        'This endpoint is restricted to administrators only',
        'Contact an administrator if you believe you should have access',
        403
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
      return createErrorResponse(
        ErrorCategory.NOT_FOUND,
        'Importer user not found',
        'The circuitsnips-importer user does not exist in the database',
        'Ensure the importer user account has been created',
        404
      );
    }

    // Fetch ALL circuits from circuitsnips-importer (pagination to handle large datasets)
    let allCircuits: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: circuits, error: fetchError } = await adminClient
        .from('circuits')
        .select('id, user_id, thumbnail_light_url, thumbnail_dark_url')
        .eq('user_id', importerUser.id)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error('Error fetching circuits:', fetchError);
        return createErrorResponse(
          ErrorCategory.DATABASE,
          'Failed to fetch circuits',
          fetchError.message,
          'Database query failed. Please try again',
          500
        );
      }

      if (!circuits || circuits.length === 0) {
        hasMore = false;
      } else {
        allCircuits = allCircuits.concat(circuits);
        hasMore = circuits.length === pageSize;
        page++;
      }
    }

    console.log(`Found ${allCircuits.length} total circuits for circuitsnips-importer`);

    if (allCircuits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No circuits found for circuitsnips-importer',
        deletedCount: 0
      });
    }

    const circuits = allCircuits;

    // Delete ALL thumbnail files for these circuits from storage
    // Optimize by listing the entire user folder once instead of per-circuit
    let deletedFiles = 0;
    let failedFiles = 0;

    const folderPath = `${importerUser.id}`;

    try {
      console.log(`Listing all files in folder: ${folderPath}`);

      // List ALL files in the importer user's folder
      const { data: fileList, error: listError } = await adminClient.storage
        .from('thumbnails')
        .list(folderPath, {
          limit: 10000, // Increase limit to handle large number of files
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error(`Error listing files:`, listError);
        throw new Error(`Failed to list files: ${listError.message}`);
      }

      if (fileList && fileList.length > 0) {
        console.log(`Found ${fileList.length} total files in storage`);

        // Build set of circuit IDs for quick lookup
        const circuitIdSet = new Set(circuits.map(c => c.id));

        // Filter to only files belonging to our circuits
        const filesToDelete = fileList
          .filter(file => {
            // Extract circuit ID from filename (format: circuitId-v#-theme.png)
            const match = file.name.match(/^([a-f0-9-]+)-v\d+-/);
            return match && circuitIdSet.has(match[1]);
          })
          .map(file => `${folderPath}/${file.name}`);

        console.log(`Deleting ${filesToDelete.length} thumbnail files...`);

        if (filesToDelete.length > 0) {
          // Delete in batches to avoid request size limits
          const batchSize = 100;
          for (let i = 0; i < filesToDelete.length; i += batchSize) {
            const batch = filesToDelete.slice(i, i + batchSize);

            const { error: deleteError } = await adminClient.storage
              .from('thumbnails')
              .remove(batch);

            if (deleteError) {
              console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
              failedFiles += batch.length;
            } else {
              deletedFiles += batch.length;
            }
          }
        }
      } else {
        console.log('No files found in storage');
      }
    } catch (error) {
      console.error('Error processing storage files:', error);
      // Continue to database update even if file deletion fails
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
      return createErrorResponse(
        ErrorCategory.DATABASE,
        'Failed to update circuit records',
        updateError.message,
        'Storage files were deleted but database update failed. Please try deleting again.',
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted all thumbnails from ${circuits.length} @circuitsnips-importer circuits`,
      circuitsUpdated: circuits.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles
    });

  } catch (error: any) {
    console.error('Error in delete-all-thumbnails:', error);

    // Categorize errors
    let category = ErrorCategory.INTERNAL;
    let suggestion = 'Please try again or contact support if the problem persists';

    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      category = ErrorCategory.TIMEOUT;
      suggestion = 'The operation took too long. The database may be under heavy load. Try again later.';
    } else if (error.message?.includes('storage')) {
      category = ErrorCategory.STORAGE;
      suggestion = 'Storage operation failed. Check storage quota and permissions.';
    }

    return createErrorResponse(
      category,
      'Bulk thumbnail deletion failed',
      error.message || 'Unknown error',
      suggestion,
      500
    );
  }
}
