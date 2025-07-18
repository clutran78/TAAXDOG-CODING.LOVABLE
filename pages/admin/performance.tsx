import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceMetrics {
  database: any;
  api: any;
  application: any;
  timestamp: string;
}

export default function PerformanceDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

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
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

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
                  <span className="font-semibold">{metrics.database.avgQueryDuration.toFixed(2)}ms</span>
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
                    {((metrics.application.current?.memoryUsage.heapUsed || 0) / 1024 / 1024).toFixed(2)}MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CPU Usage</span>
                  <span className="font-semibold">
                    {((metrics.application.current?.cpuUsage.user || 0) + 
                      (metrics.application.current?.cpuUsage.system || 0)).toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Trend</span>
                  <span className={`font-semibold ${
                    metrics.application.trends.memory === 'increasing' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {metrics.application.trends.memory}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="database" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Slow Query Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.database.slowQueryPatterns.map((pattern: any, idx: number) => (
                    <div key={idx} className="border-b pb-4">
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

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.api.slowestEndpoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgDuration" fill="#3B82F6" />
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
                    <div key={idx} className="flex justify-between items-center">
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

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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

          <TabsContent value="cache" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.application.cacheMetrics.map((cache: any) => (
                    <div key={cache.name} className="border-b pb-4">
                      <h4 className="font-semibold mb-2">{cache.name}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Hit Rate: </span>
                          <span className="font-semibold">
                            {(cache.hitRate * 100).toFixed(1)}%
                          </span>
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
        </Tabs>
      </div>
    </>
  );
}