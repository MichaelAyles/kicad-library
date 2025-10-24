/**
 * Admin Delete Circuit API
 *
 * DELETE /api/admin/delete-circuit
 *
 * Allows admins to delete circuits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication using JWT
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Not logged in' },
        { status: 401 }
      );
    }

    const adminStatus = await isAdmin(user);
    if (!adminStatus) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get circuit ID from request body
    const { circuitId } = await request.json();

    if (!circuitId) {
      return NextResponse.json(
        { error: 'Missing circuitId in request body' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient();

    // Delete the circuit (cascades will handle related data)
    const { error } = await adminSupabase
      .from('circuits')
      .delete()
      .eq('id', circuitId);

    if (error) {
      console.error('Error deleting circuit:', error);
      return NextResponse.json(
        { error: 'Failed to delete circuit', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Circuit deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in delete circuit endpoint:', error);
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
    endpoint: 'DELETE /api/admin/delete-circuit',
    description: 'Delete a circuit (admin only)',
    authentication: 'Bearer token in Authorization header',
    request_format: {
      circuitId: 'string (UUID)',
    },
  });
}
