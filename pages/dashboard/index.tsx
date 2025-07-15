import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "../../components/Layout";
import InsightsDashboard from "../../components/insights/InsightsDashboard";
import { Card, CardContent } from "../../components/dashboard/Card";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/auth/login");
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

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "insights", label: "AI Insights", icon: "🤖" },
    { id: "goals", label: "Goals", icon: "🎯" },
    { id: "banking", label: "Banking", icon: "🏦" },
    { id: "tax", label: "Tax Profile", icon: "📋" },
  ];

  return (
    <>
      <Head>
        <title>Dashboard - TaxReturnPro</title>
      </Head>

      <Layout>
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {session.user?.name || session.user?.email}!
            </h1>
            <p className="mt-2 text-gray-600">
              Here's your financial overview and AI-powered insights
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                    ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Balance</p>
                        <p className="text-2xl font-bold text-gray-900">$12,450</p>
                      </div>
                      <div className="text-3xl">💰</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Tax Savings</p>
                        <p className="text-2xl font-bold text-green-600">$3,200</p>
                      </div>
                      <div className="text-3xl">📈</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Monthly Spend</p>
                        <p className="text-2xl font-bold text-gray-900">$4,850</p>
                      </div>
                      <div className="text-3xl">💳</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Goal Progress</p>
                        <p className="text-2xl font-bold text-blue-600">68%</p>
                      </div>
                      <div className="text-3xl">🎯</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "insights" && <InsightsDashboard />}

            {activeTab === "goals" && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Financial Goals</h2>
                  <p className="text-gray-600">Goal tracking coming soon...</p>
                </CardContent>
              </Card>
            )}

            {activeTab === "banking" && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
                  <p className="text-gray-600">Connect your bank accounts to get started...</p>
                </CardContent>
              </Card>
            )}

            {activeTab === "tax" && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Tax Profile</h2>
                  <p className="text-gray-600">Complete your tax profile for personalized insights...</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}