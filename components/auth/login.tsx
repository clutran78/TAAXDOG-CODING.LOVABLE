'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useDarkMode } from '@/providers/dark-mode-provider';
import { useApiError, parseErrorResponse } from '@/hooks/useApiError';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface LoginFormValues {
  email: string;
  password: string;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

// ============================================================================
// COMPONENT
// ============================================================================

const LoginPage: React.FC = () => {
  // ========================================
  // HOOKS
  // ========================================

  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { error, handleError, clearError } = useApiError();

  // ========================================
  // STATE
  // ========================================

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ========================================
  // COMPUTED VALUES
  // ========================================

  const initialValues: LoginFormValues = useMemo(
    () => ({
      email: '',
      password: '',
    }),
    [],
  );

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    async (values: LoginFormValues) => {
      clearError();
      setIsSubmitting(true);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Handle 2FA if required
          if (data.requiresTwoFactor) {
            router.push(`/auth/two-factor?token=${data.tempToken}`);
            return;
          }

          // Set auth token and redirect
          const token = data.data?.token || data.token;
          if (token) {
            Cookies.set('auth-token', token, { expires: 7 }); // 7 days
          }

          router.push('/dashboard');
        } else {
          const errorData = await parseErrorResponse(response);
          handleError(errorData, {
            endpoint: '/api/auth/login',
            method: 'POST',
          });
        }
      } catch (err) {
        handleError(err, {
          endpoint: '/api/auth/login',
          method: 'POST',
          retryable: false,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearError, handleError, router],
  );

  // ========================================
  // RENDER HELPERS
  // ========================================

  const renderError = useMemo(() => {
    if (!error) return null;

    return (
      <div className="bg-red-100 text-red-700 p-3 rounded-md border border-red-300 mt-2">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="font-medium">{error.message}</p>
            {error.code === 'ACCOUNT_LOCKED' && error.details?.lockedUntil && (
              <p className="text-sm mt-1">
                Account locked until: {new Date(error.details.lockedUntil).toLocaleString()}
              </p>
            )}
            {error.details?.remainingAttempts !== undefined && (
              <p className="text-sm mt-1">Remaining attempts: {error.details.remainingAttempts}</p>
            )}
          </div>
        </div>
      </div>
    );
  }, [error]);

  const renderPasswordField = useCallback(
    () => (
      <div className="relative">
        <Field
          type={showPassword ? 'text' : 'password'}
          name="password"
          id="password"
          autoComplete="current-password"
          className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400 pr-10"
          disabled={isSubmitting}
        />
        <button
          type="button"
          onClick={handleTogglePassword}
          className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          disabled={isSubmitting}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    ),
    [showPassword, handleTogglePassword, isSubmitting],
  );

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        darkMode ? '' : 'bg-gray-100'
      } p-4`}
    >
      {/* Dark Mode Toggle Icon */}
      <button
        onClick={toggleDarkMode}
        className={`mb-4 px-2 py-1 rounded absolute top-10 right-10 ${
          darkMode
            ? 'bg-gray-700 text-white hover:bg-gray-600'
            : 'bg-gray-200 text-black hover:bg-gray-300'
        }`}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} fa-1x`}></i>
      </button>

      <div
        className={`max-w-md w-full ${
          darkMode ? 'bg-[#343a40]' : 'bg-white'
        } shadow-md rounded-md p-6`}
      >
        <h2 className="text-2xl font-semibold text-center mb-6">Login to Your Account</h2>

        <Formik
          initialValues={initialValues}
          validationSchema={LoginSchema}
          onSubmit={handleSubmit}
          validateOnChange={false}
          validateOnBlur={true}
        >
          {({ isValid }) => (
            <Form className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className={`block text-sm font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Email
                </label>
                <Field
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="email"
                  className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400"
                  disabled={isSubmitting}
                />
                <ErrorMessage
                  name="email"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className={`block text-sm font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Password
                </label>
                {renderPasswordField()}
                <ErrorMessage
                  name="password"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />

                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-blue-600 text-sm hover:underline"
                    tabIndex={isSubmitting ? -1 : 0}
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {renderError}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSubmitting ? 'Logging In...' : 'Login'}
              </button>
            </Form>
          )}
        </Formik>

        {/* Divider */}
        <div className="my-4 flex items-center justify-center">
          <span className="text-sm text-gray-500">— OR —</span>
        </div>

        {/* Sign Up Redirect */}
        <div className="text-center">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Don&apos;t have an account?{' '}
            <Link
              href="/sign-up"
              className="text-blue-600 hover:underline font-semibold"
              tabIndex={isSubmitting ? -1 : 0}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
