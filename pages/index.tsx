import Link from "next/link";
import Head from "next/head";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>TaxReturnPro - Home</title>
      </Head>

      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Welcome to TaxReturnPro
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Your simple tax return solution
          </p>

          {session ? (
            <div className="space-y-4">
              <p className="text-gray-700">Welcome back, {session.user.name}!</p>
              <Link
                href="/dashboard"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition duration-200"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-x-4">
              <Link
                href="/auth/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition duration-200"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="inline-block bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition duration-200"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}