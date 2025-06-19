import BudgetPrediction from '@/components/Budget/BudgetPrediction';

/**
 * Budget Predictions Page
 * 
 * This page displays AI-powered budget predictions and analysis
 * for authenticated users in the TAAXDOG application.
 */
export default function BudgetPredictionsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <BudgetPrediction />
    </div>
  );
} 