import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { BasiqInstitution, BasiqConnection } from '@/lib/basiq/types';
import { Card } from '@/components/dashboard/Card';
import {
  SkeletonBankAccount,
  InlineLoader,
  LoadingButton,
  Skeleton,
} from '@/components/ui/SkeletonLoaders';
import {
  ErrorDisplay,
  NetworkError,
  EmptyState,
} from '@/components/ui/ErrorComponents';
import { useApiError } from '@/hooks/useApiError';

interface BankConnectionManagerProps {
  onConnectionUpdate?: () => void;
}

const POPULAR_BANKS = [
  'Commonwealth Bank',
  'Westpac',
  'ANZ',
  'NAB',
  'ING',
  'Bank of Queensland',
  'Bendigo Bank',
  'Macquarie Bank',
];

export const BankConnectionManager: React.FC<BankConnectionManagerProps> = ({
  onConnectionUpdate,
}) => {
  const { data: _session } = useSession();
  const [institutions, setInstitutions] = useState<BasiqInstitution[]>([]);
  const [connections, setConnections] = useState<BasiqConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllBanks, setShowAllBanks] = useState(false);
  // Error handling
  const {
    error: institutionsError,
    handleError: handleInstitutionsError,
    clearError: clearInstitutionsError,
  } = useApiError();
  const {
    error: connectionsError,
    handleError: handleConnectionsError,
    clearError: clearConnectionsError,
  } = useApiError();
  const {
    error: connectionError,
    handleError: handleConnectionError,
    clearError: clearConnectionError,
  } = useApiError();
  const [oauthWindow, setOauthWindow] = useState<Window | null>(null);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [refreshingConnection, setRefreshingConnection] = useState<string | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<string | null>(null);

  // Fetch available institutions
  const fetchInstitutions = useCallback(async () => {
    try {
      setLoadingInstitutions(true);
      clearInstitutionsError();
      const response = await fetch('/api/basiq/institutions');

      if (!response.ok) {
        const error = new Error(`Failed to fetch institutions: ${response.status}`);
        throw error;
      }

      const data = await response.json();
      setInstitutions(data);
    } catch (err) {
      handleInstitutionsError(err, {
        endpoint: '/api/basiq/institutions',
        method: 'GET',
        retryable: true,
      });
    } finally {
      setLoadingInstitutions(false);
    }
  }, [clearInstitutionsError, handleInstitutionsError]);

  // Fetch existing connections
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      clearConnectionsError();
      const response = await fetch('/api/basiq/connections');

      if (!response.ok) {
        const error = new Error(`Failed to fetch connections: ${response.status}`);
        throw error;
      }

      const data = await response.json();
      setConnections(data);
    } catch (err) {
      handleConnectionsError(err, {
        endpoint: '/api/basiq/connections',
        method: 'GET',
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [clearConnectionsError, handleConnectionsError]);

  // Handle OAuth connection flow
  const handleOAuthConnection = async (institutionId: string) => {
    try {
      setConnecting(institutionId);
      clearConnectionError();

      // Request OAuth URL from backend
      const response = await fetch('/api/basiq/connections/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth connection');
      }

      const { authUrl, connectionId } = await response.json();

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const authWindow = window.open(
        authUrl,
        'BankConnection',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
      );

      setOauthWindow(authWindow);

      // Poll for OAuth completion
      const pollInterval = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(pollInterval);
          setOauthWindow(null);
          setConnecting(null);

          // Check connection status
          await checkConnectionStatus(connectionId);
        }
      }, 1000);
    } catch (err) {
      handleConnectionError(err, {
        endpoint: '/api/basiq/connections/oauth',
        method: 'POST',
        retryable: false,
      });
      setConnecting(null);
    }
  };

  // Handle credential-based connection
  interface BankCredentials {
    username: string;
    password: string;
  }

  const handleCredentialConnection = async (
    institutionId: string,
    credentials: BankCredentials,
  ) => {
    try {
      setConnecting(institutionId);
      clearConnectionError();

      const response = await fetch('/api/basiq/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId, credentials }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection failed');
      }

      await fetchConnections();
      if (onConnectionUpdate) onConnectionUpdate();
    } catch (err) {
      handleConnectionError(err, {
        endpoint: '/api/basiq/connections',
        method: 'POST',
        retryable: false,
      });
    } finally {
      setConnecting(null);
    }
  };

  // Check connection status
  const checkConnectionStatus = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/basiq/connections/${connectionId}/status`);
      if (!response.ok) throw new Error('Failed to check status');

      const { status } = await response.json();

      if (status === 'active') {
        await fetchConnections();
        if (onConnectionUpdate) onConnectionUpdate();
      } else if (status === 'failed') {
        handleConnectionError(new Error('Connection failed. Please try again.'), {
          endpoint: `/api/basiq/connections/${connectionId}/status`,
          method: 'GET',
          retryable: false,
        });
      }
    } catch (err) {
      handleConnectionError(err, {
        endpoint: `/api/basiq/connections/${connectionId}/status`,
        method: 'GET',
        retryable: true,
        silent: true, // Don't show error UI for status checks
      });
    }
  };

  // Refresh connection
  const refreshConnection = async (connectionId: string) => {
    try {
      clearConnectionError();
      setRefreshingConnection(connectionId);
      const response = await fetch(`/api/basiq/connections/${connectionId}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Refresh failed');

      await fetchConnections();
      if (onConnectionUpdate) onConnectionUpdate();
    } catch (err) {
      handleConnectionError(err, {
        endpoint: `/api/basiq/connections/${connectionId}/refresh`,
        method: 'POST',
        retryable: true,
      });
    } finally {
      setRefreshingConnection(null);
    }
  };

  // Delete connection
  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to remove this bank connection?')) return;

    try {
      clearConnectionError();
      setDeletingConnection(connectionId);
      const response = await fetch(`/api/basiq/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      await fetchConnections();
      if (onConnectionUpdate) onConnectionUpdate();
    } catch (err) {
      handleConnectionError(err, {
        endpoint: `/api/basiq/connections/${connectionId}`,
        method: 'DELETE',
        retryable: false,
      });
    } finally {
      setDeletingConnection(null);
    }
  };

  useEffect(() => {
    fetchInstitutions();
    fetchConnections();
  }, [fetchInstitutions, fetchConnections]);

  // Filter institutions based on search
  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const popularInstitutions = filteredInstitutions.filter((inst) =>
    POPULAR_BANKS.includes(inst.name),
  );

  const displayedInstitutions = showAllBanks ? filteredInstitutions : popularInstitutions;

  return (
    <div className="space-y-6">
      {/* Error Displays */}
      {connectionError && (
        <ErrorDisplay
          error={connectionError.message}
          onRetry={() => clearConnectionError()}
          className="mb-4"
        />
      )}

      {connectionsError && (
        <ErrorDisplay
          error={connectionsError.message}
          onRetry={fetchConnections}
          className="mb-4"
        />
      )}

      {institutionsError && (
        <ErrorDisplay
          error={institutionsError.message}
          onRetry={fetchInstitutions}
          className="mb-4"
        />
      )}

      {/* Existing Connections */}
      <Card
        title="Connected Banks"
        className="mb-6"
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <SkeletonBankAccount key={i} />
            ))}
          </div>
        ) : connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xl font-semibold text-gray-600">
                      {connection.institution.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium">{connection.institution.name}</h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <StatusIndicator status={connection.status} />
                      <span>
                        Last updated: {new Date(connection.lastRefreshed).toLocaleString('en-AU')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <LoadingButton
                    onClick={() => refreshConnection(connection.id)}
                    loading={
                      refreshingConnection === connection.id || connection.status === 'refreshing'
                    }
                    disabled={
                      refreshingConnection === connection.id || connection.status === 'refreshing'
                    }
                    className="btn btn-sm btn-secondary"
                  >
                    Refresh
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => deleteConnection(connection.id)}
                    loading={deletingConnection === connection.id}
                    disabled={deletingConnection === connection.id}
                    className="btn btn-sm btn-danger"
                  >
                    Remove
                  </LoadingButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={
              <svg
                className="w-16 h-16 mx-auto text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
            title="No banks connected yet"
            message="Connect your bank accounts to start tracking transactions"
            action={{
              label: 'Connect Your First Bank',
              onClick: () => {
                const firstBank = document.querySelector('[data-bank-button]');
                if (firstBank) {
                  (firstBank as HTMLElement).scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                  (firstBank as HTMLElement).focus();
                }
              },
            }}
          />
        )}
      </Card>

      {/* Add New Connection */}
      <Card title="Add Bank Connection">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search for your bank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Institution List */}
          {loadingInstitutions ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex items-center p-3 border rounded-lg"
                >
                  <Skeleton
                    width={40}
                    height={40}
                    circle
                    className="mr-3"
                  />
                  <Skeleton
                    height={20}
                    width="60%"
                    rounded
                  />
                </div>
              ))}
            </div>
          ) : institutionsError ? (
            <NetworkError
              onRetry={fetchInstitutions}
              className="my-4"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedInstitutions.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => {
                    if (institution.authType === 'oauth') {
                      handleOAuthConnection(institution.id);
                    } else {
                      // Show credential form modal
                      // Implementation depends on your modal system
                    }
                  }}
                  disabled={connecting === institution.id}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 relative"
                  data-bank-button
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-semibold text-gray-600">
                      {institution.name.charAt(0)}
                    </span>
                  </div>
                  <span className="flex-1 text-left">{institution.name}</span>
                  {connecting === institution.id && (
                    <InlineLoader
                      size="sm"
                      className="ml-2"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Show All Banks Toggle */}
          {!showAllBanks && filteredInstitutions.length > popularInstitutions.length && (
            <button
              onClick={() => setShowAllBanks(true)}
              className="w-full py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Show all {filteredInstitutions.length} banks
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

// Status Indicator Component
type ConnectionStatus = 'pending' | 'fetching' | 'success' | 'error';

const StatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const statusConfig = {
    active: { color: 'text-green-600', icon: '✓', label: 'Active' },
    refreshing: { color: 'text-blue-600', icon: '↻', label: 'Refreshing' },
    failed: { color: 'text-red-600', icon: '✗', label: 'Failed' },
    pending: { color: 'text-yellow-600', icon: '⏳', label: 'Pending' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`flex items-center ${config.color}`}>
      <span className="mr-1">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default BankConnectionManager;
