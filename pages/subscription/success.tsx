import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function SubscriptionSuccess() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { session_id } = router.query;
    
    if (session_id && typeof session_id === 'string') {
      // Verify the session and update subscription status
      verifyCheckoutSession(session_id);
    } else {
      setLoading(false);
    }
  }, [router.query]);

  const verifyCheckoutSession = async (sessionId: string) => {
    try {
      // In a production app, you would verify the session on the backend
      // For now, we'll just mark as successful
      setLoading(false);
    } catch (err) {
      setError('Failed to verify subscription');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-gray-600">Verifying your subscription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-medium text-gray-900">Subscription Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            href="/subscription/plans"
            className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg
              className="h-10 w-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Welcome to TAAX!
          </h2>
          
          <p className="mt-2 text-gray-600">
            Your subscription has been activated successfully.
          </p>

          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900">What's next?</h3>
            <ul className="mt-2 text-sm text-blue-700 space-y-1 text-left">
              <li>• Complete your tax profile</li>
              <li>• Connect your bank accounts</li>
              <li>• Upload tax documents</li>
              <li>• Start preparing your tax return</li>
            </ul>
          </div>

          <div className="mt-8 space-y-3">
            <Link
              href="/dashboard"
              className="w-full block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center"
            >
              Go to Dashboard
            </Link>
            
            <Link
              href="/account/subscription"
              className="w-full block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-center"
            >
              Manage Subscription
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            You'll receive a confirmation email with your tax invoice shortly.
          </p>
        </div>
      </div>
    </div>
  );
}