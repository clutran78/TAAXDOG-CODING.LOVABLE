/**
 * Receipt type definitions
 */

import { MoneyAmount, GSTAmount } from './financial';
import { TaxCategory } from './transactions';
import { AuditInfo, FileInfo } from './common';

// Receipt status
export enum ReceiptStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

// Receipt processing status
export enum ProcessingStatus {
  PENDING = 'PENDING',
  OCR_IN_PROGRESS = 'OCR_IN_PROGRESS',
  OCR_COMPLETE = 'OCR_COMPLETE',
  AI_PROCESSING = 'AI_PROCESSING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

// Payment methods
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  AFTERPAY = 'AFTERPAY',
  OTHER = 'OTHER',
}

// Main receipt interface
export interface Receipt extends AuditInfo {
  id: string;
  userId: string;

  // Receipt details
  merchant: string;
  merchantAbn?: string | null;
  receiptNumber?: string | null;
  receiptDate: Date;

  // Amounts
  totalAmount: number;
  currency: 'AUD';
  gstAmount?: number | null;
  netAmount: number;

  // Processing
  status: ReceiptStatus;
  processingStatus: ProcessingStatus;

  // Categorization
  category: string;
  taxCategory?: TaxCategory | null;
  isBusinessExpense: boolean;

  // Payment info
  paymentMethod?: PaymentMethod | null;
  lastFourDigits?: string | null;

  // Files
  originalFileUrl: string;
  processedFileUrl?: string | null;
  thumbnailUrl?: string | null;
  fileMetadata?: FileInfo | null;

  // Extracted data
  extractedData?: ExtractedReceiptData | null;
  confidence?: number | null; // OCR confidence 0-100

  // Line items
  items?: ReceiptItem[];

  // Linked entities
  transactionId?: string | null;
  expenseReportId?: string | null;

  // Additional data
  notes?: string | null;
  tags?: string[];
  location?: ReceiptLocation | null;

  // Verification
  isVerified: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;

  // Soft delete
  deletedAt?: Date | null;
}

// Receipt line items
export interface ReceiptItem {
  id: string;
  receiptId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstAmount?: number | null;
  gstIncluded: boolean;
  category?: string | null;
  taxCategory?: TaxCategory | null;
}

// Extracted receipt data from OCR/AI
export interface ExtractedReceiptData {
  merchant: {
    name: string;
    abn?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  transaction: {
    date: string;
    time?: string;
    receiptNumber?: string;
    paymentMethod?: string;
    cardLastFour?: string;
  };
  amounts: {
    subtotal?: number;
    gst?: number;
    total: number;
    paid?: number;
    change?: number;
  };
  items: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
    gstIncluded?: boolean;
  }>;
  rawText?: string;
}

// Receipt location
export interface ReceiptLocation {
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Receipt upload DTO
export interface UploadReceiptInput {
  file: File | string; // File object or base64 string
  merchant?: string;
  totalAmount?: number;
  date?: Date;
  category?: string;
  notes?: string;
  transactionId?: string;
}

// Receipt update DTO
export interface UpdateReceiptInput {
  merchant?: string;
  merchantAbn?: string;
  totalAmount?: number;
  gstAmount?: number;
  receiptDate?: Date;
  category?: string;
  taxCategory?: TaxCategory;
  isBusinessExpense?: boolean;
  paymentMethod?: PaymentMethod;
  notes?: string;
  tags?: string[];
}

// Receipt search filters
export interface ReceiptFilters {
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  merchant?: string;
  category?: string;
  taxCategory?: TaxCategory;
  isBusinessExpense?: boolean;
  status?: ReceiptStatus;
  hasTransaction?: boolean;
  search?: string;
}

// Receipt analytics
export interface ReceiptAnalytics {
  totalReceipts: number;
  totalAmount: MoneyAmount;
  totalGST: MoneyAmount;
  averageAmount: MoneyAmount;
  processingStats: {
    uploaded: number;
    processing: number;
    processed: number;
    failed: number;
  };
  byCategory: Array<{
    category: string;
    count: number;
    totalAmount: MoneyAmount;
    percentage: number;
  }>;
  byMerchant: Array<{
    merchant: string;
    count: number;
    totalAmount: MoneyAmount;
    lastReceipt: Date;
  }>;
  taxDeductible: {
    count: number;
    totalAmount: MoneyAmount;
    totalGST: MoneyAmount;
    potentialDeduction: MoneyAmount;
  };
}

// Bulk receipt operations
export interface BulkReceiptOperation {
  receiptIds: string[];
  operation: 'CATEGORIZE' | 'VERIFY' | 'DELETE' | 'EXPORT';
  data?: {
    category?: string;
    taxCategory?: TaxCategory;
    isBusinessExpense?: boolean;
  };
}
