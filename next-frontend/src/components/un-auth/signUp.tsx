'use client';
import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const SignupSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), ''], 'Passwords must match')
    .required('Confirm your password'),
});

export default function SignupPage() {

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [firebaseError, setFirebaseError] = useState('');
  const router = useRouter();

  const handleSubmit = async (values: any) => {
    debugger
    setFirebaseError('');
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      router.push('/login')
    } catch (error: any) {
      setFirebaseError(error.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-md p-6">
        <h2 className="text-2xl font-semibold text-center mb-6">Create Your Account</h2>
        <Formik
          initialValues={{ email: '', password: '', confirmPassword: '' }}
          validationSchema={SignupSchema}
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
                <label  className="block text-sm font-medium text-gray-700">Password</label>
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

              {/* Confirm Password */}
              <div>
                <label  className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Field
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    className="mt-1 w-full border px-3 py-2 rounded-md focus:outline-none focus:ring focus:ring-blue-400 pr-10"
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer text-gray-500"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                <ErrorMessage name="confirmPassword" component="div" className="text-red-500 text-sm mt-1" />
              </div>

              {firebaseError && <div className="text-red-600 text-sm">{firebaseError}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
              >
                {isSubmitting ? 'Creating Account...' : 'Sign Up'}
              </button>
            </Form>
          )}
        </Formik>

        {/* Divider */}
        <div className="my-4 flex items-center justify-center">
          <span className="text-sm text-gray-500">— OR —</span>
        </div>

        {/* Login Up Redirect */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-700">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-blue-600 hover:underline font-semibold"
            >
              Login
            </Link>
          </p>
        </div>


      </div>
    </div>
  );
}
