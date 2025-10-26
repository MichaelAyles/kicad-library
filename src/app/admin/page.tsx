"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import { AlertTriangle, Trash2, Eye, CheckCircle, XCircle, Loader, Image } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<'flags' | 'thumbnails'>('flags');
  const [flagFilter, setFlagFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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
        </div>
      </main>

      <Footer />
    </div>
  );
}
