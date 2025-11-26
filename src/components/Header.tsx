'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User } from 'lucide-react';
import { SearchAutocomplete } from './SearchAutocomplete';

export function Header() {
  const { user, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const isCategoriesPage = pathname === '/categories';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If already on homepage, force a full reload
    if (pathname === '/') {
      e.preventDefault();
      window.location.href = '/';
    }
    // Otherwise, let Next.js Link handle it normally for fast navigation
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        {/* Top Row: Logo, Nav, User */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 text-2xl font-bold green-gradient-text hover:opacity-80 transition-opacity flex-shrink-0">
            <Image
              src="/logo_green_transparent.png"
              alt="CircuitSnips Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            CircuitSnips
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link href="/browse" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group">
              Browse
              <span className="absolute bottom-0 left-0 w-0 h-0.5 green-gradient group-hover:w-full transition-all duration-300" />
            </Link>
            <Link href="/categories" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group">
              Categories
              <span className="absolute bottom-0 left-0 w-0 h-0.5 green-gradient group-hover:w-full transition-all duration-300" />
            </Link>
            <Link href="/upload" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group">
              Upload
              <span className="absolute bottom-0 left-0 w-0 h-0.5 green-gradient group-hover:w-full transition-all duration-300" />
            </Link>
          </nav>

          {/* Desktop Search - Hide on categories page */}
          {!isCategoriesPage && (
            <div className="hidden md:block flex-1 max-w-xl mx-4">
              <SearchAutocomplete />
            </div>
          )}

          <div className="flex items-center gap-4 flex-shrink-0">
          <ThemeToggle />
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="View profile"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name || 'Profile'}
                    className="w-8 h-8 rounded-full border-2 border-primary/50 hover:border-primary transition-colors"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border-2 border-primary/50 hover:border-primary transition-colors">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
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
              className="px-4 py-2 text-sm font-medium green-gradient text-black rounded-md hover:shadow-lg green-glow-hover transition-all"
            >
              Sign In
            </Link>
          )}
          </div>
        </div>

        {/* Mobile Search Row - Hide on categories page */}
        {!isCategoriesPage && (
          <div className="md:hidden mt-4">
            <SearchAutocomplete />
          </div>
        )}
      </div>
    </header>
  );
}
