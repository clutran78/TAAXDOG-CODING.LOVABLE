import { useState, useEffect, useCallback } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { showToast } from '@/lib/utils/helpers';
import { logger } from '@/lib/logger';

// Enhanced login validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Error type mapping for better UX
const ERROR_MESSAGES: Record<string, { title: string; message: string; action?: string }> = {
  CredentialsSignin: {
    title: 'Invalid Credentials',
    message: 'The email or password you entered is incorrect.',
    action: 'Please check your credentials and try again.',
  },
  EmailNotVerified: {
    title: 'Email Not Verified',
    message: 'Please verify your email before signing in.',
    action: 'Check your inbox for a verification link.',
  },
  AccountLocked: {
    title: 'Account Locked',
    message: 'Your account has been locked due to too many failed attempts.',
    action: 'Please reset your password to regain access.',
  },
  SessionRequired: {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again.',
  },
  OAuthSignin: {
    title: 'OAuth Error',
    message: 'Error occurred while signing in with Google.',
    action: 'Please try again or use email/password.',
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    message: 'Error occurred during authentication callback.',
  },
  default: {
    title: 'Sign In Error',
    message: 'An unexpected error occurred during sign in.',
    action: 'Please try again later.',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const rememberMe = watch('rememberMe');

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      const callbackUrl = router.query.callbackUrl as string || '/dashboard';
      router.replace(callbackUrl);
    }
  }, [session, status, router]);

  // Handle various query parameters
  useEffect(() => {
    const { registered, verified, reset, error, message } = router.query;

    if (registered === 'true') {
      setShowSuccessMessage('Registration successful! Please check your email to verify your account.');
      router.replace('/auth/login', undefined, { shallow: true });
    } else if (verified === 'true') {
      setShowSuccessMessage('Email verified successfully! You can now sign in.');
      router.replace('/auth/login', undefined, { shallow: true });
    } else if (reset === 'true' || message === 'password-reset') {
      setShowSuccessMessage('Password reset successfully! You can now sign in with your new password.');
      router.replace('/auth/login', undefined, { shallow: true });
    } else if (error) {
      const errorInfo = ERROR_MESSAGES[error as string] || ERROR_MESSAGES.default;
      showToast(errorInfo.message, 'danger');
      router.replace('/auth/login', undefined, { shallow: true });
    }

    // Auto-focus email field
    setTimeout(() => setFocus('email'), 100);
  }, [router, setFocus]);

  // Handle form submission
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      logger.info('Login attempt', { email: data.email });

      const result = await signIn('credentials', {
        email: data.email.toLowerCase().trim(),
        password: data.password,
        redirect: false,
        callbackUrl: router.query.callbackUrl as string || '/dashboard',
      });

      if (result?.error) {
        logger.warn('Login failed', { error: result.error, email: data.email });
        
        // Handle specific error types
        const errorInfo = ERROR_MESSAGES[result.error] || ERROR_MESSAGES.default;
        
        if (result.error === 'CredentialsSignin') {
          showToast('Invalid email or password. Please try again.', 'danger');
          setFocus('password');
        } else if (result.error === 'EmailNotVerified') {
          showToast(errorInfo.message, 'warning');
        } else if (result.error === 'AccountLocked') {
          showToast(
            <div>
              <p className="font-semibold">{errorInfo.title}</p>
              <p className="text-sm">{errorInfo.message}</p>
              <Link href="/auth/forgot-password" className="text-sm underline mt-1 inline-block">
                Reset Password
              </Link>
            </div>,
            'danger'
          );
        } else {
          showToast(errorInfo.message, 'danger');
        }
      } else if (result?.ok) {
        logger.info('Login successful', { email: data.email });
        showToast('Login successful! Redirecting...', 'success');
        
        // Set remember me cookie if checked
        if (data.rememberMe) {
          document.cookie = `remember-me=true; max-age=${30 * 24 * 60 * 60}; path=/; samesite=strict`;
        }
        
        // Redirect to callback URL or dashboard
        const redirectUrl = router.query.callbackUrl as string || '/dashboard';
        router.push(redirectUrl);
      }
    } catch (error) {
      logger.error('Login error:', error);
      showToast('An unexpected error occurred. Please try again.', 'danger');
    }
  }, [router, setFocus]);

  // Handle Google sign in
  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      logger.info('Google sign-in attempt');
      
      const result = await signIn('google', {
        callbackUrl: router.query.callbackUrl as string || '/dashboard',
        redirect: true,
      });
      
      if (result?.error) {
        logger.error('Google sign-in failed', { error: result.error });
        showToast('Failed to sign in with Google. Please try again.', 'danger');
      }
    } catch (error) {
      logger.error('Google sign-in error:', error);
      showToast('An error occurred with Google sign-in. Please try again.', 'danger');
    } finally {
      setIsGoogleLoading(false);
    }
  }, [router]);

  // Loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Head>
        <title>Sign In - TAAXDOG</title>
        <meta name="description" content="Sign in to your TAAXDOG account to manage your tax returns" />
      </Head>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4"
          >
            <Lock className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="mt-2 text-gray-600">
            Sign in to manage your tax returns
          </p>
        </div>

        {/* Success Messages */}
        <AnimatePresence>
          {showSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-green-800">{showSuccessMessage}</p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(null)}
                  className="ml-3 text-green-600 hover:text-green-800"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-600"
                >
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`appearance-none block w-full pl-10 pr-10 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-600"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>

          {/* Google Sign In */}
          <div className="mt-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              type="button"
              className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
                  Sign in with Google
                </>
              )}
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              href="/auth/register"
              className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </motion.div>

        {/* Security & Compliance */}
        <div className="mt-6 text-center space-y-2">
          <div className="flex items-center justify-center text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4 mr-1" />
            <span>256-bit SSL Encryption</span>
          </div>
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
