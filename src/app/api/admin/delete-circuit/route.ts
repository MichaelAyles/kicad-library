/**
 * Admin Delete Circuit API
 *
 * DELETE /api/admin/delete-circuit
 *
 * Allows admins to delete circuits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnonClient } from '@supabase/supabase-js';

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

    // Use admin client for deletion
    const adminSupabase = createAdminClient();

    // Get circuit ID from request body
    const { circuitId } = await request.json();

    if (!circuitId) {
      return NextResponse.json(
        { error: 'Missing circuitId in request body' },
        { status: 400 }
      );
    }

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
