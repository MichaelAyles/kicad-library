'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { user, isLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-primary">
          CircuitSnips
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/browse" className="text-sm font-medium hover:text-primary transition-colors">
            Browse
          </Link>
          <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors">
            Search
          </Link>
          <Link href="/upload" className="text-sm font-medium hover:text-primary transition-colors">
            Upload
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                <User className="w-4 h-4" />
                {user.email?.split('@')[0] || 'Profile'}
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
