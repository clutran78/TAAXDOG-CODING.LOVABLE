'use client';

import React from 'react';
import { InsightsDashboard } from '@/components/insights/InsightsDashboard';

/**
 * Financial Insights Page Component
 * 
 * This page provides comprehensive AI-powered financial insights including:
 * - Spending pattern analysis
 * - Tax deduction recommendations
 * - Personalized financial goals
 * - Budget optimization suggestions
 */
export default function FinancialInsightsPage() {
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Insights
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          AI-powered analysis of your financial data with personalized recommendations
        </p>
      </div>
      
      <InsightsDashboard />
    </div>
  );
}
