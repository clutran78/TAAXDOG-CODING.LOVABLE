import React from 'react';

interface SubscriptionsModalProps {
  show: boolean;
  onClose: () => void;
  subscriptions?: any[];
}

const SubscriptionsModal: React.FC<SubscriptionsModalProps> = ({ show, onClose, subscriptions = [] }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Manage Subscriptions</h2>
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <p className="text-gray-500">No active subscriptions</p>
          ) : (
            subscriptions.map((sub, index) => (
              <div key={index} className="border p-4 rounded">
                <h3 className="font-semibold">{sub.name}</h3>
                <p className="text-sm text-gray-600">Amount: ${sub.amount}/month</p>
                <p className="text-sm text-gray-600">Next billing: {sub.nextBilling}</p>
              </div>
            ))
          )}
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

export default SubscriptionsModal;