import { useEffect, useState } from 'react';
import { performanceMonitor } from '../lib/monitoring/performance';
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';
import { useDataFetchTracking } from '../hooks/useDataFetchTracking';

export default function TestMonitoring() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const { trackEvent, startMeasure, endMeasure, setMetric } = usePerformanceTracking({
    componentName: 'TestMonitoring',
    trackRenderTime: true,
    trackMountTime: true,
    trackInteractions: true,
  });
  const { trackQuery, trackMutation } = useDataFetchTracking();

  const addResult = (result: string) => {
    setTestResults((prev) => [...prev, result]);
  };

  useEffect(() => {
    addResult('Component mounted - performance tracking initialized');
  }, []);

  const testWebVitals = () => {
    const vitals = performanceMonitor.getWebVitalsSummary();
    addResult(`Web Vitals: ${JSON.stringify(vitals, null, 2)}`);
  };

  const testCustomMetrics = () => {
    performanceMonitor.setCustomMetric('testMetric', 12345);
    performanceMonitor.setCustomMetric('responseTime', 250);
    addResult('Custom metrics set: testMetric=12345, responseTime=250ms');
  };

  const testInteractionTracking = () => {
    trackEvent('button-click', 'test-button');
    performanceMonitor.trackInteraction('test-interaction', 'manual-test');
    addResult('Interaction tracked: button-click and test-interaction');
  };

  const testMeasurement = async () => {
    startMeasure('testOperation');
    await new Promise((resolve) => setTimeout(resolve, 500));
    endMeasure('testOperation');
    addResult('Measured testOperation: ~500ms');
  };

  const testDataFetch = async () => {
    try {
      await trackQuery('testQuery', async () => {
        const response = await fetch('/api/auth/session');
        return response.json();
      });
      addResult('Data fetch tracked: session query');
    } catch (error) {
      addResult(`Data fetch error: ${error}`);
    }
  };

  const testLongTask = () => {
    addResult('Starting long task...');
    const start = Date.now();
    // Simulate a long task
    while (Date.now() - start < 100) {
      // Busy loop
    }
    addResult('Long task completed (100ms blocking)');
  };

  const getCurrentData = () => {
    const data = performanceMonitor.getData();
    addResult(`Current performance data: ${JSON.stringify(data, null, 2)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Performance Monitoring Test Page</h1>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={testWebVitals}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Web Vitals
            </button>
            <button
              onClick={testCustomMetrics}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test Custom Metrics
            </button>
            <button
              onClick={testInteractionTracking}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Test Interactions
            </button>
            <button
              onClick={testMeasurement}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Test Measurement
            </button>
            <button
              onClick={testDataFetch}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Test Data Fetch
            </button>
            <button
              onClick={testLongTask}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Test Long Task
            </button>
            <button
              onClick={getCurrentData}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Get Current Data
            </button>
            <button
              onClick={() => setTestResults([])}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Clear Results
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <div className="space-y-2">
            {testResults.length === 0 ? (
              <p className="text-gray-500">
                No test results yet. Click the buttons above to test monitoring features.
              </p>
            ) : (
              testResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <pre className="text-sm font-mono whitespace-pre-wrap">{result}</pre>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-600">
          <p>This page tests the following monitoring features:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Core Web Vitals (CLS, FCP, FID, LCP, TTFB)</li>
            <li>Custom performance metrics</li>
            <li>User interaction tracking</li>
            <li>Performance measurements</li>
            <li>Data fetch tracking</li>
            <li>Long task detection</li>
            <li>Component-level performance tracking</li>
          </ul>
          <p className="mt-4">
            Open the browser console to see additional logging. Visit{' '}
            <a
              href="/admin/performance"
              className="text-blue-600 hover:underline"
            >
              /admin/performance
            </a>{' '}
            to view the performance dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
