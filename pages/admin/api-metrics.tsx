import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { RefreshCw, AlertCircle, Activity, Clock, TrendingUp } from 'lucide-react';

interface EndpointMetric {
  key: string;
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errorRate: number;
  successRate: number;
  recentErrors: Array<{
    timestamp: string;
    error: string;
    statusCode: number;
    userId?: string;
  }>;
  statusCodeDistribution: Record<number, number>;
}

interface MetricsData {
  summary: {
    totalEndpoints: number;
    totalRequests: number;
    totalFailures: number;
    overallErrorRate: number;
    timestamp: string;
  };
  endpoints: EndpointMetric[];
}

export default function ApiMetricsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      fetchMetrics();
    }
  }, [session, status, router]);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await fetch('/api/monitoring/metrics');

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const resetMetrics = async (endpoint?: string, method?: string) => {
    if (
      !confirm(
        `Are you sure you want to reset ${endpoint ? `metrics for ${endpoint}` : 'all metrics'}?`,
      )
    ) {
      return;
    }

    try {
      const params = new URLSearchParams({ action: 'reset' });
      if (endpoint) params.append('endpoint', endpoint);
      if (method) params.append('method', method);

      const response = await fetch(`/api/monitoring/metrics?${params}`);

      if (!response.ok) {
        throw new Error('Failed to reset metrics');
      }

      await fetchMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset metrics');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">API Metrics Dashboard</h1>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => resetMetrics()}
              variant="destructive"
              size="sm"
            >
              Reset All
            </Button>
          </div>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="mb-6"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}

        {metrics && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Endpoints</p>
                    <p className="text-2xl font-bold">{metrics.summary.totalEndpoints}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Requests</p>
                    <p className="text-2xl font-bold">
                      {metrics.summary.totalRequests.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Failed Requests</p>
                    <p className="text-2xl font-bold">
                      {metrics.summary.totalFailures.toLocaleString()}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Error Rate</p>
                    <p className="text-2xl font-bold">{metrics.summary.overallErrorRate}%</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </Card>
            </div>

            {/* Endpoints Table */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Endpoint Metrics</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Endpoint
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Requests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Success Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recent Errors
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metrics.endpoints.map((endpoint) => (
                        <tr
                          key={endpoint.key}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {endpoint.endpoint}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Badge
                              variant={
                                endpoint.method === 'GET'
                                  ? 'default'
                                  : endpoint.method === 'POST'
                                    ? 'success'
                                    : endpoint.method === 'DELETE'
                                      ? 'destructive'
                                      : 'warning'
                              }
                            >
                              {endpoint.method}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {endpoint.totalRequests.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`font-medium ${
                                endpoint.successRate >= 95
                                  ? 'text-green-600'
                                  : endpoint.successRate >= 80
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {endpoint.successRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {endpoint.averageDuration}ms
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {endpoint.recentErrors.length > 0 && (
                              <Badge variant="destructive">{endpoint.recentErrors.length}</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button
                              onClick={() => resetMetrics(endpoint.endpoint, endpoint.method)}
                              variant="ghost"
                              size="sm"
                            >
                              Reset
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
