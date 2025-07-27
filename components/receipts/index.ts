// Receipt Components Index
// Export all receipt processing components for easy importing

export { ReceiptUploader } from './ReceiptUploader';
export { ReceiptPreview } from './ReceiptPreview';
export { ReceiptDataExtractor } from './ReceiptDataExtractor';
export { ReceiptEditor } from './ReceiptEditor';
export { ReceiptList } from './ReceiptList';
export { ReceiptProcessor } from './ReceiptProcessor';
export { ReceiptManagement } from './ReceiptManagement';
export { ManualReviewInterface } from './ManualReviewInterface';

// Export types
export type {
  Receipt,
  ReceiptStatus,
  ReceiptItem,
  ExtractedData,
  DataSuggestion,
  ReceiptMetadata,
} from './types';

// Type definitions
export interface ReceiptMetadata {
  fileName?: string;
  fileSize?: number;
  uploadDate?: string;
  dimensions?: { width: number; height: number };
  processingStatus?: string;
}

export interface Receipt {
  id: string;
  merchant: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  processingStatus: ReceiptStatus;
  aiConfidence?: number;
  imageUrl: string;
  taxCategory?: string;
  matchedTransactionId?: string;
  abn?: string;
  taxInvoiceNumber?: string;
  notes?: string;
  items?: ReceiptItem[];
  createdAt: string;
  updatedAt: string;
}

export type ReceiptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'MATCHED'
  | 'MANUAL_REVIEW'
  | 'FAILED';

export interface ReceiptItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstIncluded: boolean;
}

export interface ExtractedData {
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

export interface ExtractedItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  gstIncluded?: boolean;
}

export interface DataSuggestion {
  field: string;
  suggestedValue: string;
  confidence: number;
  reason?: string;
}
