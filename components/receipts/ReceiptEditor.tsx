import React, { useState, useEffect } from 'react';
import { Card } from '@/components/dashboard/Card';
import { ReceiptPreview } from './ReceiptPreview';
import { logger } from '@/lib/logger';

interface ReceiptData {
  id?: string;
  merchant: string;
  abn?: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  taxInvoiceNumber?: string;
  taxCategory?: string;
  items: ReceiptItem[];
  notes?: string;
  matchedTransactionId?: string;
  aiConfidence?: number;
}

interface ReceiptItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstIncluded: boolean;
}

interface ReceiptEditorProps {
  receipt?: ReceiptData;
  imageUrl?: string;
  onSave: (data: ReceiptData) => Promise<void>;
  onCancel: () => void;
  taxCategories?: TaxCategory[];
  matchedTransactions?: Transaction[];
  className?: string;
}

interface TaxCategory {
  code: string;
  name: string;
  description?: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  merchant?: string;
}

const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  { code: 'D1', name: 'Car expenses', description: 'Work-related car expenses' },
  { code: 'D2', name: 'Travel expenses', description: 'Work-related travel' },
  {
    code: 'D3',
    name: 'Clothing expenses',
    description: 'Work-related clothing, laundry and dry-cleaning',
  },
  { code: 'D4', name: 'Self-education expenses', description: 'Work-related self-education' },
  {
    code: 'D5',
    name: 'Other work-related expenses',
    description: 'Other expenses incurred in earning income',
  },
  {
    code: 'D10',
    name: 'Cost of managing tax affairs',
    description: 'Tax agent fees and tax advice',
  },
  { code: 'P8', name: 'Personal expenses', description: 'Non-deductible personal expenses' },
];

export const ReceiptEditor: React.FC<ReceiptEditorProps> = ({
  receipt,
  imageUrl,
  onSave,
  onCancel,
  taxCategories = DEFAULT_TAX_CATEGORIES,
  matchedTransactions = [],
  className = '',
}) => {
  const [formData, setFormData] = useState<ReceiptData>({
    merchant: '',
    totalAmount: 0,
    gstAmount: 0,
    date: new Date().toISOString().split('T')[0],
    items: [],
    ...receipt,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [gstInclusive, setGstInclusive] = useState(true);
  const [autoCalculateGst, setAutoCalculateGst] = useState(true);

  // Validate ABN format
  const validateABN = (abn: string): boolean => {
    const cleanABN = abn.replace(/\s/g, '');
    return /^\d{11}$/.test(cleanABN);
  };

  // Format ABN with spaces
  const formatABN = (abn: string): string => {
    const clean = abn.replace(/\s/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
    }
    return abn;
  };

  // Calculate GST from total
  const calculateGSTFromTotal = (total: number, inclusive: boolean = true): number => {
    if (inclusive) {
      // GST included in total: GST = Total - (Total / 1.1)
      return parseFloat((total - total / 1.1).toFixed(2));
    } else {
      // GST to be added: GST = Total * 0.1
      return parseFloat((total * 0.1).toFixed(2));
    }
  };

  // Handle field changes
  const handleFieldChange = (field: keyof ReceiptData, value: string | number | ReceiptItem[] | undefined) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate GST if enabled and total amount changed
      if (field === 'totalAmount' && autoCalculateGst) {
        const total = parseFloat(value) || 0;
        updated.gstAmount = calculateGSTFromTotal(total, gstInclusive);
      }

      return updated;
    });

    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle ABN change
  const handleABNChange = (value: string) => {
    const cleanValue = value.replace(/[^\d\s]/g, '');
    handleFieldChange('abn', cleanValue);

    if (cleanValue && !validateABN(cleanValue)) {
      setErrors((prev) => ({ ...prev, abn: 'Invalid ABN format (must be 11 digits)' }));
    }
  };

  // Add line item
  const addLineItem = () => {
    const newItem: ReceiptItem = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      gstIncluded: gstInclusive,
    };

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  // Update line item
  const updateLineItem = (index: number, field: keyof ReceiptItem, value: string | number | boolean) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      // Auto-calculate amount
      if (field === 'quantity' || field === 'unitPrice') {
        const quantity = field === 'quantity' ? parseFloat(value) || 0 : items[index].quantity;
        const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : items[index].unitPrice;
        items[index].amount = parseFloat((quantity * unitPrice).toFixed(2));
      }

      return { ...prev, items };
    });
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals from line items
  const calculateTotalsFromItems = () => {
    const total = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const gst = calculateGSTFromTotal(total, gstInclusive);

    setFormData((prev) => ({
      ...prev,
      totalAmount: total,
      gstAmount: gst,
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.merchant.trim()) {
      newErrors.merchant = 'Merchant name is required';
    }

    if (formData.totalAmount <= 0) {
      newErrors.totalAmount = 'Total amount must be greater than 0';
    }

    if (formData.gstAmount < 0) {
      newErrors.gstAmount = 'GST amount cannot be negative';
    }

    if (formData.gstAmount > formData.totalAmount) {
      newErrors.gstAmount = 'GST amount cannot exceed total amount';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (formData.abn && !validateABN(formData.abn)) {
      newErrors.abn = 'Invalid ABN format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        abn: formData.abn ? formatABN(formData.abn) : undefined,
        totalAmount: parseFloat(formData.totalAmount.toString()),
        gstAmount: parseFloat(formData.gstAmount.toString()),
        items: formData.items.map((item) => ({
          ...item,
          amount: parseFloat(item.amount.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          quantity: parseFloat(item.quantity.toString()),
        })),
      };

      await onSave(dataToSave);
    } catch (error) {
      logger.error('Save error:', error);
      setErrors({ submit: 'Failed to save receipt. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Match transaction suggestion
  const suggestTransactionMatch = () => {
    if (!formData.totalAmount || !formData.date || matchedTransactions.length === 0) return null;

    const receiptDate = new Date(formData.date);
    const receiptAmount = formData.totalAmount;

    // Find transactions within 7 days and 5% amount difference
    const matches = matchedTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      const daysDiff = Math.abs((receiptDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
      const amountDiff = Math.abs(tx.amount - receiptAmount) / receiptAmount;

      return daysDiff <= 7 && amountDiff <= 0.05;
    });

    return matches.length > 0 ? matches[0] : null;
  };

  const suggestedMatch = suggestTransactionMatch();

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Left Column - Form */}
      <div className="space-y-6">
        <Card title="Receipt Details">
          <div className="space-y-4">
            {/* Merchant Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Name *
              </label>
              <input
                type="text"
                value={formData.merchant}
                onChange={(e) => handleFieldChange('merchant', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.merchant ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Officeworks"
              />
              {errors.merchant && <p className="mt-1 text-sm text-red-600">{errors.merchant}</p>}
            </div>

            {/* ABN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ABN (optional)</label>
              <input
                type="text"
                value={formData.abn || ''}
                onChange={(e) => handleABNChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.abn ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="12 345 678 901"
              />
              {errors.abn && <p className="mt-1 text-sm text-red-600">{errors.abn}</p>}
            </div>

            {/* Date and Invoice Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Invoice Number
                </label>
                <input
                  type="text"
                  value={formData.taxInvoiceNumber || ''}
                  onChange={(e) => handleFieldChange('taxInvoiceNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={gstInclusive}
                    onChange={(e) => setGstInclusive(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-sm">GST inclusive pricing</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoCalculateGst}
                    onChange={(e) => setAutoCalculateGst(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-sm">Auto-calculate GST</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.totalAmount}
                      onChange={(e) => handleFieldChange('totalAmount', e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-md ${
                        errors.totalAmount ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.totalAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.totalAmount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.gstAmount}
                      onChange={(e) => handleFieldChange('gstAmount', e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-md ${
                        errors.gstAmount ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={autoCalculateGst}
                    />
                  </div>
                  {errors.gstAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.gstAmount}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tax Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Category</label>
              <select
                value={formData.taxCategory || ''}
                onChange={(e) => handleFieldChange('taxCategory', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select category...</option>
                {taxCategories.map((cat) => (
                  <option
                    key={cat.code}
                    value={cat.code}
                  >
                    {cat.code} - {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Optional notes about this receipt..."
              />
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card title="Line Items (Optional)">
          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  <button
                    onClick={() => removeLineItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Item description"
                />

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Unit Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateLineItem(index, 'amount', e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={item.gstIncluded}
                    onChange={(e) => updateLineItem(index, 'gstIncluded', e.target.checked)}
                    className="rounded text-blue-600 mr-2"
                  />
                  GST included
                </label>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={addLineItem}
                className="btn btn-sm btn-secondary"
              >
                + Add Item
              </button>
              {formData.items.length > 0 && (
                <button
                  onClick={calculateTotalsFromItems}
                  className="btn btn-sm btn-secondary"
                >
                  Calculate Total
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Transaction Matching */}
        {matchedTransactions.length > 0 && (
          <Card title="Transaction Matching">
            {suggestedMatch ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Suggested Match Found</p>
                <div className="text-sm text-blue-800">
                  <p>{suggestedMatch.description}</p>
                  <p className="text-xs mt-1">
                    {new Date(suggestedMatch.date).toLocaleDateString('en-AU')} • $
                    {Math.abs(suggestedMatch.amount).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleFieldChange('matchedTransactionId', suggestedMatch.id)}
                  className="mt-2 btn btn-sm btn-primary"
                >
                  Link Transaction
                </button>
              </div>
            ) : (
              <select
                value={formData.matchedTransactionId || ''}
                onChange={(e) => handleFieldChange('matchedTransactionId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">No matched transaction</option>
                {matchedTransactions.map((tx) => (
                  <option
                    key={tx.id}
                    value={tx.id}
                  >
                    {tx.description} - ${Math.abs(tx.amount).toFixed(2)} (
                    {new Date(tx.date).toLocaleDateString('en-AU')})
                  </option>
                ))}
              </select>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner mr-2" />
                Saving...
              </>
            ) : (
              'Save Receipt'
            )}
          </button>
        </div>

        {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}
      </div>

      {/* Right Column - Preview */}
      {imageUrl && showPreview && (
        <div className="lg:sticky lg:top-4">
          <Card title="Receipt Image">
            <div className="mb-3">
              <button
                onClick={() => setShowPreview(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Hide Preview
              </button>
            </div>
            <ReceiptPreview
              imageUrl={imageUrl}
              allowZoom={true}
              allowRotate={true}
              showMetadata={true}
              metadata={{
                uploadDate: formData.date,
                processingStatus: formData.aiConfidence
                  ? `AI Confidence: ${Math.round(formData.aiConfidence * 100)}%`
                  : 'Manual Entry',
              }}
            />
          </Card>
        </div>
      )}

      {imageUrl && !showPreview && (
        <div className="lg:sticky lg:top-4">
          <Card>
            <button
              onClick={() => setShowPreview(true)}
              className="w-full py-8 text-center text-gray-600 hover:text-gray-800"
            >
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Show Receipt Preview
            </button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReceiptEditor;
