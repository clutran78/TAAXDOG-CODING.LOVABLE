import {
  stripe,
  calculateGST,
  formatCurrency,
  generateTaxInvoiceNumber,
  TaxInvoiceData,
} from '../stripe';
import prisma from '../prisma';
import Stripe from 'stripe';

export class InvoiceService {
  private readonly SUPPLIER_ABN = '12 345 678 901'; // Replace with actual ABN
  private readonly SUPPLIER_NAME = 'TAAX Dog Pty Ltd';
  private readonly SUPPLIER_ADDRESS = '123 Tax Street, Sydney NSW 2000';

  async generateTaxInvoice(stripeInvoiceId: string): Promise<TaxInvoiceData> {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['customer', 'subscription'],
    });

    const customer = invoice.customer as Stripe.Customer;
    const subscription = invoice.subscription as Stripe.Subscription;

    const user = await prisma.user.findFirst({
      where: {
        subscription: {
          stripeCustomerId: customer.id,
        },
      },
    });

    const lineItems = invoice.lines.data.map((item) => {
      const { gstAmount, amountExcludingGST } = calculateGST(item.amount);

      return {
        description: item.description || 'Subscription',
        quantity: item.quantity || 1,
        unitPrice: amountExcludingGST,
        totalPrice: amountExcludingGST,
        gst: gstAmount,
      };
    });

    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalGST = lineItems.reduce((sum, item) => sum + item.gst, 0);

    const taxInvoice: TaxInvoiceData = {
      invoiceNumber: generateTaxInvoiceNumber(),
      date: new Date(invoice.created * 1000),
      customerName: customer.name || user?.name || 'Customer',
      customerEmail: customer.email || user?.email || '',
      customerABN: user?.abn || undefined,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal,
      gstAmount: totalGST,
      total: invoice.amount_paid,
      supplierABN: this.SUPPLIER_ABN,
      supplierName: this.SUPPLIER_NAME,
      supplierAddress: this.SUPPLIER_ADDRESS,
    };

    await this.saveTaxInvoice(taxInvoice, invoice.id);

    return taxInvoice;
  }

  async saveTaxInvoice(invoiceData: TaxInvoiceData, stripeInvoiceId: string) {
    await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        stripeInvoiceId,
        customerName: invoiceData.customerName,
        customerEmail: invoiceData.customerEmail,
        customerABN: invoiceData.customerABN,
        subtotal: invoiceData.subtotal,
        gstAmount: invoiceData.gstAmount,
        total: invoiceData.total,
        status: 'PAID',
        invoiceDate: invoiceData.date,
        lineItems: {
          create: invoiceData.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
    });
  }

  generateInvoiceHTML(invoice: TaxInvoiceData): string {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .invoice-title {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .invoice-details {
      text-align: right;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #555;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .amount {
      text-align: right;
    }
    .total-section {
      margin-top: 20px;
      border-top: 2px solid #333;
      padding-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .total-amount {
      font-weight: bold;
      font-size: 18px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">TAX INVOICE</div>
      <div>${invoice.supplierName}</div>
      <div>ABN: ${invoice.supplierABN}</div>
      <div>${invoice.supplierAddress}</div>
    </div>
    <div class="invoice-details">
      <div><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</div>
      <div><strong>Date:</strong> ${formatDate(invoice.date)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To:</div>
    <div>${invoice.customerName}</div>
    <div>${invoice.customerEmail}</div>
    ${invoice.customerABN ? `<div>ABN: ${invoice.customerABN}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Unit Price (ex GST)</th>
        <th class="amount">Total (ex GST)</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.lineItems
        .map(
          (item) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.unitPrice)}</td>
          <td class="amount">${formatCurrency(item.totalPrice)}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <div>Subtotal (excluding GST):</div>
      <div>${formatCurrency(invoice.subtotal)}</div>
    </div>
    <div class="total-row">
      <div>GST (10%):</div>
      <div>${formatCurrency(invoice.gstAmount)}</div>
    </div>
    <div class="total-row total-amount">
      <div>Total (including GST):</div>
      <div>${formatCurrency(invoice.total)}</div>
    </div>
  </div>

  <div class="footer">
    <p>This tax invoice complies with Australian Tax Office requirements.</p>
    <p>All amounts are in Australian Dollars (AUD).</p>
  </div>
</body>
</html>
    `;
  }

  async getBillingHistory(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      return [];
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 100,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.number,
      date: new Date(invoice.created * 1000),
      amount: invoice.amount_paid,
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
    }));
  }
}
