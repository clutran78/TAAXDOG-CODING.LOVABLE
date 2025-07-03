import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ReceiptData {
  merchant: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  items: ReceiptItem[];
  abn?: string;
  invoiceNumber?: string;
  confidence: number;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstIncluded: boolean;
}

const RECEIPT_EXTRACTION_PROMPT = `
Extract receipt information from this image. Return a JSON object with the following structure:
{
  "merchant": "Business name",
  "totalAmount": 0.00,
  "gstAmount": 0.00,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "gstIncluded": true
    }
  ],
  "abn": "ABN if present",
  "invoiceNumber": "Invoice number if present",
  "confidence": 0.0 to 1.0
}

Important Australian tax considerations:
- GST is 10% in Australia
- Look for ABN (Australian Business Number)
- Check if prices include GST
- Identify tax invoice numbers
- Extract all line items with their GST status

If you cannot extract certain fields with confidence, use null for optional fields.
Ensure all amounts are in AUD.
`;

export async function extractReceiptData(imagePath: string): Promise<ReceiptData> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Read image file
    const imageData = await fs.readFile(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Create image part for Gemini
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg',
      },
    };
    
    // Generate content
    const result = await model.generateContent([RECEIPT_EXTRACTION_PROMPT, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      // Validate and clean data
      return validateReceiptData(data);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse AI response');
    }
  } catch (error) {
    console.error('Gemini AI extraction error:', error);
    throw error;
  }
}

function validateReceiptData(data: any): ReceiptData {
  // Ensure required fields
  const validated: ReceiptData = {
    merchant: data.merchant || 'Unknown Merchant',
    totalAmount: parseFloat(data.totalAmount) || 0,
    gstAmount: parseFloat(data.gstAmount) || 0,
    date: data.date || new Date().toISOString().split('T')[0],
    items: Array.isArray(data.items) ? data.items.map(validateItem) : [],
    confidence: parseFloat(data.confidence) || 0.5,
  };
  
  // Add optional fields if present
  if (data.abn) {
    validated.abn = data.abn.replace(/\s/g, '');
  }
  
  if (data.invoiceNumber) {
    validated.invoiceNumber = data.invoiceNumber;
  }
  
  // Calculate GST if not provided
  if (!validated.gstAmount && validated.totalAmount > 0) {
    // Assume GST inclusive pricing
    validated.gstAmount = validated.totalAmount / 11;
  }
  
  return validated;
}

function validateItem(item: any): ReceiptItem {
  return {
    description: item.description || 'Unknown Item',
    quantity: parseInt(item.quantity) || 1,
    unitPrice: parseFloat(item.unitPrice) || 0,
    totalPrice: parseFloat(item.totalPrice) || 0,
    gstIncluded: item.gstIncluded !== false,
  };
}

export async function processReceipt(receiptId: string, imagePath: string) {
  try {
    const extractedData = await extractReceiptData(imagePath);
    
    // Update receipt in database
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        merchant: extractedData.merchant,
        totalAmount: extractedData.totalAmount,
        gstAmount: extractedData.gstAmount,
        date: new Date(extractedData.date),
        items: extractedData.items,
        abn: extractedData.abn,
        taxInvoiceNumber: extractedData.invoiceNumber,
        aiProcessed: true,
        aiConfidence: extractedData.confidence,
        processingStatus: extractedData.confidence > 0.8 ? 'PROCESSED' : 'MANUAL_REVIEW',
        isGstRegistered: !!extractedData.abn,
      },
    });
    
    await prisma.$disconnect();
    return updatedReceipt;
  } catch (error) {
    console.error('Receipt processing error:', error);
    
    // Update status to failed
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        processingStatus: 'FAILED',
        aiProcessed: true,
      },
    });
    
    await prisma.$disconnect();
    throw error;
  }
}