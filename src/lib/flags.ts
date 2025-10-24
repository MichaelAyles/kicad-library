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
export async function createCircuitFlag(input: CreateFlagInput): Promise<CircuitFlag> {
  const supabase = createClient();

  // Get current user first
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error('User not authenticated:', userError);
    throw new Error('You must be logged in to flag circuits');
  }

  const { data, error } = await supabase
    .from('circuit_flags')
    .insert({
      circuit_id: input.circuit_id,
      flagged_by: userData.user.id,
      reason: input.reason,
      details: input.details || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating flag:', error);
    throw new Error('Failed to flag circuit');
  }

  return data;
}

/**
 * Check if user has already flagged a circuit
 */
export async function hasUserFlaggedCircuit(circuitId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;

  const { data, error } = await supabase
    .rpc('has_user_flagged_circuit', {
      circuit_uuid: circuitId,
      user_uuid: user.user.id,
    });

  if (error) {
    console.error('Error checking flag status:', error);
    return false;
  }

  return data || false;
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
