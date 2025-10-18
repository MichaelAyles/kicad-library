'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Github, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, signInWithGitHub, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleGitHubSignUp = async () => {
    setIsLoading(true);
    try {
      await signInWithGitHub();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border rounded-lg p-8 shadow-sm">
            <h1 className="text-3xl font-bold mb-2">Create Account</h1>
            <p className="text-muted-foreground mb-8">Join CircuitSnips to upload and share circuits</p>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            {/* GitHub OAuth Button */}
            <button
              onClick={handleGitHubSignUp}
              disabled={isLoading || authLoading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Signing up...
                </>
              ) : (
                <>
                  <Github className="w-5 h-5" />
                  Sign up with GitHub
                </>
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          {authLoading && (
            <div className="mt-8 p-4 bg-muted/30 border rounded-lg text-sm text-muted-foreground flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Checking authentication...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
