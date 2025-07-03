-- Create receipts table for Australian tax compliance
CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    merchant VARCHAR(255),
    total_amount DECIMAL(15,2),
    gst_amount DECIMAL(15,2),
    date DATE,
    items JSONB,
    image_url VARCHAR(500),
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    ai_provider VARCHAR(50),
    ai_model VARCHAR(100),
    processing_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_merchant ON receipts(merchant);
CREATE INDEX idx_receipts_processing_status ON receipts(processing_status);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE
    ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();