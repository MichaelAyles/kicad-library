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
  Github,
  Loader,
  Save,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Trash2
} from 'lucide-react';

interface ProfileData {
  username: string;
  bio: string | null;
  website: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, bio, website')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setProfile(data);
      } catch (error) {
        console.error('Error loading profile:', error);
        setMessage({ type: 'error', text: 'Failed to load profile' });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: profile.username.trim(),
          bio: profile.bio?.trim() || null,
          website: profile.website?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          throw new Error('Username is already taken');
        }
        throw error;
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });

      // Refresh after 1.5 seconds to show updated data
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);

    try {
      // Call API endpoint to delete account and all data
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      // Sign out
      await supabase.auth.signOut();

      // Redirect to home page
      router.push('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      alert(error.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Extract GitHub metadata
  const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
  const githubAvatar = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Back button */}
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your profile information and preferences
            </p>
          </div>

          {/* Profile Picture Section (Read-only) */}
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
            <div className="flex items-center gap-4">
              {githubAvatar ? (
                <img
                  src={githubAvatar}
                  alt={fullName || 'Profile'}
                  className="w-20 h-20 rounded-full border-2 border-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <UserIcon className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Your profile picture is synced from GitHub
                </p>
                {githubUsername && (
                  <a
                    href={`https://github.com/${githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Github className="w-3 h-3" />
                    Update on GitHub
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSave} className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>

            {/* Message */}
            {message && (
              <div
                className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            {/* Email (Read-only) */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Email is managed by your authentication provider
              </p>
            </div>

            {/* Username (Editable) */}
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={profile?.username || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, username: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your-username"
                pattern="[a-zA-Z0-9_-]+"
                minLength={3}
                maxLength={30}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                3-30 characters. Letters, numbers, dashes, and underscores only.
              </p>
            </div>

            {/* Bio */}
            <div className="mb-4">
              <label htmlFor="bio" className="block text-sm font-medium mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={profile?.bio || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, bio: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.bio?.length || 0}/500 characters
              </p>
            </div>

            {/* Website */}
            <div className="mb-6">
              <label htmlFor="website" className="block text-sm font-medium mb-2">
                Website
              </label>
              <input
                type="url"
                id="website"
                value={profile?.website || ''}
                onChange={(e) => setProfile(prev => prev ? { ...prev, website: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your personal website or portfolio
              </p>
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
              <Link
                href="/profile"
                className="px-4 py-2 border rounded-md font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* GitHub Connection Info */}
          <div className="mt-6 p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
            <div className="flex items-start gap-3">
              <Github className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium mb-1">Connected to GitHub</h3>
                <p className="text-sm text-muted-foreground">
                  You&apos;re signed in with GitHub as{' '}
                  <span className="text-foreground font-medium">
                    @{githubUsername}
                  </span>
                  . Your profile picture and email are synced automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="mt-8 p-6 border border-destructive/30 bg-destructive/5 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-destructive text-destructive rounded-md font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>Your profile and account information</li>
                    <li>All circuits you&apos;ve uploaded</li>
                    <li>All your comments and favorites</li>
                    <li>All associated data and statistics</li>
                  </ul>
                </div>

                <div>
                  <label htmlFor="deleteConfirm" className="block text-sm font-medium mb-2">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    id="deleteConfirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-destructive rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-destructive"
                    placeholder="DELETE"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Permanently Delete Account
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    disabled={isDeleting}
                    className="px-4 py-2 border rounded-md font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
