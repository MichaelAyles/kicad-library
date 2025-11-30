import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PUT /api/circuits/[id]
 * Update circuit metadata (title, description, tags, category, license, is_public)
 * Only the circuit owner can update their circuits
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Get the circuit to verify ownership
    const { data: circuit, error: fetchError } = await supabase
      .from('circuits')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !circuit) {
      return NextResponse.json(
        { error: 'Circuit not found' },
        { status: 404 }
      );
    }

    // Verify user is the owner
    if (circuit.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only edit your own circuits' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, tags, category, license, is_public, thumbnail_light_url, thumbnail_dark_url, thumbnail_version } = body;

    // Build update object - only include fields that are provided
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // If this is a thumbnail-only update (both thumbnail URLs provided)
    const isThumbnailOnlyUpdate = thumbnail_light_url && thumbnail_dark_url && !title && !description && !tags && !license;

    if (isThumbnailOnlyUpdate) {
      // Only update thumbnails
      updateData.thumbnail_light_url = thumbnail_light_url;
      updateData.thumbnail_dark_url = thumbnail_dark_url;
      if (thumbnail_version !== undefined) {
        updateData.thumbnail_version = thumbnail_version;
      }
    } else {
      // Validate required fields for metadata update
      if (!title || !description || !tags || !license) {
        return NextResponse.json(
          { error: 'Missing required fields: title, description, tags, license' },
          { status: 400 }
        );
      }

      // Validate title length
      if (title.length > 150) {
        return NextResponse.json(
          { error: 'Title must be 150 characters or less' },
          { status: 400 }
        );
      }

      // Validate description length
      if (description.length > 10000) {
        return NextResponse.json(
          { error: 'Description must be 10,000 characters or less' },
          { status: 400 }
        );
      }

      // Validate tags
      if (!Array.isArray(tags) || tags.length === 0) {
        return NextResponse.json(
          { error: 'At least one tag is required' },
          { status: 400 }
        );
      }

      if (tags.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 tags allowed' },
          { status: 400 }
        );
      }

      // Validate each tag
      for (const tag of tags) {
        if (typeof tag !== 'string' || tag.length > 30) {
          return NextResponse.json(
            { error: 'Each tag must be a string with maximum 30 characters' },
            { status: 400 }
          );
        }
      }

      // Update metadata fields
      updateData.title = title.trim();
      updateData.description = description.trim();
      updateData.tags = tags;
      updateData.category = category || null;
      updateData.license = license;
      updateData.is_public = is_public !== undefined ? is_public : true;

      // Also update thumbnails if provided
      if (thumbnail_light_url) updateData.thumbnail_light_url = thumbnail_light_url;
      if (thumbnail_dark_url) updateData.thumbnail_dark_url = thumbnail_dark_url;
      if (thumbnail_version !== undefined) updateData.thumbnail_version = thumbnail_version;
    }

    // Update the circuit
    const { data: updatedCircuit, error: updateError } = await supabase
      .from('circuits')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating circuit:', updateError);
      return NextResponse.json(
        { error: 'Failed to update circuit' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      circuit: updatedCircuit,
    });
  } catch (error) {
    console.error('Error in PUT /api/circuits/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circuits/[id]
 * Delete a circuit (for future implementation)
 * Only the circuit owner can delete their circuits
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Get the circuit to verify ownership
    const { data: circuit, error: fetchError } = await supabase
      .from('circuits')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !circuit) {
      return NextResponse.json(
        { error: 'Circuit not found' },
        { status: 404 }
      );
    }

    // Verify user is the owner
    if (circuit.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own circuits' },
        { status: 403 }
      );
    }

    // Delete the circuit
    const { error: deleteError } = await supabase
      .from('circuits')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting circuit:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete circuit' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Circuit deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/circuits/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
