import React, { useState, useEffect } from 'react';
import { ManualReviewInterface } from './ManualReviewInterface';

interface Receipt {
  id: string;
  merchant: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  processingStatus: string;
  aiConfidence: number;
  imageUrl: string;
  taxCategory?: string;
  matchedTransactionId?: string;
}

export const ReceiptManagement: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showManualReview, setShowManualReview] = useState(false);
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalGst: 0,
    processedCount: 0,
  });

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const response = await fetch('/api/receipts');
      const data = await response.json();
      setReceipts(data.receipts);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Trigger processing
        await processReceipt(data.receiptId);
        fetchReceipts();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const processReceipt = async (receiptId: string) => {
    try {
      await fetch(`/api/receipts/process/${receiptId}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  const handleManualReviewSave = async (data: any) => {
    if (!selectedReceipt) return;

    try {
      const response = await fetch(`/api/receipts/${selectedReceipt.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowManualReview(false);
        setSelectedReceipt(null);
        fetchReceipts();
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleAutoMatch = async () => {
    try {
      const response = await fetch('/api/receipts/match-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Matched ${data.matched} out of ${data.total} receipts`);
        fetchReceipts();
      }
    } catch (error) {
      console.error('Auto-match failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return 'bg-green-100 text-green-800';
      case 'MATCHED':
        return 'bg-blue-100 text-blue-800';
      case 'MANUAL_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (showManualReview && selectedReceipt) {
    return (
      <ManualReviewInterface
        receipt={selectedReceipt as any}
        onSave={handleManualReviewSave}
        onCancel={() => {
          setShowManualReview(false);
          setSelectedReceipt(null);
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Receipt Management</h1>
        
        {/* Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Expenses</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              ${stats.totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total GST</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              ${stats.totalGst.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Processed Receipts</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats.processedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <label className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer">
          Upload Receipt
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
        </label>
        <button
          onClick={handleAutoMatch}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          Auto-Match Transactions
        </button>
      </div>

      {/* Receipts Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {receipt.merchant}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(receipt.processingStatus)}`}>
                          {receipt.processingStatus}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          ${receipt.totalAmount.toFixed(2)} (GST: ${receipt.gstAmount.toFixed(2)})
                        </p>
                        <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                          {new Date(receipt.date).toLocaleDateString('en-AU')}
                        </p>
                        {receipt.taxCategory && (
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            Category: {receipt.taxCategory}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        {receipt.aiConfidence && (
                          <p>Confidence: {(receipt.aiConfidence * 100).toFixed(0)}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex gap-2">
                    {receipt.processingStatus === 'MANUAL_REVIEW' && (
                      <button
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setShowManualReview(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Review
                      </button>
                    )}
                    <a
                      href={receipt.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900 text-sm"
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};