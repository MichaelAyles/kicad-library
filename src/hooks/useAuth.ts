import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check current auth state
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auth error');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signInWithGitHub = async () => {
    setError(null);
    try {
      // Use window.location.origin to handle both local and production environments
      const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://circuitsnips.mikeayles.com'}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub sign in failed';
      setError(message);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email sign in failed';
      setError(message);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, username?: string) => {
    setError(null);
    try {
      const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://circuitsnips.mikeayles.com'}/auth/callback`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: username || email.split('@')[0],
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email sign up failed';
      setError(message);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://circuitsnips.mikeayles.com'}/auth/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
      throw err;
    }
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password update failed';
      setError(message);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw err;
    }
  };

  return {
    user,
    isLoading,
    error,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    signOut,
    isAuthenticated: !!user,
  };
}
