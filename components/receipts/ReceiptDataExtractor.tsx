import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/dashboard/Card';
import { formatCurrency } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface ExtractedData {
  merchant: string;
  abn?: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  taxInvoiceNumber?: string;
  items: ExtractedItem[];
  confidence: number;
  rawText?: string;
  suggestions?: DataSuggestion[];
}

interface ExtractedItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  gstIncluded?: boolean;
}

interface DataSuggestion {
  field: string;
  suggestedValue: string;
  confidence: number;
  reason?: string;
}

interface ReceiptDataExtractorProps {
  receiptId: string;
  imageUrl: string;
  onExtractionComplete?: (data: ExtractedData) => void;
  onError?: (error: string) => void;
  autoProcess?: boolean;
  className?: string;
}

export const ReceiptDataExtractor: React.FC<ReceiptDataExtractorProps> = ({
  receiptId,
  imageUrl,
  onExtractionComplete,
  onError,
  autoProcess = true,
  className = '',
}) => {
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [showRawText, setShowRawText] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const MAX_RETRIES = 3;

  // Extract data from receipt
  const extractData = useCallback(async () => {
    try {
      setExtracting(true);
      setError(null);
      setProcessingStep('Uploading image...');

      // Step 1: Upload and process image
      const processResponse = await fetch('/api/receipts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          imageUrl,
          enhanceImage: retryCount > 0, // Use image enhancement on retry
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Failed to process receipt');
      }

      const processResult = await processResponse.json();
      setProcessingStep('Analyzing receipt data...');

      // Step 2: Extract structured data
      const extractResponse = await fetch('/api/ai/extract-receipt-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          ocrText: processResult.text,
          imageFeatures: processResult.features,
        }),
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract data');
      }

      const extractResult = await extractResponse.json();
      setProcessingStep('Validating data...');

      // Step 3: Validate Australian tax compliance
      const validationResponse = await fetch('/api/receipts/validate-tax-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractResult),
      });

      if (!validationResponse.ok) {
        throw new Error('Failed to validate tax data');
      }

      const validatedData = await validationResponse.json();

      // Add raw text and suggestions
      const finalData: ExtractedData = {
        ...validatedData,
        rawText: processResult.text,
        confidence: extractResult.confidence || 0,
      };

      setExtractedData(finalData);
      setProcessingStep('');

      if (onExtractionComplete) {
        onExtractionComplete(finalData);
      }
    } catch (error) {
      logger.error('Extraction error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to extract receipt data';
      setError(errorMessage);
      setProcessingStep('');

      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1);
        setTimeout(() => extractData(), 2000); // Retry after 2 seconds
      } else if (onError) {
        onError(errorMessage);
      }
    } finally {
      setExtracting(false);
    }
  }, [receiptId, imageUrl, retryCount, onExtractionComplete, onError]);

  // Apply suggestion
  const applySuggestion = (suggestion: DataSuggestion) => {
    if (!extractedData) return;

    const updatedData = { ...extractedData };

    switch (suggestion.field) {
      case 'merchant':
        updatedData.merchant = suggestion.suggestedValue;
        break;
      case 'abn':
        updatedData.abn = suggestion.suggestedValue;
        break;
      case 'totalAmount':
        updatedData.totalAmount = parseFloat(suggestion.suggestedValue);
        break;
      case 'gstAmount':
        updatedData.gstAmount = parseFloat(suggestion.suggestedValue);
        break;
      case 'date':
        updatedData.date = suggestion.suggestedValue;
        break;
      case 'taxInvoiceNumber':
        updatedData.taxInvoiceNumber = suggestion.suggestedValue;
        break;
    }

    setExtractedData(updatedData);
    setAppliedSuggestions((prev) => new Set(prev).add(suggestion.field));
  };

  // Recalculate GST
  const recalculateGST = () => {
    if (!extractedData) return;

    const gstRate = 0.1; // 10% GST in Australia
    const gstAmount = extractedData.totalAmount - extractedData.totalAmount / (1 + gstRate);

    setExtractedData({
      ...extractedData,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
    });
  };

  useEffect(() => {
    if (autoProcess) {
      extractData();
    }
  }, [autoProcess, extractData]);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Processing Status */}
      {extracting && (
        <Card>
          <div className="flex items-center space-x-3">
            <div className="spinner" />
            <div>
              <p className="font-medium">Extracting receipt data...</p>
              {processingStep && <p className="text-sm text-gray-600">{processingStep}</p>}
              {retryCount > 0 && (
                <p className="text-sm text-yellow-600">
                  Retry attempt {retryCount} of {MAX_RETRIES}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && !extracting && (
        <div className="alert alert-danger">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                setRetryCount(0);
                extractData();
              }}
              className="btn btn-sm btn-danger"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Extracted Data */}
      {extractedData && !extracting && (
        <>
          {/* Confidence Score */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">AI Extraction Confidence</h3>
                <p className="text-sm text-gray-600 mt-1">
                  The AI is {Math.round(extractedData.confidence * 100)}% confident in the extracted
                  data
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${getConfidenceColor(extractedData.confidence)}`}>
                  {Math.round(extractedData.confidence * 100)}%
                </p>
                <p className={`text-sm ${getConfidenceColor(extractedData.confidence)}`}>
                  {getConfidenceLabel(extractedData.confidence)}
                </p>
              </div>
            </div>
          </Card>

          {/* Main Data */}
          <Card title="Extracted Information">
            <div className="space-y-4">
              {/* Merchant Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Merchant Name</label>
                  <p className="mt-1 text-lg font-medium">
                    {extractedData.merchant || 'Not detected'}
                  </p>
                </div>
                {extractedData.abn && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ABN</label>
                    <p className="mt-1 text-lg font-medium">{extractedData.abn}</p>
                  </div>
                )}
              </div>

              {/* Financial Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatCurrency(extractedData.totalAmount)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GST Amount</label>
                  <p className="mt-1 text-lg font-medium text-gray-900">
                    {formatCurrency(extractedData.gstAmount)}
                  </p>
                  <button
                    onClick={recalculateGST}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Recalculate from total
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <p className="mt-1 text-lg font-medium">
                    {new Date(extractedData.date).toLocaleDateString('en-AU')}
                  </p>
                </div>
              </div>

              {/* Tax Invoice Number */}
              {extractedData.taxInvoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tax Invoice Number
                  </label>
                  <p className="mt-1">{extractedData.taxInvoiceNumber}</p>
                </div>
              )}

              {/* Line Items */}
              {extractedData.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Line Items</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Description
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Unit Price
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {extractedData.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm">{item.description}</td>
                            <td className="px-3 py-2 text-sm text-center">
                              {item.quantity || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-right">
                              {item.unitPrice ? formatCurrency(item.unitPrice) : '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Suggestions */}
          {extractedData.suggestions && extractedData.suggestions.length > 0 && (
            <Card title="AI Suggestions">
              <div className="space-y-3">
                {extractedData.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg ${
                      appliedSuggestions.has(suggestion.field)
                        ? 'bg-green-50 border-green-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {suggestion.field.charAt(0).toUpperCase() + suggestion.field.slice(1)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Suggested:{' '}
                          <span className="font-medium">{suggestion.suggestedValue}</span>
                        </p>
                        {suggestion.reason && (
                          <p className="text-xs text-gray-500 mt-1">{suggestion.reason}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Confidence: {Math.round(suggestion.confidence * 100)}%
                        </p>
                      </div>
                      {!appliedSuggestions.has(suggestion.field) && (
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="btn btn-sm btn-primary ml-3"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Raw Text */}
          <Card>
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="font-medium">Raw OCR Text</span>
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  showRawText ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showRawText && extractedData.rawText && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {extractedData.rawText}
                </pre>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default ReceiptDataExtractor;
