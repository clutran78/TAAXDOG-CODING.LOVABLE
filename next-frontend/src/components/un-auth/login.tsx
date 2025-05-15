'use client';

import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function LoginPage() {
  const [firebaseError, setFirebaseError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const handleSubmit = async (values: any) => {
    debugger
    setFirebaseError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const token = await userCredential.user.getIdToken();
      Cookies.set('auth-token', token, { expires: 7 }); // 7 days
      router.push('/dashboard')
    } catch (error: any) {
      setFirebaseError(error.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-md p-6">
        <h2 className="text-2xl font-semibold text-center mb-6">Login to Your Account</h2>
        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={LoginSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <Field
                  type="email"
                  name="email"
                  id="email"
                  className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400"
                />
                <ErrorMessage name="email" component="div" className="text-red-500 text-sm mt-1" />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Field
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400 pr-10"
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer text-gray-500"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                <ErrorMessage name="password" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              {firebaseError && <div className="text-red-600 text-sm">{firebaseError}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
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
          <p className="text-sm text-gray-700">
            Don’t have an account?{' '}
            <Link
              href="/unauth/sign-up"
              className="text-blue-600 hover:underline font-semibold"
            >
              Sign Up
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
