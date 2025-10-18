'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Activity,
  Upload,
  Copy,
  Star,
  Github,
  Loader
} from 'lucide-react';

interface UserStats {
  circuitsUploaded: number;
  totalCopies: number;
  totalFavorites: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const supabase = createClient();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load user statistics
  useEffect(() => {
    const loadUserStats = async () => {
      if (!user) return;

      try {
        // Get user's circuits and calculate stats
        const { data: circuits, error } = await supabase
          .from('circuits')
          .select('copy_count, favorite_count')
          .eq('user_id', user.id);

        if (error) throw error;

        const stats: UserStats = {
          circuitsUploaded: circuits?.length || 0,
          totalCopies: circuits?.reduce((sum, c) => sum + (c.copy_count || 0), 0) || 0,
          totalFavorites: circuits?.reduce((sum, c) => sum + (c.favorite_count || 0), 0) || 0,
        };

        setStats(stats);
      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadUserStats();
  }, [user, supabase]);

  if (authLoading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Extract GitHub metadata from user object
  const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
  const githubAvatar = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
  const githubUrl = githubUsername ? `https://github.com/${githubUsername}` : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Profile Header */}
          <div className="bg-card border rounded-lg p-8 mb-8">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {githubAvatar ? (
                  <img
                    src={githubAvatar}
                    alt={fullName || 'Profile'}
                    className="w-24 h-24 rounded-full border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                    <UserIcon className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{fullName || 'CircuitSnips User'}</h1>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-4">
                  {githubUsername && (
                    <div className="flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      <a
                        href={githubUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        @{githubUsername}
                      </a>
                    </div>
                  )}

                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(user.created_at || '').toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link
                    href="/upload"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                  >
                    Upload Circuit
                  </Link>
                  <Link
                    href="/settings"
                    className="px-4 py-2 border rounded-md font-medium hover:bg-muted transition-colors"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Circuits Uploaded</h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingStats ? '-' : stats?.circuitsUploaded || 0}
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Copy className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Total Copies</h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingStats ? '-' : stats?.totalCopies || 0}
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Total Favorites</h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingStats ? '-' : stats?.totalFavorites || 0}
              </p>
            </div>
          </div>

          {/* Activity Section */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Recent Activity</h2>
            </div>

            <div className="text-center py-12 text-muted-foreground">
              <p>No circuits uploaded yet</p>
              <Link
                href="/upload"
                className="text-primary hover:underline font-medium mt-2 inline-block"
              >
                Upload your first circuit →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}