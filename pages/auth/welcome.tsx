import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useEffect } from 'react';

export default function WelcomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Welcome to TaxReturnPro</title>
        <meta
          name="description"
          content="Welcome to your TaxReturnPro account"
        />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="h-12 w-12 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Welcome to TaxReturnPro, {session?.user?.name || 'Tax Professional'}!
              </h2>
              <p className="mt-2 text-lg text-gray-600">
                Your account has been successfully created.
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Get started with these steps:
              </h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">1</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900">Complete your profile</h4>
                    <p className="text-gray-600">
                      Add your ABN, phone number, and other details for a personalized experience.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">2</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900">Choose your plan</h4>
                    <p className="text-gray-600">
                      Select between TAAX Smart or TAAX Pro to unlock all features.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">3</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900">Start your tax return</h4>
                    <p className="text-gray-600">
                      Use our AI-powered assistant to complete your tax return in minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Link
                href="/dashboard"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/profile"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Complete Profile
              </Link>
            </div>

            <div className="mt-8 text-center text-sm text-gray-600">
              <p>Need help? Contact our support team at</p>
              <a
                href="mailto:support@taxreturnpro.com.au"
                className="text-blue-600 hover:text-blue-500"
              >
                support@taxreturnpro.com.au
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
