import React, { useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useSession, signIn, signOut } from 'next-auth/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FaFlask, FaServer, FaLock, FaPalette, FaDatabase, 
  FaChartBar, FaMobile, FaBell, FaFileAlt, FaRocket,
  FaCheckCircle, FaTimesCircle, FaSpinner, FaExclamationTriangle
} from 'react-icons/fa';

// Import UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/dashboard/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  SkeletonCard, 
  SkeletonText, 
  SkeletonButton, 
  SkeletonAvatar,
  SkeletonTable,
  SkeletonForm,
  SkeletonDashboard 
} from '@/components/ui/SkeletonLoaders';
import InsightsDashboard from '@/components/insights/InsightsDashboard';
import MobileDashboard from '@/components/mobile/MobileDashboard';

// Types
interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  duration?: number;
}

interface ApiTest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

// Development test page (only available in development)
const DevTestPage: React.FC = () => {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'ui' | 'api' | 'auth' | 'database'>('ui');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // API test configurations
  const apiTests: ApiTest[] = [
    // Auth endpoints
    { name: 'Login', endpoint: '/api/auth/signin', method: 'POST', body: { email: 'test@example.com', password: 'Test123!' } },
    { name: 'Logout', endpoint: '/api/auth/signout', method: 'POST' },
    { name: 'Session', endpoint: '/api/auth/session', method: 'GET' },
    { name: 'Change Password', endpoint: '/api/auth/change-password', method: 'POST', body: { currentPassword: 'old', newPassword: 'new' } },
    
    // User endpoints
    { name: 'Get Profile', endpoint: '/api/user/profile', method: 'GET' },
    { name: 'Update Profile', endpoint: '/api/user/profile', method: 'PUT', body: { name: 'Test User' } },
    
    // Banking endpoints
    { name: 'Bank Connections', endpoint: '/api/banking/connections', method: 'GET' },
    { name: 'Sync Accounts', endpoint: '/api/banking/sync', method: 'POST' },
    
    // AI endpoints
    { name: 'Get Insights', endpoint: '/api/ai/insights', method: 'GET' },
    { name: 'Generate Analysis', endpoint: '/api/ai/insights', method: 'POST', body: { type: 'cashFlow' } },
    
    // Transaction endpoints
    { name: 'Get Transactions', endpoint: '/api/transactions', method: 'GET' },
    { name: 'Create Transaction', endpoint: '/api/transactions', method: 'POST', body: { amount: 100, description: 'Test' } },
    
    // Subscription endpoints
    { name: 'Get Subscription', endpoint: '/api/stripe/subscription', method: 'GET' },
    { name: 'Get Plans', endpoint: '/api/stripe/plans', method: 'GET' },
  ];

  // Run API test
  const runApiTest = async (test: ApiTest): Promise<TestResult> => {
    const start = Date.now();
    const result: TestResult = {
      name: test.name,
      status: 'running',
    };

    try {
      const response = await fetch(test.endpoint, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          ...test.headers,
        },
        body: test.body ? JSON.stringify(test.body) : undefined,
      });

      const duration = Date.now() - start;

      if (response.ok) {
        const data = await response.json();
        result.status = 'success';
        result.message = `${response.status} - ${JSON.stringify(data).substring(0, 100)}...`;
        result.duration = duration;
      } else {
        const error = await response.text();
        result.status = 'failed';
        result.message = `${response.status} - ${error.substring(0, 100)}...`;
        result.duration = duration;
      }
    } catch (error) {
      result.status = 'failed';
      result.message = error instanceof Error ? error.message : 'Unknown error';
      result.duration = Date.now() - start;
    }

    return result;
  };

  // Run all API tests
  const runAllApiTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    for (const test of apiTests) {
      setTestResults(prev => [...prev, { name: test.name, status: 'running' }]);
      
      const result = await runApiTest(test);
      
      setTestResults(prev => 
        prev.map(r => r.name === test.name ? result : r)
      );
    }

    setIsRunningTests(false);
  };

  // Test authentication flows
  const testAuthFlows = async () => {
    setIsRunningTests(true);
    const results: TestResult[] = [];

    // Test 1: Check current session
    results.push({
      name: 'Current Session',
      status: session ? 'success' : 'failed',
      message: session ? `Logged in as ${session.user?.email}` : 'Not logged in',
    });

    // Test 2: Test protected route access
    try {
      const protectedResponse = await fetch('/api/user/profile');
      results.push({
        name: 'Protected Route Access',
        status: protectedResponse.ok ? 'success' : 'failed',
        message: `Status: ${protectedResponse.status}`,
      });
    } catch (error) {
      results.push({
        name: 'Protected Route Access',
        status: 'failed',
        message: 'Failed to access protected route',
      });
    }

    // Test 3: Rate limiting
    const rateLimitPromises = Array.from({ length: 10 }, () => 
      fetch('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email: 'test@test.com' }) })
    );
    
    try {
      const rateLimitResponses = await Promise.all(rateLimitPromises);
      const rateLimited = rateLimitResponses.some(r => r.status === 429);
      results.push({
        name: 'Rate Limiting',
        status: rateLimited ? 'success' : 'failed',
        message: rateLimited ? 'Rate limiting is working' : 'Rate limiting not triggered',
      });
    } catch (error) {
      results.push({
        name: 'Rate Limiting',
        status: 'failed',
        message: 'Rate limit test failed',
      });
    }

    setTestResults(results);
    setIsRunningTests(false);
  };

  // Test database operations
  const testDatabase = async () => {
    setIsRunningTests(true);
    
    try {
      const response = await fetch('/api/test/database', { method: 'POST' });
      const results = await response.json();
      
      setTestResults(results.tests || []);
    } catch (error) {
      setTestResults([{
        name: 'Database Test',
        status: 'failed',
        message: 'Failed to run database tests',
      }]);
    }
    
    setIsRunningTests(false);
  };

  // Component showcase
  const showComponent = (componentName: string) => {
    setSelectedComponent(componentName);
    setShowModal(true);
  };

  // Render test status icon
  const renderStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <FaExclamationTriangle className="text-gray-400" />;
      case 'running':
        return <FaSpinner className="text-blue-500 animate-spin" />;
      case 'success':
        return <FaCheckCircle className="text-green-500" />;
      case 'failed':
        return <FaTimesCircle className="text-red-500" />;
    }
  };

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only available in development mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <ToastContainer position="top-right" />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <FaFlask className="text-2xl text-blue-500 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Development Test Suite
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Environment: {process.env.NODE_ENV}
              </span>
              {session && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  User: {session.user?.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'ui', name: 'UI Components', icon: FaPalette },
              { id: 'api', name: 'API Endpoints', icon: FaServer },
              { id: 'auth', name: 'Authentication', icon: FaLock },
              { id: 'database', name: 'Database', icon: FaDatabase },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm flex items-center
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <tab.icon className="mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* UI Components Tab */}
        {activeTab === 'ui' && (
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              UI Component Showcase
            </h2>

            {/* Buttons */}
            <Card title="Buttons" icon={<FaPalette />}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="danger">Danger Button</Button>
                  <Button disabled>Disabled Button</Button>
                  <Button loading>Loading Button</Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
            </Card>

            {/* Skeleton Loaders */}
            <Card title="Skeleton Loaders" icon={<FaSpinner />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Card Skeleton</h4>
                  <SkeletonCard />
                </div>
                <div>
                  <h4 className="font-medium mb-3">Text Skeleton</h4>
                  <SkeletonText lines={3} />
                </div>
                <div>
                  <h4 className="font-medium mb-3">Button Skeleton</h4>
                  <div className="flex gap-2">
                    <SkeletonButton />
                    <SkeletonButton size="sm" />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Avatar Skeleton</h4>
                  <div className="flex gap-2">
                    <SkeletonAvatar />
                    <SkeletonAvatar size="lg" />
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <h4 className="font-medium mb-3">Table Skeleton</h4>
                <SkeletonTable rows={3} columns={4} />
              </div>
            </Card>

            {/* Mobile Components */}
            <Card title="Mobile Components" icon={<FaMobile />}>
              <div className="space-y-4">
                <Button onClick={() => showComponent('mobile-dashboard')}>
                  Show Mobile Dashboard
                </Button>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Responsive mobile-optimized components with touch gestures
                </p>
              </div>
            </Card>

            {/* Insights Dashboard */}
            <Card title="AI Insights Dashboard" icon={<FaChartBar />}>
              <div className="space-y-4">
                <Button onClick={() => showComponent('insights-dashboard')}>
                  Show Insights Dashboard
                </Button>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI-powered financial insights with real-time data
                </p>
              </div>
            </Card>

            {/* Notifications */}
            <Card title="Notifications" icon={<FaBell />}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => toast.success('Success notification!')}>
                    Success Toast
                  </Button>
                  <Button onClick={() => toast.error('Error notification!')}>
                    Error Toast
                  </Button>
                  <Button onClick={() => toast.info('Info notification!')}>
                    Info Toast
                  </Button>
                  <Button onClick={() => toast.warning('Warning notification!')}>
                    Warning Toast
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* API Endpoints Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                API Endpoint Tests
              </h2>
              <Button 
                onClick={runAllApiTests} 
                disabled={isRunningTests}
                loading={isRunningTests}
              >
                Run All Tests
              </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Response
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {apiTests.map((test, index) => {
                    const result = testResults.find(r => r.name === test.name);
                    return (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {test.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {test.endpoint}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            test.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                            test.method === 'POST' ? 'bg-green-100 text-green-800' :
                            test.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {test.method}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center">
                            {result ? renderStatusIcon(result.status) : renderStatusIcon('pending')}
                            {result?.duration && (
                              <span className="ml-2 text-xs text-gray-500">
                                {result.duration}ms
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {result?.message || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Authentication Tab */}
        {activeTab === 'auth' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Authentication Tests
              </h2>
              <Button 
                onClick={testAuthFlows} 
                disabled={isRunningTests}
                loading={isRunningTests}
              >
                Run Auth Tests
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Session */}
              <Card title="Current Session" icon={<FaLock />}>
                <div className="space-y-3">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{' '}
                    {status === 'loading' ? 'Loading...' : status}
                  </p>
                  {session && (
                    <>
                      <p className="text-sm">
                        <span className="font-medium">User:</span>{' '}
                        {session.user?.email}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Role:</span>{' '}
                        {session.user?.role || 'USER'}
                      </p>
                    </>
                  )}
                  <div className="flex gap-3 mt-4">
                    {session ? (
                      <Button onClick={() => signOut()} variant="danger">
                        Sign Out
                      </Button>
                    ) : (
                      <Button onClick={() => signIn()}>
                        Sign In
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Test Results */}
              <Card title="Auth Test Results" icon={<FaCheckCircle />}>
                <div className="space-y-2">
                  {testResults.length === 0 ? (
                    <p className="text-sm text-gray-500">No tests run yet</p>
                  ) : (
                    testResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="text-sm font-medium">{result.name}</span>
                        <div className="flex items-center gap-2">
                          {renderStatusIcon(result.status)}
                          <span className="text-xs text-gray-500">{result.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* OAuth Providers */}
            <Card title="OAuth Providers" icon={<FaRocket />}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button onClick={() => signIn('google')} variant="secondary">
                  Google OAuth
                </Button>
                <Button onClick={() => signIn('credentials')} variant="secondary">
                  Credentials
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Database Tests
              </h2>
              <Button 
                onClick={testDatabase} 
                disabled={isRunningTests}
                loading={isRunningTests}
              >
                Run Database Tests
              </Button>
            </div>

            <Card title="Test Results" icon={<FaDatabase />}>
              <div className="space-y-3">
                {testResults.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Click "Run Database Tests" to test database connectivity, data isolation, and CRUD operations.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          {renderStatusIcon(result.status)}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {result.message}
                          </span>
                          {result.duration && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({result.duration}ms)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Database Info" icon={<FaFileAlt />}>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Provider:</span> PostgreSQL</p>
                <p><span className="font-medium">ORM:</span> Prisma</p>
                <p><span className="font-medium">Connection:</span> {process.env.DATABASE_URL ? 'Configured' : 'Not Configured'}</p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Component Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedComponent || ''}
        size="xl"
      >
        <div className="p-4">
          {selectedComponent === 'mobile-dashboard' && (
            <div className="h-[600px] overflow-auto">
              <MobileDashboard />
            </div>
          )}
          {selectedComponent === 'insights-dashboard' && (
            <div className="h-[600px] overflow-auto">
              <ErrorBoundary>
                <InsightsDashboard />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

// Server-side props to ensure dev only
export const getServerSideProps: GetServerSideProps = async (context) => {
  // Redirect to home in production
  if (process.env.NODE_ENV === 'production') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default DevTestPage;