import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

const errors: Record<string, { title: string; message: string }> = {
  Configuration: {
    title: 'Configuration Error',
    message: 'There is a problem with the server configuration. Please contact support.',
  },
  AccessDenied: {
    title: 'Access Denied',
    message: 'You do not have permission to sign in.',
  },
  Verification: {
    title: 'Verification Error',
    message: 'The verification token has expired or has already been used.',
  },
  OAuthSignin: {
    title: 'OAuth Sign-in Error',
    message: 'There was an error constructing the authorization URL.',
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    message: 'There was an error handling the OAuth response.',
  },
  OAuthCreateAccount: {
    title: 'OAuth Account Creation Error',
    message: 'Could not create OAuth provider user in the database.',
  },
  EmailCreateAccount: {
    title: 'Email Account Creation Error',
    message: 'Could not create email provider user in the database.',
  },
  Callback: {
    title: 'Callback Error',
    message: 'There was an error in the OAuth callback handler route.',
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    message: 'To confirm your identity, sign in with the same account you used originally.',
  },
  EmailSignin: {
    title: 'Email Sign-in Error',
    message: 'The email could not be sent. Please try again later.',
  },
  CredentialsSignin: {
    title: 'Sign-in Error',
    message: 'The sign in credentials are incorrect. Please try again.',
  },
  Default: {
    title: 'Authentication Error',
    message: 'An error occurred during authentication. Please try again.',
  },
};

export default function AuthErrorPage() {
  const router = useRouter();
  const { error } = router.query;
  const errorType = error && typeof error === 'string' ? error : 'Default';
  const errorInfo = errors[errorType] || errors.Default;

  return (
    <>
      <Head>
        <title>Authentication Error - TaxReturnPro</title>
        <meta
          name="description"
          content="Authentication error"
        />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">{errorInfo.title}</h2>
              <p className="mt-2 text-gray-600">{errorInfo.message}</p>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/auth/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Again
              </Link>
              <Link
                href="/"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Home
              </Link>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>If this problem persists, please contact support at</p>
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
