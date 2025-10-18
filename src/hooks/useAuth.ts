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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: 'https://circuitsnips.mikeayles.com/auth/callback',
        },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub sign in failed';
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
    signOut,
    isAuthenticated: !!user,
  };
}
