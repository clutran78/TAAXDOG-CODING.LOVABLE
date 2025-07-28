import React, { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Alert } from '@/components/ui/Alert';
import { ReceiptUploader } from './ReceiptUploader';
import { ReceiptDataExtractor } from './ReceiptDataExtractor';
import { ReceiptEditor } from './ReceiptEditor';
import { ReceiptList } from './ReceiptList';
import { Card } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface Receipt {
  id: string;
  merchant: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  processingStatus: string;
  aiConfidence?: number;
  imageUrl: string;
  taxCategory?: string;
  matchedTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReceiptProcessorProps {
  defaultTab?: 'upload' | 'manage' | 'insights';
  onReceiptProcessed?: (receipt: Receipt) => void;
  className?: string;
}

export const ReceiptProcessor: React.FC<ReceiptProcessorProps> = ({
  defaultTab = 'upload',
  onReceiptProcessed,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState<{
    id: string;
    imageUrl: string;
    status: 'uploading' | 'extracting' | 'saving';
  } | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalAmount: 0,
    totalGst: 0,
    processedToday: 0,
    pendingReview: 0,
    matchRate: 0,
  });

  // Fetch receipts
  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/receipts');
      if (!response.ok) throw new Error('Failed to fetch receipts');

      const data = await response.json();
      setReceipts(data.receipts);
      setStats(data.stats);
    } catch (error) {
      logger.error('Error fetching receipts:', error);
      showNotification('error', 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload receipts
  const handleUpload = async (files: File[]) => {
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('receipt', file);

      try {
        showNotification('info', `Uploading ${file.name}...`);

        const uploadResponse = await fetch('/api/receipts/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { receiptId, imageUrl } = await uploadResponse.json();

        // Add to processing queue
        setProcessingQueue((prev) => [...prev, receiptId]);

        // Start processing
        processReceipt(receiptId, imageUrl);
      } catch (error) {
        logger.error('Upload error:', error);
        showNotification('error', `Failed to upload ${file.name}`);
      }
    });

    await Promise.all(uploadPromises);
  };

  // Process receipt
  const processReceipt = async (receiptId: string, imageUrl: string) => {
    setCurrentProcessing({ id: receiptId, imageUrl, status: 'extracting' });

    try {
      // The extraction will be handled by the ReceiptDataExtractor component
      // We just need to update our state when it's done
      setTimeout(() => {
        setCurrentProcessing((prev) =>
          prev?.id === receiptId ? { ...prev, status: 'saving' } : prev,
        );
      }, 2000);
    } catch (error) {
      logger.error('Processing error:', error);
      showNotification('error', 'Failed to process receipt');
      setCurrentProcessing(null);
      setProcessingQueue((prev) => prev.filter((id) => id !== receiptId));
    }
  };

  // Handle extraction complete
  const handleExtractionComplete = async (data: Partial<Receipt>) => {
    if (!currentProcessing) return;

    try {
      setCurrentProcessing((prev) => (prev ? { ...prev, status: 'saving' } : null));

      const response = await fetch(`/api/receipts/${currentProcessing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save receipt');

      const savedReceipt = await response.json();

      // Update local state
      setReceipts((prev) => [...prev, savedReceipt]);

      // Remove from processing queue
      setProcessingQueue((prev) => prev.filter((id) => id !== currentProcessing.id));
      setCurrentProcessing(null);

      showNotification('success', 'Receipt processed successfully');

      // Switch to manage tab
      setActiveTab('manage');

      // Notify parent
      if (onReceiptProcessed) {
        onReceiptProcessed(savedReceipt);
      }

      // Refresh stats
      await fetchReceipts();
    } catch (error) {
      logger.error('Save error:', error);
      showNotification('error', 'Failed to save receipt data');
      setCurrentProcessing(null);
    }
  };

  // Handle manual save
  const handleManualSave = async (data: Partial<Receipt>) => {
    try {
      const endpoint = editingReceipt ? `/api/receipts/${editingReceipt.id}` : '/api/receipts';

      const response = await fetch(endpoint, {
        method: editingReceipt ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save receipt');

      showNotification('success', 'Receipt saved successfully');
      setEditingReceipt(null);
      setActiveTab('manage');
      await fetchReceipts();
    } catch (error) {
      logger.error('Save error:', error);
      showNotification('error', 'Failed to save receipt');
    }
  };

  // Delete receipt
  const handleDelete = async (receiptId: string) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete receipt');

      showNotification('success', 'Receipt deleted successfully');
      await fetchReceipts();
    } catch (error) {
      logger.error('Delete error:', error);
      showNotification('error', 'Failed to delete receipt');
    }
  };

  // Reprocess receipt
  const handleReprocess = async (receiptId: string) => {
    try {
      const receipt = receipts.find((r) => r.id === receiptId);
      if (!receipt) return;

      showNotification('info', 'Reprocessing receipt...');
      processReceipt(receiptId, receipt.imageUrl);
    } catch (error) {
      logger.error('Reprocess error:', error);
      showNotification('error', 'Failed to reprocess receipt');
    }
  };

  // Match transactions
  const handleMatch = async (receiptId: string) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}/match`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to match transaction');

      const result = await response.json();

      if (result.matched) {
        showNotification('success', 'Transaction matched successfully');
        await fetchReceipts();
      } else {
        showNotification('warning', 'No matching transaction found');
      }
    } catch (error) {
      logger.error('Match error:', error);
      showNotification('error', 'Failed to match transaction');
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: string, receiptIds: string[]) => {
    try {
      showNotification('info', `Processing ${receiptIds.length} receipts...`);

      const response = await fetch('/api/receipts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, receiptIds }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} receipts`);

      const result = await response.json();
      showNotification('success', result.message);
      await fetchReceipts();
    } catch (error) {
      logger.error('Bulk action error:', error);
      showNotification('error', `Failed to ${action} receipts`);
    }
  };

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipt Management</h1>
          <p className="text-gray-600 mt-1">
            Upload, process, and manage your tax receipts with AI
          </p>
        </div>
        <div className="mt-4 sm:mt-0 text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>📊 {stats.totalReceipts} receipts</span>
            <span>💰 ${stats.totalAmount.toFixed(2)} total</span>
            <span>📈 {stats.matchRate.toFixed(0)}% matched</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <Alert
          className={`
            ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
            ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
            ${notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}
            ${notification.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600">Today's Uploads</p>
            <p className="text-2xl font-bold text-blue-600">{stats.processedToday}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingReview}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total GST</p>
            <p className="text-2xl font-bold text-green-600">${stats.totalGst.toFixed(2)}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600">Processing Queue</p>
            <p className="text-2xl font-bold text-purple-600">{processingQueue.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      {currentProcessing ? (
        // Processing View
        <Card>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Processing Receipt</h2>
              <span className="text-sm text-gray-600">
                {currentProcessing.status === 'uploading' && 'Uploading...'}
                {currentProcessing.status === 'extracting' && 'Extracting data...'}
                {currentProcessing.status === 'saving' && 'Saving...'}
              </span>
            </div>

            <ReceiptDataExtractor
              receiptId={currentProcessing.id}
              imageUrl={currentProcessing.imageUrl}
              onExtractionComplete={handleExtractionComplete}
              onError={(error) => {
                showNotification('error', error);
                setCurrentProcessing(null);
              }}
            />
          </div>
        </Card>
      ) : editingReceipt ? (
        // Edit View
        <Card>
          <ReceiptEditor
            receipt={editingReceipt}
            imageUrl={editingReceipt.imageUrl}
            onSave={handleManualSave}
            onCancel={() => setEditingReceipt(null)}
          />
        </Card>
      ) : (
        // Tabs View
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'upload' | 'manage' | 'insights')}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent
            value="upload"
            className="space-y-4"
          >
            <Card>
              <h2 className="text-lg font-medium mb-4">Upload Receipts</h2>
              <ReceiptUploader
                onUpload={handleUpload}
                maxFiles={10}
                maxSizeMB={10}
              />
            </Card>

            <Card>
              <h2 className="text-lg font-medium mb-4">Manual Entry</h2>
              <p className="text-sm text-gray-600 mb-4">
                Don't have a photo? Enter receipt details manually.
              </p>
              <button
                onClick={() => {
                  setEditingReceipt({
                    id: '',
                    merchant: '',
                    totalAmount: 0,
                    gstAmount: 0,
                    date: new Date().toISOString().split('T')[0],
                    processingStatus: 'MANUAL_ENTRY',
                    imageUrl: '',
                    createdAt: '',
                    updatedAt: '',
                  });
                }}
                className="btn btn-primary"
              >
                Enter Receipt Manually
              </button>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <ReceiptList
              receipts={receipts}
              loading={loading}
              onEdit={setEditingReceipt}
              onDelete={handleDelete}
              onReprocess={handleReprocess}
              onMatch={handleMatch}
              onBulkAction={handleBulkAction}
            />
          </TabsContent>

          <TabsContent
            value="insights"
            className="space-y-4"
          >
            <Card>
              <h2 className="text-lg font-medium mb-4">Receipt Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Merchants */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Top Merchants</h3>
                  <div className="space-y-2">
                    {/* This would be populated from API */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Officeworks</span>
                      <span className="text-sm font-medium">$342.50</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bunnings</span>
                      <span className="text-sm font-medium">$228.90</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Coles</span>
                      <span className="text-sm font-medium">$156.30</span>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Category Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">D5 - Other work expenses</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">D10 - Tax management</span>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">D1 - Car expenses</span>
                      <span className="text-sm font-medium">30%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-medium mb-4">Processing Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">AI Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">92%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Processing Time</p>
                  <p className="text-2xl font-bold text-blue-600">8.2s</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Auto-Match Rate</p>
                  <p className="text-2xl font-bold text-purple-600">78%</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ReceiptProcessor;
