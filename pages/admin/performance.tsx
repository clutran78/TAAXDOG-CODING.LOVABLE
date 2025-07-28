import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { performanceMonitor } from '../../lib/monitoring/performance';

interface PerformanceMetrics {
  database: any;
  api: any;
  application: any;
  timestamp: string;
}

interface WebVitalsSummary {
  CLS?: number;
  FCP?: number;
  FID?: number;
  LCP?: number;
  TTFB?: number;
  scores: {
    CLS: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    FCP: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    FID: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    LCP: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    TTFB: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  };
}

export default function PerformanceDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [webVitals, setWebVitals] = useState<WebVitalsSummary | null>(null);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  useEffect(() => {
    fetchMetrics();
    updateClientMetrics();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        updateClientMetrics();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const updateClientMetrics = () => {
    const vitals = performanceMonitor.getWebVitalsSummary();
    const data = performanceMonitor.getData();
    setWebVitals(vitals);
    setClientData(data);
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading performance metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>Error loading metrics: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) return null;

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <>
      <Head>
        <title>Performance Monitoring - TAAXDOG Admin</title>
      </Head>

      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Performance Monitoring</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <button
              onClick={() => {
                fetchMetrics();
                updateClientMetrics();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Web Vitals Section */}
        {webVitals && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Core Web Vitals</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">CLS</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {webVitals.CLS !== undefined ? webVitals.CLS.toFixed(3) : 'N/A'}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(webVitals.scores.CLS)}`}
                  >
                    {webVitals.scores.CLS}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">FCP</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {webVitals.FCP !== undefined ? `${Math.round(webVitals.FCP)}ms` : 'N/A'}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(webVitals.scores.FCP)}`}
                  >
                    {webVitals.scores.FCP}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">FID</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {webVitals.FID !== undefined ? `${Math.round(webVitals.FID)}ms` : 'N/A'}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(webVitals.scores.FID)}`}
                  >
                    {webVitals.scores.FID}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">LCP</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {webVitals.LCP !== undefined ? `${Math.round(webVitals.LCP)}ms` : 'N/A'}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(webVitals.scores.LCP)}`}
                  >
                    {webVitals.scores.LCP}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">TTFB</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {webVitals.TTFB !== undefined ? `${Math.round(webVitals.TTFB)}ms` : 'N/A'}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(webVitals.scores.TTFB)}`}
                  >
                    {webVitals.scores.TTFB}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Database Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Queries</span>
                  <span className="font-semibold">{metrics.database.totalQueries}</span>
                </div>
                <div className="flex justify-between">
                  <span>Slow Queries</span>
                  <span className="font-semibold text-red-600">{metrics.database.slowQueries}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Query Time</span>
                  <span className="font-semibold">
                    {metrics.database.avgQueryDuration.toFixed(2)}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Requests</span>
                  <span className="font-semibold">{metrics.api.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recent Errors</span>
                  <span className="font-semibold text-red-600">{metrics.api.recentErrors}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response Time</span>
                  <span className="font-semibold">{metrics.api.avgResponseTime.toFixed(2)}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Memory Usage</span>
                  <span className="font-semibold">
                    {(
                      (metrics.application.current?.memoryUsage.heapUsed || 0) /
                      1024 /
                      1024
                    ).toFixed(2)}
                    MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CPU Usage</span>
                  <span className="font-semibold">
                    {(
                      (metrics.application.current?.cpuUsage.user || 0) +
                      (metrics.application.current?.cpuUsage.system || 0)
                    ).toFixed(2)}
                    s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Trend</span>
                  <span
                    className={`font-semibold ${
                      metrics.application.trends.memory === 'increasing'
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {metrics.application.trends.memory}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs
          defaultValue="database"
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="frontend">Frontend</TabsTrigger>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
          </TabsList>

          <TabsContent
            value="database"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Slow Query Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.database.slowQueryPatterns.map((pattern: any, idx: number) => (
                    <div
                      key={idx}
                      className="border-b pb-4"
                    >
                      <div className="font-mono text-sm mb-2">{pattern.pattern}</div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>Count: {pattern.count}</span>
                        <span>Avg Duration: {pattern.avgDuration.toFixed(2)}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="api"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <BarChart data={metrics.api.slowestEndpoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="endpoint"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="avgDuration"
                      fill="#3B82F6"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error-Prone Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.api.errorProneEndpoints.map((endpoint: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center"
                    >
                      <span className="font-mono text-sm">{endpoint.endpoint}</span>
                      <span className="text-red-600 font-semibold">
                        {(endpoint.errorRate * 100).toFixed(1)}% error rate
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="system"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <LineChart data={metrics.application.systemHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => `${(value / 1024 / 1024).toFixed(2)}MB`}
                    />
                    <Line
                      type="monotone"
                      dataKey="memoryUsage.heapUsed"
                      stroke="#3B82F6"
                      name="Heap Used"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="cache"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.application.cacheMetrics.map((cache: any) => (
                    <div
                      key={cache.name}
                      className="border-b pb-4"
                    >
                      <h4 className="font-semibold mb-2">{cache.name}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Hit Rate: </span>
                          <span className="font-semibold">{(cache.hitRate * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Size: </span>
                          <span className="font-semibold">{cache.size}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Hits: </span>
                          <span className="font-semibold text-green-600">{cache.hits}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Misses: </span>
                          <span className="font-semibold text-red-600">{cache.misses}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="frontend"
            className="space-y-6"
          >
            {clientData && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(clientData.customMetrics || {}).map(([key, value]) => (
                        <div
                          key={key}
                          className="border rounded-lg p-4"
                        >
                          <h3 className="text-sm font-medium text-gray-500">{key}</h3>
                          <p className="text-xl font-bold text-gray-900">
                            {typeof value === 'number'
                              ? key.includes('Time') || key.includes('duration')
                                ? `${value}ms`
                                : value
                              : value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {clientData.resourceTimings && clientData.resourceTimings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Largest Resources</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Resource
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Size
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {clientData.resourceTimings
                              .slice(0, 10)
                              .map((resource: any, index: number) => (
                                <tr key={index}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {resource.name.split('/').pop() || resource.name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {resource.initiatorType}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {(resource.transferSize / 1024).toFixed(1)} KB
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {Math.round(resource.duration)} ms
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent
            value="interactions"
            className="space-y-6"
          >
            {clientData &&
              clientData.userInteractions &&
              clientData.userInteractions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent User Interactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Target
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Time
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clientData.userInteractions
                            .slice(-20)
                            .reverse()
                            .map((interaction: any, index: number) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {interaction.type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {interaction.target}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(interaction.timestamp).toLocaleTimeString()}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
