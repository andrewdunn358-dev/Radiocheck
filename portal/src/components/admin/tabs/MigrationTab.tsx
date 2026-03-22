'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface MigrationTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function MigrationTab({ token, onSuccess, onError }: MigrationTabProps) {
  const [migrationStatus, setMigrationStatus] = useState<any>(null);

  const loadMigrationStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMigrationStatus(token);
      setMigrationStatus(data);
    } catch (err: any) {
      console.error('Migration status not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadMigrationStatus();
  }, [loadMigrationStatus]);

  const handleRunMigration = async () => {
    if (!token) return;
    if (!confirm('This will migrate all legacy users to the unified staff collection. Continue?')) return;
    
    try {
      const result = await api.runMigration(token);
      onSuccess(`Migration complete: ${result.stats.staff_created} staff created`);
      await loadMigrationStatus();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleFixPasswords = async () => {
    if (!token) return;
    
    try {
      const result = await api.fixStaffPasswords(token);
      onSuccess(`Password fix complete: ${result.stats.fixed} fixed`);
      await loadMigrationStatus();
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <div data-testid="migration-tab">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Database Migration Status</h2>
        
        {migrationStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Legacy Users</p>
                <p className="text-2xl font-bold">{migrationStatus.legacy_counts?.users || 0}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Legacy Peers</p>
                <p className="text-2xl font-bold">{migrationStatus.legacy_counts?.peers || 0}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Unified Staff</p>
                <p className="text-2xl font-bold text-green-400">{migrationStatus.unified_counts?.staff || 0}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Pending Migration</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {Math.max(0, (migrationStatus.legacy_counts?.users || 0) + (migrationStatus.legacy_counts?.peers || 0) - (migrationStatus.unified_counts?.staff || 0))}
                </p>
              </div>
            </div>

            {migrationStatus.last_run && (
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Last Migration Run</p>
                <p className="font-medium">{new Date(migrationStatus.last_run).toLocaleString()}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            Loading migration status...
          </div>
        )}
      </div>

      {/* Migration Actions */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Migration Actions
        </h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleRunMigration}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run Full Migration
          </button>
          <button
            onClick={handleFixPasswords}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2"
          >
            Fix Password Hashes
          </button>
          <button
            onClick={loadMigrationStatus}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Status
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Note: Migration will merge legacy users and peers into the unified staff collection. 
          Existing unified staff will not be affected. Password fix will rehash any plaintext passwords.
        </p>
      </div>
    </div>
  );
}
