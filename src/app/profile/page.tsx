'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Activity,
  Upload,
  Copy,
  Star,
  Github,
  Loader,
  Eye,
  Heart,
  Shield
} from 'lucide-react';

interface UserStats {
  circuitsUploaded: number;
  totalCopies: number;
  totalFavorites: number;
}

interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  view_count: number;
  copy_count: number;
  favorite_count: number;
  created_at: string;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
}

// Helper function to format time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingCircuits, setIsLoadingCircuits] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState(true);
  const supabase = createClient();

  // Get username from query params or use logged-in user
  const usernameParam = searchParams.get('user');

  // Load the profile user (either from query param or logged-in user)
  useEffect(() => {
    const loadProfileUser = async () => {
      if (usernameParam) {
        // Viewing someone else's profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', usernameParam)
          .single();

        if (error || !data) {
          // User not found, redirect to 404 or own profile
          router.push('/profile');
          return;
        }

        setProfileUser(data);
        setIsViewingOwnProfile(user?.id === data.id);
      } else {
        // Viewing own profile
        if (!authLoading && !user) {
          router.push('/login');
          return;
        }
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (data) {
            setProfileUser(data);
            setIsViewingOwnProfile(true);
          }
        }
      }
    };

    loadProfileUser();
  }, [usernameParam, user, authLoading, router, supabase]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const adminStatus = await isAdmin(user);
        setIsUserAdmin(adminStatus);
      }
    };
    checkAdminStatus();
  }, [user]);

  // Load user statistics
  useEffect(() => {
    const loadUserStats = async () => {
      if (!profileUser) return;

      try {
        // Get circuit count using count query (not limited to 1000)
        const { count: circuitCount, error: countError } = await supabase
          .from('circuits')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileUser.id);

        if (countError) throw countError;

        // Fetch all circuits in batches to calculate total copies and favorites
        let allCircuits: Array<{ copy_count: number; favorite_count: number }> = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data: batch, error: batchError } = await supabase
            .from('circuits')
            .select('copy_count, favorite_count')
            .eq('user_id', profileUser.id)
            .range(offset, offset + batchSize - 1);

          if (batchError) throw batchError;

          if (batch && batch.length > 0) {
            allCircuits.push(...batch);
            offset += batchSize;
            if (batch.length < batchSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        const stats: UserStats = {
          circuitsUploaded: circuitCount || 0,
          totalCopies: allCircuits.reduce((sum, c) => sum + (c.copy_count || 0), 0),
          totalFavorites: allCircuits.reduce((sum, c) => sum + (c.favorite_count || 0), 0),
        };

        setStats(stats);
      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadUserStats();
  }, [profileUser, supabase]);

  // Load user's uploaded circuits
  useEffect(() => {
    const loadCircuits = async () => {
      if (!profileUser) return;

      try {
        const { data, error } = await supabase
          .from('circuits')
          .select('id, slug, title, description, view_count, copy_count, favorite_count, created_at, thumbnail_light_url, thumbnail_dark_url')
          .eq('user_id', profileUser.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        setCircuits(data || []);
      } catch (error) {
        console.error('Error loading circuits:', error);
      } finally {
        setIsLoadingCircuits(false);
      }
    };

    loadCircuits();
  }, [profileUser, supabase]);

  if (authLoading || !profileUser) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Extract GitHub metadata from profileUser object
  const githubUsername = profileUser.username;
  const githubAvatar = profileUser.avatar_url;
  const fullName = profileUser.full_name || profileUser.username;
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

                  {isViewingOwnProfile && user?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profileUser.created_at || '').toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                {isViewingOwnProfile && (
                  <div className="flex gap-3">
                    <Link
                      href="/upload"
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                    >
                      Upload Circuit
                    </Link>
                    {isUserAdmin && (
                      <Link
                        href="/admin"
                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium hover:bg-destructive/90 transition-colors flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Portal
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className="px-4 py-2 border rounded-md font-medium hover:bg-muted transition-colors"
                    >
                      Edit Profile
                    </Link>
                  </div>
                )}
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

          {/* Uploaded Circuits Section */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  {isViewingOwnProfile ? 'Your Circuits' : `${fullName}'s Circuits`}
                </h2>
              </div>
              {isViewingOwnProfile && circuits.length > 0 && (
                <Link
                  href="/upload"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Upload New
                </Link>
              )}
            </div>

            {isLoadingCircuits ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : circuits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="mb-2">
                  {isViewingOwnProfile ? 'No circuits uploaded yet' : `${fullName} hasn't uploaded any circuits yet`}
                </p>
                {isViewingOwnProfile && (
                  <Link
                    href="/upload"
                    className="text-primary hover:underline font-medium inline-block"
                  >
                    Upload your first circuit →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {circuits.map((circuit) => {
                  const thumbnailUrl = circuit.thumbnail_light_url || circuit.thumbnail_dark_url;
                  const timeAgo = getTimeAgo(circuit.created_at);

                  return (
                    <Link
                      key={circuit.id}
                      href={`/circuit/${circuit.slug}`}
                      className="block border rounded-lg p-4 hover:border-primary/50 transition-colors group"
                    >
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="w-32 h-24 rounded border flex-shrink-0 overflow-hidden">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={circuit.title}
                              className="w-full h-full object-cover scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Activity className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors truncate">
                            {circuit.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {circuit.description}
                          </p>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              <span>{circuit.view_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Copy className="w-3 h-3" />
                              <span>{circuit.copy_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{circuit.favorite_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}