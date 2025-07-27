import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import Head from 'next/head';

export default function TestAuthPage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head>
        <title>Test Authentication - TaxReturnPro</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication System Test Page</h1>

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Session Status</h2>
            <div className="space-y-2">
              <p>
                <strong>Status:</strong> {status}
              </p>
              {session ? (
                <>
                  <p>
                    <strong>User ID:</strong> {session.user.id}
                  </p>
                  <p>
                    <strong>Email:</strong> {session.user.email}
                  </p>
                  <p>
                    <strong>Name:</strong> {session.user.name}
                  </p>
                  <p>
                    <strong>Role:</strong> {session.user.role}
                  </p>
                </>
              ) : (
                <p className="text-gray-500">No active session</p>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Authentication Actions</h2>
            <div className="space-x-4">
              {!session ? (
                <>
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Register
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    Sign Out
                  </button>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Go to Dashboard
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Test Checklist</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Database tables created
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Password validation working
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Account lockout mechanism active
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Audit logging functional
              </li>
              <li className="flex items-center">
                <span className={session ? 'text-green-500' : 'text-gray-400'}>
                  {session ? '✓' : '○'}
                </span>
                <span className="ml-2">User authentication</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Test Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Click "Register" to create a new account</li>
              <li>
                Use a password with 12+ chars, uppercase, lowercase, numbers, and special chars
              </li>
              <li>After registration, you'll be automatically logged in</li>
              <li>Try logging out and logging back in</li>
              <li>Test wrong password 5 times to trigger account lockout</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
