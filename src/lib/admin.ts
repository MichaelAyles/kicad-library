/**
 * Admin Role Management
 *
 * Functions for checking and managing admin users
 */

import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Check if a user has admin role
 * Admin role is stored in raw_user_meta_data->>'role'
 */
export async function isAdmin(user?: User | null): Promise<boolean> {
  if (!user) return false;

  // Check if user has admin role in metadata
  const role = user.user_metadata?.role;
  return role === 'admin';
}

/**
 * Get the current user and check if they're an admin
 */
export async function getCurrentUserIsAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return isAdmin(user);
}

/**
 * Set a user's role to admin (requires existing admin privileges)
 * Note: This requires server-side implementation with service role
 */
export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const supabase = createClient();

  // This endpoint would need to be implemented with service role
  const { error } = await supabase.functions.invoke('set-user-role', {
    body: { userId, role: isAdmin ? 'admin' : 'user' }
  });

  if (error) {
    throw new Error('Failed to update user role');
  }
}

/**
 * Check if the current user can perform an admin action
 */
export async function requireAdmin(): Promise<User> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminCheck = await isAdmin(user);
  if (!adminCheck) {
    throw new Error('Unauthorized - Admin access required');
  }

  return user;
}
