import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { logger } from '@/lib/logger';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface SecurityMetrics {
  timestamp: string;
  overallStatus: 'secure' | 'at_risk' | 'vulnerable';
  securityScore: number;
  activeThreats: number;
  failedLogins: number;
  suspiciousActivities: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentEvents: Array<{
    id: string;
    timestamp: string;
    type: string;
    severity: string;
    description: string;
    user?: string;
    ipAddress?: string;
  }>;
  compliance: {
    framework: string;
    score: number;
    status: string;
  }[];
  recommendations: string[];
}

export default function SecurityDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchSecurityMetrics();

    const interval = setInterval(() => {
      fetchSecurityMetrics();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchSecurityMetrics = async () => {
    try {
      const response = await fetch('/api/admin/security/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data);
      setLastUpdate(new Date());
    } catch (error) {
      logger.error('Error fetching security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSecurityScan = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/security/scan', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Security scan failed');

      await fetchSecurityMetrics();
    } catch (error) {
      logger.error('Error running security scan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-gray-600">Failed to load security metrics</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'secure':
        return 'text-green-600 bg-green-100';
      case 'at_risk':
        return 'text-yellow-600 bg-yellow-100';
      case 'vulnerable':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700 bg-red-100';
      case 'high':
        return 'text-orange-700 bg-orange-100';
      case 'medium':
        return 'text-yellow-700 bg-yellow-100';
      case 'low':
        return 'text-blue-700 bg-blue-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Last updated: {format(lastUpdate, 'yyyy-MM-dd HH:mm:ss')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value={30000}>Refresh: 30s</option>
                <option value={60000}>Refresh: 1m</option>
                <option value={300000}>Refresh: 5m</option>
              </select>
              <button
                onClick={runSecurityScan}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Run Security Scan
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Overall Security Status</h2>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(metrics.overallStatus)}`}
                >
                  {metrics.overallStatus.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(metrics.securityScore)}`}>
                {metrics.securityScore}
              </div>
              <p className="text-sm text-gray-500 mt-1">Security Score</p>
            </div>
          </div>

          {/* Threat Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationCircleIcon className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-2xl font-semibold text-red-900">{metrics.activeThreats}</p>
                  <p className="text-sm text-red-700">Active Threats</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <LockClosedIcon className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-2xl font-semibold text-orange-900">{metrics.failedLogins}</p>
                  <p className="text-sm text-orange-700">Failed Logins</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-2xl font-semibold text-yellow-900">
                    {metrics.suspiciousActivities}
                  </p>
                  <p className="text-sm text-yellow-700">Suspicious Activities</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-2xl font-semibold text-blue-900">
                    {metrics.vulnerabilities.critical + metrics.vulnerabilities.high}
                  </p>
                  <p className="text-sm text-blue-700">Critical Vulnerabilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Security Events */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Security Events</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {metrics.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-l-4 border-gray-200 pl-4 py-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{event.description}</p>
                      <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                        <span>{format(new Date(event.timestamp), 'HH:mm:ss')}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded ${getSeverityColor(event.severity)}`}
                        >
                          {event.severity}
                        </span>
                        {event.user && <span>User: {event.user}</span>}
                        {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {metrics.recentEvents.length === 0 && (
                <p className="text-gray-500 text-center py-8">No recent security events</p>
              )}
            </div>
          </div>

          {/* Vulnerabilities Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vulnerability Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Critical</span>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-red-600 mr-2">
                    {metrics.vulnerabilities.critical}
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${Math.min(metrics.vulnerabilities.critical * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">High</span>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-orange-600 mr-2">
                    {metrics.vulnerabilities.high}
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{ width: `${Math.min(metrics.vulnerabilities.high * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Medium</span>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-yellow-600 mr-2">
                    {metrics.vulnerabilities.medium}
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{ width: `${Math.min(metrics.vulnerabilities.medium * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Low</span>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-blue-600 mr-2">
                    {metrics.vulnerabilities.low}
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(metrics.vulnerabilities.low * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics.compliance.map((framework) => (
              <div
                key={framework.framework}
                className="border rounded-lg p-4"
              >
                <h4 className="font-medium text-gray-900">{framework.framework}</h4>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-3xl font-bold ${getScoreColor(framework.score)}`}>
                    {framework.score}%
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(framework.status)}`}
                  >
                    {framework.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {metrics.recommendations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">Security Recommendations</h3>
            <ul className="space-y-2">
              {metrics.recommendations.map((recommendation, index) => (
                <li
                  key={index}
                  className="flex items-start"
                >
                  <CheckCircleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm text-yellow-800">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session || session.user.role !== 'ADMIN') {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};
