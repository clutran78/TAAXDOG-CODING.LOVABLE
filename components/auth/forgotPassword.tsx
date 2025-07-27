'use client';

import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import Link from 'next/link';
import { useDarkMode } from '@/providers/dark-mode-provider';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
});

export default function ForgotPasswordPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [message, setMessage] = useState('');
  const [firebaseError, setFirebaseError] = useState('');

  interface ForgotPasswordFormValues {
    email: string;
  }

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    setMessage('');
    setFirebaseError('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset email sent. Please check your inbox.');
      } else {
        setFirebaseError(data.error || 'Failed to send reset email.');
      }
    } catch (error) {
      setFirebaseError('Failed to send reset email. Please try again.');
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
        <h2 className="text-2xl font-semibold text-center mb-6">Forgot Password</h2>

        <Formik
          initialValues={{ email: '' }}
          validationSchema={ForgotPasswordSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
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
                  className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400"
                />
                <ErrorMessage
                  name="email"
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
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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
