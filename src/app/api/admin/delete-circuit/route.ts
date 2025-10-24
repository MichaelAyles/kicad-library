/**
 * Admin Delete Circuit API
 *
 * DELETE /api/admin/delete-circuit
 *
 * Allows admins to delete circuits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdminKey } from '@/lib/admin-auth';

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('Authorization');
    if (!verifyAdminKey(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin API key' },
        { status: 401 }
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
    const supabase = createAdminClient();

    // Delete the circuit (cascades will handle related data)
    const { error } = await supabase
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
