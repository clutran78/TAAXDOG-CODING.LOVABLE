import React, { useState, useEffect, useCallback } from 'react';
import { Connection, ConnectionHealth } from '@/lib/basiq/types';
import { Card } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface ConnectionHealthMonitorProps {
  refreshInterval?: number; // in milliseconds
  onConnectionIssue?: (connectionId: string, issue: string) => void;
  className?: string;
}

interface HealthStatus {
  connection: Connection;
  health: ConnectionHealth;
  lastChecked: Date;
}

export const ConnectionHealthMonitor: React.FC<ConnectionHealthMonitorProps> = ({
  refreshInterval = 300000, // 5 minutes default
  onConnectionIssue,
  className = '',
}) => {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch connection health
  const fetchConnectionHealth = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/basiq/connections/health');
      if (!response.ok) throw new Error('Failed to fetch health status');

      const data = await response.json();

      const statuses: HealthStatus[] = data.map((item: any) => ({
        connection: item.connection,
        health: item.health,
        lastChecked: new Date(),
      }));

      setHealthStatuses(statuses);

      // Check for issues
      statuses.forEach((status) => {
        if (status.health.status === 'unhealthy' && onConnectionIssue) {
          onConnectionIssue(
            status.connection.id,
            status.health.issues?.[0] || 'Connection unhealthy',
          );
        }
      });
    } catch (error) {
      logger.error('Error fetching health status:', error);
    } finally {
      setLoading(false);
    }
  }, [onConnectionIssue]);

  // Check individual connection
  const checkConnection = async (connectionId: string) => {
    try {
      setChecking(connectionId);

      const response = await fetch(`/api/basiq/connections/${connectionId}/health`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Health check failed');

      const health = await response.json();

      setHealthStatuses((prev) =>
        prev.map((status) =>
          status.connection.id === connectionId
            ? { ...status, health, lastChecked: new Date() }
            : status,
        ),
      );
    } catch (error) {
      logger.error('Health check error:', error);
    } finally {
      setChecking(null);
    }
  };

  // Fix connection issue
  const fixConnection = async (connectionId: string, action: 'refresh' | 'reauthorize') => {
    try {
      setChecking(connectionId);

      if (action === 'refresh') {
        const response = await fetch(`/api/basiq/connections/${connectionId}/refresh`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Refresh failed');
      } else {
        // Reauthorization would trigger OAuth flow
        window.location.href = `/banking/reauthorize?connectionId=${connectionId}`;
        return;
      }

      // Recheck health after fix
      await checkConnection(connectionId);
    } catch (error) {
      logger.error('Fix connection error:', error);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchConnectionHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchConnectionHealth]);

  // Initial fetch
  useEffect(() => {
    fetchConnectionHealth();
  }, [fetchConnectionHealth]);

  // Get overall health status
  const overallHealth = healthStatuses.reduce(
    (acc, status) => {
      if (status.health.status === 'healthy') acc.healthy++;
      else if (status.health.status === 'warning') acc.warning++;
      else acc.unhealthy++;
      return acc;
    },
    { healthy: 0, warning: 0, unhealthy: 0 },
  );

  if (loading) {
    return (
      <Card className={className}>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Connection Health Monitor</h3>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Auto-refresh</span>
            </label>
            <button
              onClick={fetchConnectionHealth}
              className="btn btn-sm btn-secondary"
            >
              Check All
            </button>
          </div>
        </div>

        {/* Health Overview */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{overallHealth.healthy}</div>
            <div className="text-sm text-green-700">Healthy</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{overallHealth.warning}</div>
            <div className="text-sm text-yellow-700">Warning</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{overallHealth.unhealthy}</div>
            <div className="text-sm text-red-700">Unhealthy</div>
          </div>
        </div>

        {/* Connection List */}
        <div className="space-y-3">
          {healthStatuses.map((status) => (
            <div
              key={status.connection.id}
              className={`p-4 border rounded-lg ${
                status.health.status === 'healthy'
                  ? 'border-green-200 bg-green-50'
                  : status.health.status === 'warning'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <HealthIndicator status={status.health.status} />
                  <div>
                    <h4 className="font-medium">{status.connection.institution.name}</h4>
                    <p className="text-sm text-gray-600">
                      Last checked: {status.lastChecked.toLocaleTimeString('en-AU')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => checkConnection(status.connection.id)}
                    className="btn btn-sm btn-secondary"
                    disabled={checking === status.connection.id}
                  >
                    {checking === status.connection.id ? <span className="spinner" /> : 'Check Now'}
                  </button>
                  <button
                    onClick={() =>
                      setShowDetails(
                        showDetails === status.connection.id ? null : status.connection.id,
                      )
                    }
                    className="btn btn-sm btn-secondary"
                  >
                    {showDetails === status.connection.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {/* Connection Details */}
              {showDetails === status.connection.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium capitalize">{status.health.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Sync:</span>
                      <span className="ml-2 font-medium">
                        {new Date(status.connection.lastRefreshed).toLocaleString('en-AU')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Account Count:</span>
                      <span className="ml-2 font-medium">{status.health.accountCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sync Frequency:</span>
                      <span className="ml-2 font-medium">
                        {status.health.syncFrequency || 'Daily'}
                      </span>
                    </div>
                  </div>

                  {/* Issues */}
                  {status.health.issues && status.health.issues.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Issues:</h5>
                      <ul className="space-y-1">
                        {status.health.issues.map((issue, index) => (
                          <li
                            key={index}
                            className="text-sm text-red-600 flex items-start"
                          >
                            <span className="mr-2">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {status.health.recommendations && status.health.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Recommendations:</h5>
                      <ul className="space-y-1">
                        {status.health.recommendations.map((rec, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-600 flex items-start"
                          >
                            <span className="mr-2">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {status.health.status !== 'healthy' && (
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => fixConnection(status.connection.id, 'refresh')}
                        className="btn btn-sm btn-primary"
                      >
                        Refresh Connection
                      </button>
                      {status.health.requiresReauth && (
                        <button
                          onClick={() => fixConnection(status.connection.id, 'reauthorize')}
                          className="btn btn-sm btn-warning"
                        >
                          Reauthorize
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {healthStatuses.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <p>No bank connections to monitor</p>
            <p className="text-sm mt-2">Connect your banks to monitor their health status</p>
          </div>
        )}
      </Card>

      {/* Health Tips */}
      <Card title="Connection Health Tips">
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <span className="text-green-600 mt-0.5">✓</span>
            <div>
              <p className="font-medium text-sm">Keep credentials up to date</p>
              <p className="text-sm text-gray-600">
                Update your banking passwords in the app when you change them online
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-green-600 mt-0.5">✓</span>
            <div>
              <p className="font-medium text-sm">Regular syncing</p>
              <p className="text-sm text-gray-600">
                Connections sync automatically daily, but you can refresh manually anytime
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-green-600 mt-0.5">✓</span>
            <div>
              <p className="font-medium text-sm">Monitor for issues</p>
              <p className="text-sm text-gray-600">
                Check this dashboard regularly to ensure all connections are healthy
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Health Indicator Component
const HealthIndicator: React.FC<{ status: 'healthy' | 'warning' | 'unhealthy' }> = ({ status }) => {
  const indicators = {
    healthy: {
      color: 'text-green-600',
      bgColor: 'bg-green-600',
      icon: '✓',
      pulse: false,
    },
    warning: {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-600',
      icon: '!',
      pulse: true,
    },
    unhealthy: {
      color: 'text-red-600',
      bgColor: 'bg-red-600',
      icon: '✗',
      pulse: true,
    },
  };

  const indicator = indicators[status];

  return (
    <div className="relative">
      <div
        className={`w-10 h-10 rounded-full ${indicator.bgColor} bg-opacity-20 flex items-center justify-center`}
      >
        <span className={`${indicator.color} font-bold text-lg`}>{indicator.icon}</span>
      </div>
      {indicator.pulse && (
        <span
          className={`absolute top-0 right-0 h-3 w-3 ${indicator.bgColor} rounded-full animate-pulse`}
        />
      )}
    </div>
  );
};

export default ConnectionHealthMonitor;
