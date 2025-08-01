"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import GridBoxes from "./GridBoxes";
import { fetchBankTransactions, fetchGoals, fetchSubscriptions, calculateFinancialSummary } from "@/services/firebase-service";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";

interface DashboardData {
  netIncome: number;
  totalExpenses: number;
  netBalance: number;
  activeSubscriptions: number;
}

const DashboardWithData = () => {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [transactions, goals, subscriptions] = await Promise.all([
        fetchBankTransactions(),
        fetchGoals(),
        fetchSubscriptions(),
      ]);

      // Calculate financial summary
      const financialSummary = calculateFinancialSummary(transactions);
      const activeSubscriptions = subscriptions.filter(s => s.isActive).length;

      setDashboardData({
        netIncome: financialSummary.totalIncome,
        totalExpenses: financialSummary.totalExpenses,
        netBalance: financialSummary.netBalance,
        activeSubscriptions,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData();
    }
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
          <div className="flex items-center justify-center min-h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
          <ErrorDisplay
            title="Failed to load dashboard"
            message={error}
            onRetry={fetchDashboardData}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        <GridBoxes data={dashboardData} />
      </div>
    </div>
  );
};

export default DashboardWithData;