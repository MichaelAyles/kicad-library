/**
 * Circuit Flags Library
 *
 * Functions for creating and managing circuit flags
 */

import { createClient } from '@/lib/supabase/client';
import type { CreateFlagInput, CircuitFlag } from '@/types/flags';

/**
 * Create a flag for a circuit
 * No authentication required - anyone can flag
 */
export async function createCircuitFlag(input: CreateFlagInput): Promise<void> {
  const supabase = createClient();

  // Get current user if logged in (optional)
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  const { error } = await supabase
    .from('circuit_flags')
    .insert({
      circuit_id: input.circuit_id,
      flagged_by: userId, // Can be null for anonymous flags
      reason: input.reason,
      details: input.details || null,
    });

  if (error) {
    console.error('Error creating flag:', error);
    throw new Error('Failed to submit flag');
  }
}

/**
 * Check if user has already flagged a circuit
 * Note: With anonymous flagging, we can't reliably prevent duplicate flags
 * This function is kept for logged-in users only
 */
export async function hasUserFlaggedCircuit(circuitId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    // Anonymous users - can't check, always allow flagging
    return false;
  }

  // Check if this logged-in user has already flagged
  const { data, error } = await supabase
    .from('circuit_flags')
    .select('id')
    .eq('circuit_id', circuitId)
    .eq('flagged_by', user.user.id)
    .maybeSingle();

  if (error) {
    console.error('Error checking flag status:', error);
    return false;
  }

  return !!data;
}

/**
 * Get pending flag count for a circuit
 */
export async function getCircuitFlagCount(circuitId: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .rpc('get_circuit_flag_count', { circuit_uuid: circuitId });

  if (error) {
    console.error('Error getting flag count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get all flags for a circuit (admin only)
 */
export async function getCircuitFlags(circuitId: string): Promise<CircuitFlag[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('circuit_flags')
    .select('*')
    .eq('circuit_id', circuitId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching flags:', error);
    throw new Error('Failed to fetch flags');
  }

  return data || [];
}
