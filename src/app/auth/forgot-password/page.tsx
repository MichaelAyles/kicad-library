'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader, Mail } from 'lucide-react';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const { resetPassword, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    // Validation
    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setSuccessMessage('Password reset instructions sent! Check your email.');
      setEmail('');
    } catch (err) {
      // Error is already set in the auth hook
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
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to sign in
            </Link>

            <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
            <p className="text-muted-foreground mb-8">
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </p>

            {(error || localError) && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error || localError}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-md text-sm text-green-600 dark:text-green-400">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Send Reset Instructions
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Remember your password?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
