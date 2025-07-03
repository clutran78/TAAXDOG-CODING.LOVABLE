-- Add new fields to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS interval VARCHAR(20) DEFAULT 'month',
ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'aud',
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "lastPaymentAttempt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "failedPaymentCount" INTEGER DEFAULT 0;

-- Create unique constraint on userId for subscriptions
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_userId_unique UNIQUE ("userId");

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "stripePaymentIntentId" VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS payments_userId_idx ON payments("userId");
CREATE INDEX IF NOT EXISTS payments_createdAt_idx ON payments("createdAt");

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceNumber" VARCHAR(50) UNIQUE NOT NULL,
    "stripeInvoiceId" VARCHAR(255) UNIQUE NOT NULL,
    "customerName" VARCHAR(255) NOT NULL,
    "customerEmail" VARCHAR(255) NOT NULL,
    "customerABN" VARCHAR(20),
    subtotal INTEGER NOT NULL,
    "gstAmount" INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    "invoiceDate" TIMESTAMP NOT NULL,
    "paidAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS invoices_invoiceNumber_idx ON invoices("invoiceNumber");
CREATE INDEX IF NOT EXISTS invoices_stripeInvoiceId_idx ON invoices("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS invoices_customerEmail_idx ON invoices("customerEmail");

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("invoiceId") REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create index for invoice_line_items
CREATE INDEX IF NOT EXISTS invoice_line_items_invoiceId_idx ON invoice_line_items("invoiceId");

-- Update trigger for updatedAt columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for new tables
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_line_items_updated_at BEFORE UPDATE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();