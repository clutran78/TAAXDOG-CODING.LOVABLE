import { useState } from 'react';
import Head from 'next/head';

export default function GetResetLinkPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/get-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to generate reset link');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Available</h1>
          <p className="text-gray-600">This page is only available in development mode.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Get Reset Link - Development Tool</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Get Password Reset Link</h1>
            <p className="text-sm text-gray-600 mt-2">
              Development tool to generate reset links without sending emails
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="user@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Reset Link'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800 font-medium">✅ Reset link generated!</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm font-medium text-gray-700 mb-2">Reset URL:</p>
                <div className="bg-white p-3 rounded border border-gray-300 break-all">
                  <code className="text-xs">{result.resetUrl}</code>
                </div>
                <p className="text-xs text-gray-500 mt-2">Expires in: {result.expiresIn}</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => navigator.clipboard.writeText(result.resetUrl)}
                  className="flex-1 py-2 px-4 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                >
                  Copy Link
                </button>
                <a
                  href={result.resetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 text-center"
                >
                  Open Link
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
