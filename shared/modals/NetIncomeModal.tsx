import React from 'react';

interface NetIncomeModalProps {
  show: boolean;
  onClose: () => void;
  data?: any;
}

const NetIncomeModal: React.FC<NetIncomeModalProps> = ({ show, onClose, data }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Net Income Details</h2>
        <div className="space-y-2">
          <p>Total Income: ${data?.totalIncome || 0}</p>
          <p>Total Expenses: ${data?.totalExpenses || 0}</p>
          <p>Net Income: ${data?.netIncome || 0}</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default NetIncomeModal;