'use client';

import { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useDarkMode } from '@/providers/dark-mode-provider';

const ResetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain an uppercase letter')
    .matches(/[a-z]/, 'Password must contain a lowercase letter')
    .matches(/[0-9]/, 'Password must contain a number')
    .matches(/[!@#$%^&*]/, 'Password must contain a special character')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

export default function ResetPasswordPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [message, setMessage] = useState('');
  const [firebaseError, setFirebaseError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (!urlToken) {
      setFirebaseError('Invalid or missing reset token. Please request a new password reset.');
      return;
    }
    setToken(urlToken);
  }, [searchParams]);

  const handleSubmit = async (values: any) => {
    setMessage('');
    setFirebaseError('');

    if (!token) {
      setFirebaseError('Invalid reset token. Please request a new password reset.');
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setFirebaseError(data.error || 'Failed to reset password. Please try again.');
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      setFirebaseError('Failed to reset password. Please try again.');
    }
  };

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
      >
        <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} fa-1x`}></i>
      </button>

      <div
        className={`max-w-md w-full ${
          darkMode ? 'bg-[#343a40]' : 'bg-white'
        } shadow-md rounded-md p-6`}
      >
        <h2 className="text-2xl font-semibold text-center mb-6">Reset Password</h2>

        <Formik
          initialValues={{ password: '', confirmPassword: '' }}
          validationSchema={ResetPasswordSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className={`block text-sm font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  New Password
                </label>
                <div className="relative">
                  <Field
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="password"
                    className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400 pr-10"
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer text-gray-500"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                <ErrorMessage
                  name="password"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className={`block text-sm font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Field
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    id="confirmPassword"
                    className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400 pr-10"
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer text-gray-500"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                <ErrorMessage
                  name="confirmPassword"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              {firebaseError && (
                <div className="bg-red-100 text-red-700 p-2 text-sm rounded-md border border-red-300 mt-2">
                  {firebaseError}
                </div>
              )}

              {message && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-400 text-green-700 text-sm rounded-md p-3 mt-2 shadow-sm transition-all">
                  <span className="text-xl">✅</span>
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </Form>
          )}
        </Formik>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-blue-600 hover:underline text-sm"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
