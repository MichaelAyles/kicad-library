'use client';

import { useEffect, useState } from 'react';
import { CircuitWithUser, fetchAllCircuits, getCircuitStats } from '@/lib/supabase';

interface Stats {
  totalCircuits: number;
  withLightThumbnail: number;
  withDarkThumbnail: number;
  withBothThumbnails: number;
  withNoThumbnails: number;
  uniqueUsers: number;
}

interface R2Status {
  connected: boolean;
  bucket?: string;
  publicUrl?: string;
  objectCount?: number;
  error?: string;
}

export default function Home() {
  const [circuits, setCircuits] = useState<CircuitWithUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [r2Status, setR2Status] = useState<R2Status | null>(null);
  const [r2Loading, setR2Loading] = useState(true);

  // Test R2 connection on mount
  useEffect(() => {
    async function testR2() {
      try {
        setR2Loading(true);
        const response = await fetch('/api/test-r2');
        const data = await response.json();
        setR2Status(data);
      } catch (err) {
        setR2Status({ connected: false, error: 'Failed to test R2 connection' });
      } finally {
        setR2Loading(false);
      }
    }
    testR2();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { circuits, stats } = await getCircuitStats();
        setCircuits(circuits);
        setStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredCircuits = circuits.filter(circuit => {
    const matchesUser = !filterUser || circuit.profile.username.toLowerCase().includes(filterUser.toLowerCase());
    const matchesMissing = !showMissingOnly || (!circuit.thumbnail_light_url || !circuit.thumbnail_dark_url);
    return matchesUser && matchesMissing;
  });

  const userGroups = filteredCircuits.reduce((acc, circuit) => {
    const username = circuit.profile.username;
    if (!acc[username]) {
      acc[username] = [];
    }
    acc[username].push(circuit);
    return acc;
  }, {} as Record<string, CircuitWithUser[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading circuits...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">R2 Thumbnail Generator</h1>
          <a
            href="/iterator"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            Open Circuit Iterator →
          </a>
        </div>

        {/* R2 Connection Status */}
        <div className={`rounded-lg shadow p-4 mb-8 ${
          r2Loading ? 'bg-gray-100' :
          r2Status?.connected ? 'bg-green-50 border border-green-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {r2Loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600">Testing R2 connection...</span>
              </>
            ) : r2Status?.connected ? (
              <>
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-green-800 font-medium">Connected to R2 successfully</span>
                <span className="text-green-600 text-sm">
                  • Bucket: {r2Status.bucket} • Objects: {r2Status.objectCount}
                </span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-red-800 font-medium">R2 connection failed</span>
                <span className="text-red-600 text-sm">• {r2Status?.error}</span>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Circuits</div>
                <div className="text-3xl font-bold">{stats.totalCircuits}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Unique Users</div>
                <div className="text-3xl font-bold">{stats.uniqueUsers}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">With Both Thumbnails</div>
                <div className="text-3xl font-bold text-green-600">{stats.withBothThumbnails}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">With Light Only</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.withLightThumbnail - stats.withBothThumbnails}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">With Dark Only</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.withDarkThumbnail - stats.withBothThumbnails}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">No Thumbnails</div>
                <div className="text-3xl font-bold text-red-600">{stats.withNoThumbnails}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Filters</h2>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Username
              </label>
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Search username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="missingOnly"
                checked={showMissingOnly}
                onChange={(e) => setShowMissingOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="missingOnly" className="ml-2 text-sm font-medium text-gray-700">
                Show missing thumbnails only
              </label>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredCircuits.length} of {circuits.length} circuits
          </div>
        </div>

        {/* Circuits by User */}
        <div className="space-y-6">
          {Object.entries(userGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([username, userCircuits]) => (
              <div key={username} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">
                  @{username} ({userCircuits.length} circuit{userCircuits.length !== 1 ? 's' : ''})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Title</th>
                        <th className="text-left py-2 px-4">Slug</th>
                        <th className="text-center py-2 px-4">Light Thumb</th>
                        <th className="text-center py-2 px-4">Dark Thumb</th>
                        <th className="text-left py-2 px-4">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userCircuits.map((circuit) => (
                        <tr key={circuit.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4">{circuit.title}</td>
                          <td className="py-2 px-4 font-mono text-xs">{circuit.slug}</td>
                          <td className="py-2 px-4 text-center">
                            {circuit.thumbnail_light_url ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600">✗</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {circuit.thumbnail_dark_url ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600">✗</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {new Date(circuit.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
