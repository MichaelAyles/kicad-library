"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
import { AlertTriangle, Trash2, Eye, CheckCircle, XCircle, Loader } from "lucide-react";
import Link from "next/link";

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
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');

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
    if (!isAuthorized) return;

    const loadFlags = async () => {
      setIsLoading(true);
      // TODO: Implement API endpoint to fetch flags
      // For now, mock data
      setFlags([]);
      setIsLoading(false);
    };

    loadFlags();
  }, [isAuthorized, filter]);

  const handleDeleteCircuit = async (circuitId: string) => {
    if (!confirm('Are you sure you want to delete this circuit? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/delete-circuit', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}`,
        },
        body: JSON.stringify({ circuitId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete circuit');
      }

      alert('Circuit deleted successfully');
      // Reload flags
      window.location.reload();
    } catch (error) {
      console.error('Error deleting circuit:', error);
      alert('Failed to delete circuit. Please try again.');
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

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 font-medium transition-colors ${
                filter === 'pending'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({flags.filter(f => f.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              className={`px-4 py-2 font-medium transition-colors ${
                filter === 'reviewed'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Reviewed ({flags.filter(f => f.status !== 'pending').length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 font-medium transition-colors ${
                filter === 'all'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({flags.length})
            </button>
          </div>

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
                {filter === 'pending'
                  ? 'There are no pending flags at the moment.'
                  : 'No flags found for this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags
                .filter(flag => {
                  if (filter === 'pending') return flag.status === 'pending';
                  if (filter === 'reviewed') return flag.status !== 'pending';
                  return true;
                })
                .map((flag) => (
                  <div
                    key={flag.id}
                    className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
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
                ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
