"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import { AlertTriangle, Trash2, Eye, CheckCircle, XCircle, Loader, Image, BarChart3, RefreshCw, Copy, Users } from "lucide-react";
import Link from "next/link";
import { ThumbnailRegenerator } from "@/components/ThumbnailRegenerator";

interface FlaggedCircuit {
  id: string;
  circuit_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  circuit: {
    id: string;
    slug: string;
    title: string;
    user: {
      username: string;
    } | null;
  } | null;
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [flags, setFlags] = useState<FlaggedCircuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'flags' | 'thumbnails' | 'stats' | 'users'>('flags');
  const [flagFilter, setFlagFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Check admin authorization
  useEffect(() => {
    const checkAuth = async () => {
      if (authLoading) return;

      if (!user) {
        router.push('/login');
        return;
      }

      const adminStatus = await isAdmin(user);
      if (!adminStatus) {
        alert('Unauthorized - Admin access required');
        router.push('/');
        return;
      }

      setIsAuthorized(true);
    };

    checkAuth();
  }, [user, authLoading, router]);

  // Load flagged circuits
  useEffect(() => {
    if (!isAuthorized || activeTab !== 'flags') return;

    const loadFlags = async () => {
      setIsLoading(true);

      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        // Fetch flags with circuit and user info
        const { data, error } = await supabase
          .from('circuit_flags')
          .select(`
            id,
            circuit_id,
            reason,
            details,
            status,
            created_at,
            circuits:circuit_id (
              id,
              slug,
              title,
              user_id,
              profiles:user_id (
                username
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching flags:', error);
          throw error;
        }

        // Transform the data to match our interface
        const transformedFlags = (data || []).map((flag: any) => ({
          id: flag.id,
          circuit_id: flag.circuit_id,
          reason: flag.reason,
          details: flag.details,
          status: flag.status,
          created_at: flag.created_at,
          circuit: flag.circuits ? {
            id: flag.circuits.id,
            slug: flag.circuits.slug,
            title: flag.circuits.title,
            user: flag.circuits.profiles ? {
              username: flag.circuits.profiles.username
            } : null
          } : null
        }));

        setFlags(transformedFlags);
      } catch (error) {
        console.error('Failed to load flags:', error);
        setFlags([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlags();
  }, [isAuthorized, activeTab, flagFilter]);

  const handleDeleteCircuit = async (circuitId: string) => {
    if (!confirm('Are you sure you want to delete this circuit? This action cannot be undone.')) {
      return;
    }

    try {
      // Get the access token from Supabase
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/delete-circuit', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ circuitId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete circuit');
      }

      alert('Circuit deleted successfully');
      // Reload flags
      window.location.reload();
    } catch (error: any) {
      console.error('Error deleting circuit:', error);
      alert(error.message || 'Failed to delete circuit. Please try again.');
    }
  };

  const handleDismissFlag = async (flagId: string) => {
    if (!confirm('Mark this flag as dismissed? The circuit will remain published.')) {
      return;
    }

    try {
      // Get the access token from Supabase
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/update-flag', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          flagId,
          status: 'dismissed',
          adminNotes: 'Reviewed and dismissed - no action required'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to dismiss flag');
      }

      alert('Flag dismissed successfully');
      // Reload flags
      window.location.reload();
    } catch (error: any) {
      console.error('Error dismissing flag:', error);
      alert(error.message || 'Failed to dismiss flag. Please try again.');
    }
  };

  const handleBulkDismiss = async () => {
    if (selectedFlags.size === 0) {
      alert('Please select flags to dismiss');
      return;
    }

    if (!confirm(`Dismiss ${selectedFlags.size} selected flag(s)? The circuits will remain published.`)) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      for (const flagId of Array.from(selectedFlags)) {
        try {
          const response = await fetch('/api/admin/update-flag', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              flagId,
              status: 'dismissed',
              adminNotes: 'Bulk dismissed - no action required'
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error dismissing flag ${flagId}:`, error);
        }
      }

      alert(`Dismissed ${successCount} flag(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
      window.location.reload();
    } catch (error: any) {
      console.error('Bulk dismiss error:', error);
      alert(error.message || 'Failed to dismiss flags');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFlags.size === 0) {
      alert('Please select flags to delete');
      return;
    }

    if (!confirm(`Delete ${selectedFlags.size} circuit(s)? This action cannot be undone!`)) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      for (const flagId of Array.from(selectedFlags)) {
        const flag = flags.find(f => f.id === flagId);
        if (!flag?.circuit) continue;

        try {
          const response = await fetch('/api/admin/delete-circuit', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ circuitId: flag.circuit.id }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error deleting circuit ${flag.circuit.id}:`, error);
        }
      }

      alert(`Deleted ${successCount} circuit(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
      window.location.reload();
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      alert(error.message || 'Failed to delete circuits');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    const filteredFlags = flags.filter(flag => {
      if (flagFilter === 'pending') return flag.status === 'pending';
      if (flagFilter === 'reviewed') return flag.status !== 'pending';
      return true;
    });

    if (selectedFlags.size === filteredFlags.length) {
      setSelectedFlags(new Set());
    } else {
      setSelectedFlags(new Set(filteredFlags.map(f => f.id)));
    }
  };

  const toggleSelectFlag = (flagId: string) => {
    const newSelected = new Set(selectedFlags);
    if (newSelected.has(flagId)) {
      newSelected.delete(flagId);
    } else {
      newSelected.add(flagId);
    }
    setSelectedFlags(newSelected);
  };

  // Load global stats when stats tab is active
  useEffect(() => {
    if (!isAuthorized || activeTab !== 'stats') return;

    const loadGlobalStats = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        const { data, error } = await supabase
          .from('global_stats')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) {
          console.error('Error loading global stats:', error);
        } else {
          setGlobalStats(data);
        }
      } catch (error) {
        console.error('Failed to load global stats:', error);
      }
    };

    loadGlobalStats();
  }, [isAuthorized, activeTab]);

  const handleSyncStats = async () => {
    if (!confirm('This will recalculate all stats from the database. Continue?')) {
      return;
    }

    setIsSyncingStats(true);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/sync-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync stats');
      }

      const result = await response.json();
      setGlobalStats(result.stats);
      alert('Stats synchronized successfully!');
    } catch (error: any) {
      console.error('Error syncing stats:', error);
      alert(error.message || 'Failed to sync stats. Please try again.');
    } finally {
      setIsSyncingStats(false);
    }
  };

  // Load users when users tab is active
  useEffect(() => {
    if (!isAuthorized || activeTab !== 'users') return;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            searchQuery: userSearchQuery,
            limit: 100,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load users');
        }

        const result = await response.json();
        setUsers(result.users || []);
      } catch (error: any) {
        console.error('Error loading users:', error);
        alert(error.message || 'Failed to load users');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isAuthorized, activeTab, userSearchQuery]);

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user @${username}?\n\nThis will permanently delete:\n- Their profile\n- All their circuits\n- All their comments\n- All their favorites\n\nThis action CANNOT be undone!`)) {
      return;
    }

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      const result = await response.json();
      alert(result.message);

      // Refresh user list
      setUsers(users.filter(u => u.id !== userId));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Failed to delete user');
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage flagged circuits and content moderation
            </p>
          </div>

          {/* Main Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b-2">
            <button
              onClick={() => setActiveTab('flags')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'flags'
                  ? 'border-b-2 border-primary text-primary -mb-0.5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Flagged Circuits
            </button>
            <button
              onClick={() => setActiveTab('thumbnails')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'thumbnails'
                  ? 'border-b-2 border-primary text-primary -mb-0.5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Image className="w-4 h-4" />
              Thumbnail Regeneration
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'stats'
                  ? 'border-b-2 border-primary text-primary -mb-0.5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Global Stats
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-b-2 border-primary text-primary -mb-0.5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              User Management
            </button>
          </div>

          {/* Flags Section */}
          {activeTab === 'flags' && (
            <>
              {/* Flag Filter tabs */}
              <div className="flex gap-2 mb-6 border-b">
                <button
                  onClick={() => setFlagFilter('pending')}
              className={`px-4 py-2 font-medium transition-colors ${
                flagFilter === 'pending'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({flags.filter(f => f.status === 'pending').length})
            </button>
            <button
              onClick={() => setFlagFilter('reviewed')}
              className={`px-4 py-2 font-medium transition-colors ${
                flagFilter === 'reviewed'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Reviewed ({flags.filter(f => f.status !== 'pending').length})
            </button>
            <button
              onClick={() => setFlagFilter('all')}
              className={`px-4 py-2 font-medium transition-colors ${
                flagFilter === 'all'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({flags.length})
            </button>
          </div>

          {/* Bulk Actions Bar */}
          {!isLoading && flags.length > 0 && (
            <div className="flex items-center justify-between gap-4 mb-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFlags.size === flags.filter(flag => {
                    if (flagFilter === 'pending') return flag.status === 'pending';
                    if (flagFilter === 'reviewed') return flag.status !== 'pending';
                    return true;
                  }).length && flags.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-2 border-primary cursor-pointer"
                />
                <span className="font-medium">
                  {selectedFlags.size === 0 ? 'Select All' : `${selectedFlags.size} selected`}
                </span>
              </div>

              {selectedFlags.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDismiss}
                    disabled={isBulkProcessing}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isBulkProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Dismiss Selected
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkProcessing}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isBulkProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Flags list */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading flags...</p>
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">No flags to review</h3>
              <p className="text-muted-foreground">
                {flagFilter === 'pending'
                  ? 'There are no pending flags at the moment.'
                  : 'No flags found for this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags
                .filter(flag => {
                  if (flagFilter === 'pending') return flag.status === 'pending';
                  if (flagFilter === 'reviewed') return flag.status !== 'pending';
                  return true;
                })
                .map((flag) => (
                  <div
                    key={flag.id}
                    className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedFlags.has(flag.id)}
                        onChange={() => toggleSelectFlag(flag.id)}
                        className="mt-1 w-5 h-5 rounded border-2 border-primary cursor-pointer flex-shrink-0"
                      />

                      <div className="flex items-start justify-between gap-4 flex-1">
                      <div className="flex-1">
                        {/* Circuit info */}
                        {flag.circuit && (
                          <div className="mb-3">
                            <h3 className="text-lg font-semibold mb-1">
                              <Link
                                href={`/circuit/${flag.circuit.slug}`}
                                className="text-primary hover:underline"
                                target="_blank"
                              >
                                {flag.circuit.title}
                              </Link>
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              by @{flag.circuit.user?.username || 'Unknown'}
                            </p>
                          </div>
                        )}

                        {/* Flag details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">Reason:</span>
                            <span className="text-sm">{flag.reason.replace('_', ' ')}</span>
                          </div>

                          {flag.details && (
                            <div>
                              <span className="font-medium">Details:</span>
                              <p className="text-sm text-muted-foreground mt-1">{flag.details}</p>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            Flagged {new Date(flag.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {flag.circuit && (
                          <>
                            <Link
                              href={`/circuit/${flag.circuit.slug}`}
                              target="_blank"
                              className="px-3 py-2 border rounded-md text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                              title="View circuit"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            <button
                              onClick={() => handleDismissFlag(flag.id)}
                              className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors flex items-center gap-2"
                              title="Dismiss flag - circuit is OK"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Dismiss
                            </button>

                            <button
                              onClick={() => handleDeleteCircuit(flag.circuit!.id)}
                              className="px-3 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors flex items-center gap-2"
                              title="Delete circuit"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
            </>
          )}

          {/* Thumbnails Section */}
          {activeTab === 'thumbnails' && (
            <ThumbnailRegenerator />
          )}

          {/* Stats Section */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Global Stats Management</h2>
                    <p className="text-sm text-muted-foreground">
                      View and synchronize global statistics. Stats are automatically updated but you can manually sync if needed.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncStats}
                    disabled={isSyncingStats}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSyncingStats ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Sync Stats
                      </>
                    )}
                  </button>
                </div>

                {globalStats ? (
                  <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-muted/30 rounded-lg p-6 border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Circuits</p>
                            <p className="text-3xl font-bold">{globalStats.total_circuits.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-6 border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Copy className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Downloads</p>
                            <p className="text-3xl font-bold">{globalStats.total_copies.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-6 border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Users</p>
                            <p className="text-3xl font-bold">{globalStats.total_users.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Last Synced:</span>{' '}
                          <span className="font-medium">
                            {new Date(globalStats.last_synced_at).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Updated:</span>{' '}
                          <span className="font-medium">
                            {new Date(globalStats.updated_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="mt-6 bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                            How Global Stats Work
                          </p>
                          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Stats are automatically updated when users copy circuits, upload new circuits, or create accounts</li>
                            <li>The homepage pulls from this single record instead of aggregating thousands of rows</li>
                            <li>Use &quot;Sync Stats&quot; if you suspect the counts are out of sync (e.g., after bulk operations)</li>
                            <li>Syncing recalculates all counts from the source tables</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading stats...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Users Section */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-card border rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">User Management</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Search and manage users. Deleting a user will remove all their data including circuits, comments, and favorites.
                </p>

                {/* Search */}
                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="Search users by username..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md bg-background text-foreground"
                  />
                </div>

                {/* User List */}
                {isLoadingUsers ? (
                  <div className="text-center py-12">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((userItem) => (
                      <div
                        key={userItem.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          {userItem.avatar_url ? (
                            <img
                              src={userItem.avatar_url}
                              alt={userItem.username}
                              className="w-12 h-12 rounded-full"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">@{userItem.username}</div>
                            <div className="text-sm text-muted-foreground">
                              {userItem.circuitCount} circuit{userItem.circuitCount !== 1 ? 's' : ''} •
                              Joined {new Date(userItem.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile?user=${userItem.username}`}
                            className="px-4 py-2 text-sm border rounded-md hover:bg-muted/50 transition-colors"
                            target="_blank"
                          >
                            <Eye className="w-4 h-4 inline mr-1" />
                            View Profile
                          </Link>
                          <button
                            onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                            disabled={userItem.id === user?.id}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete User
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warning Box */}
                <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-red-600 dark:text-red-400 mb-1">
                        ⚠️ Permanent Deletion Warning
                      </p>
                      <p className="text-muted-foreground">
                        Deleting a user is permanent and cannot be undone. This will delete their profile,
                        all circuits they&apos;ve uploaded, all their comments, favorites, and any other data
                        associated with their account. Use this feature with extreme caution.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
