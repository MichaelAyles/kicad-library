/**
 * Circuit Flags Library
 *
 * Functions for creating and managing circuit flags
 */

import { createClient } from '@/lib/supabase/client';
import type { CreateFlagInput, CircuitFlag } from '@/types/flags';

/**
 * Create a flag for a circuit
 */
export async function createCircuitFlag(input: CreateFlagInput): Promise<void> {
  const supabase = createClient();

  // Get current user first
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error('User not authenticated:', userError);
    throw new Error('You must be logged in to flag circuits');
  }

  const { error } = await supabase
    .from('circuit_flags')
    .insert({
      circuit_id: input.circuit_id,
      flagged_by: userData.user.id,
      reason: input.reason,
      details: input.details || null,
    });

  if (error) {
    console.error('Error creating flag:', error);

    // Check for duplicate flag error
    if (error.code === '23505') {
      throw new Error('You have already flagged this circuit');
    }

    throw new Error('Failed to flag circuit');
  }
}

/**
 * Check if user has already flagged a circuit
 */
export async function hasUserFlaggedCircuit(circuitId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;

  // Direct query instead of RPC to work with RLS policies
  const { data, error } = await supabase
    .from('circuit_flags')
    .select('id')
    .eq('circuit_id', circuitId)
    .eq('flagged_by', user.user.id)
    .single();

  if (error) {
    // PGRST116 means no rows found, which means not flagged
    if (error.code === 'PGRST116') {
      return false;
    }
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
