import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { extendedRegisterSchema, type ExtendedRegisterInput } from '@/lib/auth/validation';
import { logger } from '@/lib/logger';
import {
  FormInput,
  FormSelect,
  FormCheckbox,
  FormMessage,
  PasswordStrength,
  useFormValidation,
} from '@/components/ui/FormComponents';
import { InlineLoader } from '@/components/ui/SkeletonLoaders';

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Form validation
  const {
    values,
    errors,
    touched,
    isSubmitting,
    getFieldProps,
    handleSubmit,
    setFieldTouched,
    setFieldValue,
  } = useFormValidation<ExtendedRegisterInput>(extendedRegisterSchema, {
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    abn: '',
    taxResidency: 'RESIDENT',
    acceptTerms: false,
  });

  const onSubmit = async (formValues: ExtendedRegisterInput) => {
    setServerError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formValues.email,
          password: formValues.password,
          name: formValues.name,
          phone: formValues.phone || undefined,
          abn: formValues.abn || undefined,
          taxResidency: formValues.taxResidency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.code === 'USER_EXISTS') {
          setServerError('An account with this email already exists. Please sign in instead.');
          // Focus on email field
          const emailField = document.getElementById('email') as HTMLInputElement;
          emailField?.focus();
        } else if (data.code === 'INVALID_ABN') {
          setServerError('The ABN provided is invalid. Please check and try again.');
          // Focus on ABN field
          const abnField = document.getElementById('abn') as HTMLInputElement;
          abnField?.focus();
        } else {
          setServerError(data.message || 'Registration failed. Please try again.');
        }
        return;
      }

      // Auto sign in after registration
      const result = await signIn('credentials', {
        email: formValues.email,
        password: formValues.password,
        redirect: false,
      });

      if (result?.ok) {
        router.push('/dashboard');
      } else {
        // Registration succeeded but login failed - redirect to login
        router.push('/auth/login?registered=true');
      }
    } catch (error) {
      setServerError('An unexpected error occurred. Please try again.');
      logger.error('Registration error:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/auth/welcome' });
    } catch (err) {
      setServerError('Failed to sign in with Google. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  // Format phone number as user types
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    let formatted = value;

    // Format as Australian mobile: 04XX XXX XXX
    if (value.startsWith('4') && value.length <= 10) {
      formatted = value;
      if (value.length > 1) formatted = `0${value}`;
      if (value.length > 4) formatted = `${formatted.slice(0, 4)} ${formatted.slice(4)}`;
      if (value.length > 7) formatted = `${formatted.slice(0, 8)} ${formatted.slice(8)}`;
    } else if (value.startsWith('04') && value.length <= 10) {
      if (value.length > 4) formatted = `${value.slice(0, 4)} ${value.slice(4)}`;
      if (value.length > 7) formatted = `${formatted.slice(0, 8)} ${formatted.slice(8)}`;
    }

    setFieldValue('phone', formatted);
  };

  // Format ABN as user types
  const handleABNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    let formatted = value;

    // Format as XX XXX XXX XXX
    if (value.length > 2) formatted = `${value.slice(0, 2)} ${value.slice(2)}`;
    if (value.length > 5) formatted = `${formatted.slice(0, 6)} ${formatted.slice(6)}`;
    if (value.length > 8) formatted = `${formatted.slice(0, 10)} ${formatted.slice(10)}`;

    setFieldValue('abn', formatted);
  };

  return (
    <>
      <Head>
        <title>Register - TaxReturnPro</title>
        <meta
          name="description"
          content="Create your TaxReturnPro account"
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
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-label="Registration form"
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
                hint={!touched.email ? "We'll use this to send you important updates" : undefined}
              />

              {/* Name field */}
              <FormInput
                {...getFieldProps('name')}
                id="name"
                type="text"
                label="Full name"
                placeholder="John Smith"
                autoComplete="name"
                required
                hint={!touched.name ? 'Your legal name for tax purposes' : undefined}
              />

              {/* Phone field */}
              <FormInput
                {...getFieldProps('phone')}
                id="phone"
                type="tel"
                label="Phone number"
                placeholder="0412 345 678"
                autoComplete="tel"
                onChange={handlePhoneChange}
                hint={!touched.phone ? 'Optional - for account recovery' : undefined}
              />

              {/* Password field */}
              <div>
                <FormInput
                  {...getFieldProps('password')}
                  id="password"
                  type="password"
                  label="Password"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  required
                  showPasswordToggle
                />
                <PasswordStrength password={values.password} />
              </div>

              {/* Confirm password field */}
              <FormInput
                {...getFieldProps('confirmPassword')}
                id="confirmPassword"
                type="password"
                label="Confirm password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                showPasswordToggle
              />

              {/* Tax residency field */}
              <FormSelect
                {...getFieldProps('taxResidency')}
                id="taxResidency"
                label="Tax residency status"
                required
                options={[
                  { value: 'RESIDENT', label: 'Australian Tax Resident' },
                  { value: 'NON_RESIDENT', label: 'Non-Resident' },
                  { value: 'TEMPORARY_RESIDENT', label: 'Temporary Resident' },
                ]}
                hint="This affects your tax rates and obligations"
              />

              {/* ABN field */}
              <FormInput
                {...getFieldProps('abn')}
                id="abn"
                type="text"
                label="ABN (optional)"
                placeholder="11 222 333 444"
                onChange={handleABNChange}
                hint={!touched.abn ? "If you're a sole trader or business" : undefined}
              />

              {/* Terms acceptance */}
              <FormCheckbox
                {...getFieldProps('acceptTerms')}
                id="acceptTerms"
                label={
                  <>
                    I accept the{' '}
                    <Link
                      href="/terms"
                      className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                      target="_blank"
                      tabIndex={0}
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                      target="_blank"
                      tabIndex={0}
                    >
                      Privacy Policy
                    </Link>
                  </>
                }
              />

              {/* Submit button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={isSubmitting ? 'Creating account...' : 'Create account'}
                >
                  {isSubmitting ? (
                    <>
                      <InlineLoader
                        size="sm"
                        className="mr-2"
                      />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>

            {/* Social registration divider */}
            <div className="mt-6">
              <div className="relative">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or register with</span>
                </div>
              </div>

              {/* Google sign up */}
              <div className="mt-6">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  type="button"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Sign up with Google"
                >
                  {isGoogleLoading ? (
                    <>
                      <InlineLoader
                        size="sm"
                        className="mr-2"
                      />
                      Connecting...
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-600">
              <p className="mb-2">
                Your data is secured with 256-bit encryption and stored in Australian datacenters
              </p>
              <p>ABN: 41 123 456 789</p>
            </div>

            {/* Security badges */}
            <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center">
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
                SSL Secured
              </div>
              <div className="flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Privacy Protected
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
