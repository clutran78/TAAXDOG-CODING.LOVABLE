import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/auth/validation';
import { FormInput, FormMessage, useFormValidation } from '@/components/ui/FormComponents';
import { InlineLoader } from '@/components/ui/SkeletonLoaders';
import { logger } from '@/lib/logger';

export default function ForgotPasswordPage() {
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Form validation
  const { values, errors, touched, isSubmitting, getFieldProps, handleSubmit, resetForm } =
    useFormValidation<ForgotPasswordInput>(forgotPasswordSchema, {
      email: '',
    });

  const onSubmit = async (formValues: ForgotPasswordInput) => {
    setServerError('');
    setServerMessage('');

    try {
      logger.info('[ForgotPassword] Requesting reset for:', formValues.email);

      const response = await fetch('/api/auth/simple-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formValues.email }),
      });

      const data = await response.json();
      logger.info('[ForgotPassword] Response:', { status: response.status, data });

      if (response.ok) {
        setSubmitted(true);
        setServerMessage(
          data.message ||
            "If an account exists with this email, you'll receive password reset instructions shortly.",
        );

        // In development, show the reset URL
        if (data.debug?.resetUrl) {
          logger.debug('[ForgotPassword] Debug - Reset URL:', data.debug.resetUrl);
          setServerMessage((message) => message + '\n\nDEBUG: Check console for reset link.');
        }
      } else {
        // Handle specific error cases
        if (response.status === 404) {
          // Don't reveal if email exists or not for security
          setSubmitted(true);
          setServerMessage(
            "If an account exists with this email, you'll receive password reset instructions shortly.",
          );
        } else if (response.status === 429) {
          setServerError('Too many reset attempts. Please wait a few minutes before trying again.');
        } else {
          setServerError(data.message || 'Unable to process request. Please try again.');
        }
      }
    } catch (err: any) {
      logger.error('[ForgotPassword] Error:', err);
      setServerError('A network error occurred. Please check your connection and try again.');
    }
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setServerMessage('');
    setServerError('');
    resetForm();
  };

  return (
    <>
      <Head>
        <title>Forgot Password - TaxReturnPro</title>
        <meta
          name="description"
          content="Reset your TaxReturnPro account password"
        />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-3xl font-bold">TRP</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in instead
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {!submitted ? (
              <>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 text-center">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>

                <form
                  className="space-y-6"
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  aria-label="Password reset form"
                >
                  {/* Server error message */}
                  {serverError && (
                    <FormMessage
                      type="error"
                      message={serverError}
                      onClose={() => setServerError('')}
                    />
                  )}

                  {/* Email field */}
                  <FormInput
                    {...getFieldProps('email')}
                    id="email"
                    type="email"
                    label="Email address"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    autoFocus
                    hint={
                      !touched.email
                        ? 'Enter the email address associated with your account'
                        : undefined
                    }
                  />

                  {/* Submit button */}
                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label={
                        isSubmitting ? 'Sending reset instructions...' : 'Send reset instructions'
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <InlineLoader
                            size="sm"
                            className="mr-2"
                          />
                          Sending instructions...
                        </>
                      ) : (
                        'Send reset instructions'
                      )}
                    </button>
                  </div>

                  {/* Back to login link */}
                  <div className="text-center">
                    <Link
                      href="/auth/login"
                      className="text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:underline"
                      tabIndex={0}
                    >
                      ← Back to login
                    </Link>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center">
                {/* Success icon */}
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                {/* Success message */}
                <h3 className="mt-4 text-lg font-medium text-gray-900">Check your email</h3>
                <div className="mt-2 text-sm text-gray-600">
                  <p>{serverMessage}</p>
                </div>

                {/* Additional instructions */}
                <div className="mt-6 space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-left">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Next steps:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Check your email inbox</li>
                      <li>Click the reset link in the email</li>
                      <li>Create a new secure password</li>
                    </ol>
                  </div>

                  <div className="text-sm text-gray-500">
                    <p className="mb-2">
                      Didn't receive the email? Check your spam folder or wait a few minutes.
                    </p>
                    <p>The reset link will expire in 1 hour for security reasons.</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleTryAgain}
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Try with a different email
                  </button>

                  <Link
                    href="/auth/login"
                    className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-center"
                  >
                    Back to login
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Help section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Still having trouble?{' '}
              <Link
                href="/support"
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
              >
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
