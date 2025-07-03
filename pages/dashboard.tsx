import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/auth/simple-login");
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Dashboard - TaxReturnPro</title>
      </Head>

      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">TaxReturnPro Dashboard</h1>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/simple-login" })}
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Welcome, {session.user.name || session.user.email}!
                </h2>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    <strong>Email:</strong> {session.user.email}
                  </p>
                  {session.user.name && (
                    <p className="text-sm text-gray-600">
                      <strong>Name:</strong> {session.user.name}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    <strong>User ID:</strong> {session.user.id}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Role:</strong> {session.user.role || "USER"}
                  </p>
                </div>

                <div className="mt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-2">Quick Actions</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left hover:bg-blue-100">
                      <h4 className="font-medium text-blue-900">Start Tax Return</h4>
                      <p className="text-sm text-blue-700 mt-1">Begin your tax return for this year</p>
                    </button>
                    <button className="bg-green-50 border border-green-200 rounded-lg p-4 text-left hover:bg-green-100">
                      <h4 className="font-medium text-green-900">View Documents</h4>
                      <p className="text-sm text-green-700 mt-1">Access your tax documents</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}