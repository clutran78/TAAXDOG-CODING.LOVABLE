import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Receipt } from '../../generated/prisma';
import { ATO_TAX_CATEGORIES, calculateGST, validateABN, formatABN } from '../../lib/australian-tax-compliance';

interface ManualReviewInterfaceProps {
  receipt: Receipt & { imageUrl: string };
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export const ManualReviewInterface: React.FC<ManualReviewInterfaceProps> = ({
  receipt,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    merchant: receipt.merchant || '',
    totalAmount: receipt.totalAmount?.toString() || '0',
    gstAmount: receipt.gstAmount?.toString() || '0',
    date: receipt.date ? new Date(receipt.date).toISOString().split('T')[0] : '',
    abn: receipt.abn || '',
    taxInvoiceNumber: receipt.taxInvoiceNumber || '',
    taxCategory: receipt.taxCategory || 'D5',
    items: receipt.items || [],
  });

  const [abnError, setAbnError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Auto-calculate GST when total amount changes
    const total = parseFloat(formData.totalAmount) || 0;
    if (total > 0 && !formData.gstAmount) {
      const { gstAmount } = calculateGST(total, true);
      setFormData(prev => ({ ...prev, gstAmount: gstAmount.toString() }));
    }
  }, [formData.totalAmount]);

  const handleABNChange = (value: string) => {
    const cleanABN = value.replace(/\s/g, '');
    setFormData(prev => ({ ...prev, abn: cleanABN }));
    
    if (cleanABN && !validateABN(cleanABN)) {
      setAbnError('Invalid ABN format');
    } else {
      setAbnError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.abn && !validateABN(formData.abn)) {
      setAbnError('Please enter a valid ABN');
      return;
    }

    setIsProcessing(true);
    try {
      await onSave({
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        gstAmount: parseFloat(formData.gstAmount),
        abn: formData.abn ? formatABN(formData.abn) : null,
        isGstRegistered: !!formData.abn,
        aiConfidence: 1.0, // Manual review = 100% confidence
        processingStatus: 'PROCESSED',
      });
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Manual Receipt Review</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipt Image */}
        <div className="relative h-96 lg:h-full bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={receipt.imageUrl}
            alt="Receipt"
            fill
            className="object-contain"
          />
        </div>

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Merchant Name
            </label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total Amount (AUD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                GST Amount (AUD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.gstAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, gstAmount: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              ABN (optional)
            </label>
            <input
              type="text"
              value={formData.abn}
              onChange={(e) => handleABNChange(e.target.value)}
              placeholder="12 345 678 901"
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 ${
                abnError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {abnError && (
              <p className="mt-1 text-sm text-red-600">{abnError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tax Invoice Number (optional)
            </label>
            <input
              type="text"
              value={formData.taxInvoiceNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, taxInvoiceNumber: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tax Category
            </label>
            <select
              value={formData.taxCategory}
              onChange={(e) => setFormData(prev => ({ ...prev, taxCategory: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {ATO_TAX_CATEGORIES.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.code} - {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? 'Saving...' : 'Save Receipt'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};