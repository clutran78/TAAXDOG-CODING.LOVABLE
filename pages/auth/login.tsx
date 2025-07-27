import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { loginSchema, type LoginInput } from '@/lib/auth/validation';
import { logger } from '@/lib/logger';
import {
  FormInput,
  FormCheckbox,
  FormMessage,
  useFormValidation,
} from '@/components/ui/FormComponents';
import { InlineLoader } from '@/components/ui/SkeletonLoaders';

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Form validation
  const { values, errors, touched, isSubmitting, getFieldProps, handleSubmit, setFieldTouched } =
    useFormValidation<LoginInput>(loginSchema, {
      email: '',
      password: '',
    });

  // Check for success message from registration
  useEffect(() => {
    if (router.query.registered === 'true') {
      setShowSuccess(true);
      // Clear the query param
      router.replace('/auth/login', undefined, { shallow: true });
    }
  }, [router]);

  const onSubmit = async (formValues: LoginInput) => {
    setServerError('');

    try {
      const result = await signIn('credentials', {
        email: formValues.email,
        password: formValues.password,
        redirect: false,
      });

      if (result?.error) {
        // Handle specific error messages
        if (result.error === 'CredentialsSignin') {
          setServerError('Invalid email or password. Please try again.');
        } else if (result.error.includes('verify')) {
          setServerError(
            'Please verify your email before signing in. Check your inbox for a verification link.',
          );
        } else if (result.error.includes('locked')) {
          setServerError(
            'Your account has been locked due to too many failed attempts. Please reset your password.',
          );
        } else {
          setServerError(result.error);
        }

        // Focus on email field after error
        const emailField = document.getElementById('email') as HTMLInputElement;
        emailField?.focus();
      } else {
        // Successful login
        const redirectUrl = router.query.callbackUrl?.toString() || '/dashboard';
        router.push(redirectUrl);
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
      logger.error('Login error:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn('google', {
        callbackUrl: router.query.callbackUrl?.toString() || '/dashboard',
      });
    } catch (err) {
      setServerError('Failed to sign in with Google. Please try again.');
    }
  };

  // Handle field blur for real-time validation
  const handleFieldBlur = (fieldName: keyof LoginInput) => {
    setFieldTouched(fieldName, true);
  };

  return (
    <>
      <Head>
        <title>Login - TaxReturnPro</title>
        <meta
          name="description"
          content="Login to your TaxReturnPro account"
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
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              href="/auth/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-label="Login form"
            >
              {/* Success message */}
              {showSuccess && (
                <FormMessage
                  type="success"
                  message="Registration successful! Please sign in with your credentials."
                  onClose={() => setShowSuccess(false)}
                />
              )}

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
                onBlur={(e) => {
                  getFieldProps('email').onBlur(e);
                  handleFieldBlur('email');
                }}
                hint={!touched.email ? 'Enter the email you used to register' : undefined}
              />

              {/* Password field */}
              <FormInput
                {...getFieldProps('password')}
                id="password"
                type="password"
                label="Password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                showPasswordToggle
                onBlur={(e) => {
                  getFieldProps('password').onBlur(e);
                  handleFieldBlur('password');
                }}
              />

              {/* Remember me and forgot password */}
              <div className="flex items-center justify-between">
                <FormCheckbox
                  id="remember-me"
                  name="remember-me"
                  label="Remember me for 30 days"
                />

                <div className="text-sm">
                  <Link
                    href="/auth/forgot-password"
                    className="inline-block p-1 -m-1 font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline rounded touch-manipulation"
                    tabIndex={0}
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              {/* Submit button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-3 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  aria-label={isSubmitting ? 'Signing in...' : 'Sign in'}
                >
                  {isSubmitting ? (
                    <>
                      <InlineLoader
                        size="sm"
                        className="mr-2"
                      />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            {/* Social login divider */}
            <div className="mt-6">
              <div className="relative">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Google sign in */}
              <div className="mt-6">
                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="w-full inline-flex justify-center py-3 px-4 min-h-[44px] border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
                  aria-label="Sign in with Google"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="ml-2">Google</span>
                </button>
              </div>
            </div>

            {/* Footer links */}
            <div className="mt-6 text-center text-xs text-gray-600">
              <p>By signing in, you agree to our</p>
              <p className="mt-1">
                <Link
                  href="/terms"
                  className="inline-block p-1 -m-1 text-blue-600 hover:text-blue-500 focus:outline-none focus:underline rounded touch-manipulation"
                  tabIndex={0}
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="inline-block p-1 -m-1 text-blue-600 hover:text-blue-500 focus:outline-none focus:underline rounded touch-manipulation"
                  tabIndex={0}
                >
                  Privacy Policy
                </Link>
              </p>
              <p className="mt-2">ABN: 41 123 456 789</p>
            </div>

            {/* Security notice */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Secured with SSL encryption
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
