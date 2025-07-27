# Australian Business Compliance Features for TAAXDOG

## Overview

TAAXDOG now includes comprehensive Australian business compliance features
including GST extraction, ABN verification, input tax credit calculations, and
BAS preparation. This enhancement transforms TAAXDOG into a complete Australian
tax compliance platform for both individual taxpayers and businesses.

---

## 🎯 **Key Features Implemented**

### ✅ **1. GST Extraction & Validation**

- **Automatic GST Detection**: Intelligent extraction of GST amounts from
  receipts
- **Smart Calculation**: 10% Australian GST calculation with confidence scoring
- **Merchant Rules**: GST-free merchant recognition (groceries, medical,
  education)
- **Validation**: Cross-verification with ATO GST rules

### ✅ **2. ABN Verification System**

- **Real-time Verification**: Official Australian Business Register API
  integration
- **Checksum Validation**: Mathematical ABN validation algorithm
- **Entity Information**: Business name, type, and GST registration status
- **Fallback Support**: Offline validation when API unavailable

### ✅ **3. Input Tax Credit Calculations**

- **Automatic ITC**: Calculate eligible input tax credits for business users
- **Business Use %**: Determine business use percentage by category
- **Creditable %**: Apply ATO creditable percentage rules
- **Evidence Requirements**: Generate required documentation lists

### ✅ **4. BAS Preparation Data**

- **Quarter Processing**: Automated BAS quarter data preparation
- **Annual Summaries**: Full-year BAS reporting across all quarters
- **GST Totals**: Sales GST, input tax credits, and net GST calculations
- **PAYG Integration**: PAYG withholding and instalment tracking

---

## 🏗️ **System Architecture**

### **Core Modules**

#### **1. Australian Business Compliance (`backend/australian_business_compliance.py`)**

```python
class AustralianBusinessCompliance:
    - verify_abn(abn: str) -> ABNDetails
    - extract_gst_from_receipt(receipt_data: Dict) -> GSTExtraction
    - calculate_input_tax_credit(...) -> InputTaxCredit
    - prepare_bas_quarter_data(...) -> BASQuarterData
```

#### **2. Enhanced Tax Categorizer (`backend/australian_tax_categorizer.py`)**

- Complete Australian tax categories (D1-D15, P8, Personal)
- Occupation-specific rules for healthcare, teachers, tradespeople, IT
- Business vs individual taxpayer logic
- Confidence scoring and evidence requirements

#### **3. Configuration (`backend/receipt_processor_config.py`)**

- ABR API settings and merchant patterns
- Business compliance thresholds and rules
- Tax category compliance mapping
- Performance and caching configurations

---

## 🔗 **API Endpoints**

### **Receipt Compliance Endpoints**

#### **GET `/api/receipts/<receipt_id>/gst`**

Extract and analyze GST information from a receipt.

**Response:**

```json
{
  "success": true,
  "gst_details": {
    "total_amount": 110.0,
    "gst_amount": 10.0,
    "gst_free_amount": 0.0,
    "gst_inclusive_amount": 110.0,
    "gst_rate": 0.1,
    "extraction_confidence": 0.9,
    "extraction_method": "explicit_gst_amount",
    "requires_verification": false
  }
}
```

#### **GET `/api/receipts/<receipt_id>/input-tax-credit`**

Calculate input tax credit eligibility for business users.

**Response:**

```json
{
  "success": true,
  "input_tax_credit": {
    "eligible_amount": 110.0,
    "gst_credit": 10.0,
    "business_use_percentage": 1.0,
    "creditable_percentage": 1.0,
    "reasoning": "Fully creditable: Business expense, 100% business use",
    "evidence_required": [
      "Tax invoice showing GST amount",
      "Business purpose documentation"
    ],
    "category_code": "P8"
  }
}
```

#### **POST `/api/receipts/verify-abn`**

Verify an Australian Business Number.

**Request:**

```json
{
  "abn": "51 824 753 556",
  "abr_api_key": "optional_api_key"
}
```

**Response:**

```json
{
  "success": true,
  "abn_details": {
    "abn": "51824753556",
    "is_valid": true,
    "entity_name": "Example Pty Ltd",
    "entity_type": "Company",
    "status": "Active",
    "gst_registered": true,
    "gst_from_date": "2020-01-01",
    "gst_to_date": null
  }
}
```

#### **POST `/api/receipts/bulk/gst-analysis`**

Analyze GST across multiple receipts for compliance reporting.

### **Financial Compliance Endpoints**

#### **POST `/api/financial/bas/quarter-data`**

Prepare BAS quarter data for a specific quarter.

**Request:**

```json
{
  "year": 2024,
  "quarter_num": 1
}
```

**Response:**

```json
{
  "success": true,
  "bas_quarter_data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-03-31",
      "quarter": "Q1 2024"
    },
    "gst_summary": {
      "sales_gst": 5250.0,
      "input_tax_credits": 1820.5,
      "net_gst": 3429.5
    },
    "payg_summary": {
      "withholding": 2500.0,
      "instalment": 1200.0
    },
    "total_refund_payable": 7129.5
  }
}
```

#### **GET `/api/financial/bas/annual-summary?year=2024`**

Get annual BAS summary across all quarters.

#### **GET `/api/financial/business/abn-status`**

Get business ABN status and GST registration details.

#### **GET `/api/financial/business/compliance-checklist`**

Get business compliance checklist for Australian tax obligations.

---

## 💼 **Business Logic**

### **GST Calculation Rules**

1. **Explicit GST**: Look for GST amount in receipt fields
2. **Merchant Rules**: Apply GST-free status for groceries, medical, education
3. **Default Calculation**: Assume GST-inclusive, calculate 1/11th as GST
4. **Confidence Scoring**: Rate extraction confidence based on method

### **Input Tax Credit Eligibility**

1. **GST Registration**: User must be GST registered
2. **Business Use**: Determine percentage of business use
3. **Creditable Categories**: Apply ATO creditable percentage rules
4. **Evidence Requirements**: Generate compliance documentation needs

### **BAS Quarter Processing**

1. **Transaction Analysis**: Process all transactions in date range
2. **Receipt Integration**: Include uploaded receipts with GST extraction
3. **Categorization**: Apply tax categorization to determine treatment
4. **Summary Generation**: Calculate totals for BAS form completion

### **ABN Verification**

1. **Format Validation**: Check 11-digit format
2. **Checksum Algorithm**: Apply official ABN checksum validation
3. **API Lookup**: Query ABR for entity details (if API key provided)
4. **Caching**: Cache results for performance

---

## 🎨 **Integration Points**

### **With Existing Tax Categorizer**

- Enhanced categorization with GST awareness
- Business use percentage calculation
- Evidence requirement generation
- Occupation-specific rules for business users

### **With Receipt Processing**

- Automatic GST extraction during OCR processing
- Enhanced merchant recognition
- Business compliance validation
- Input tax credit calculation

### **With Financial Analysis**

- BAS preparation from transaction data
- Business compliance status monitoring
- Tax obligation tracking
- Quarterly and annual reporting

### **With User Profile System**

- ABN and GST registration status
- Entity type determination
- Business vs individual logic
- Compliance requirement assessment

---

## 📊 **Compliance Features**

### **ATO Compliance**

- ✅ Australian tax categories (D1-D15, P8)
- ✅ GST calculation and validation
- ✅ Input tax credit rules
- ✅ BAS preparation requirements
- ✅ Record keeping standards

### **Business Requirements**

- ✅ ABN verification and validation
- ✅ GST registration threshold monitoring
- ✅ Entity type classification
- ✅ Quarterly BAS preparation
- ✅ Annual reporting summaries

### **Evidence & Documentation**

- ✅ Category-specific evidence requirements
- ✅ Business purpose documentation
- ✅ Logbook and diary requirements
- ✅ Tax invoice validation
- ✅ Compliance checklist tracking

---

## 🚀 **Usage Examples**

### **For Individual Taxpayers**

1. Upload receipts for automatic categorization
2. Get personalized deduction recommendations
3. Track work-related expenses with confidence scoring
4. Generate evidence requirements for tax return

### **For Business Users (ABN holders)**

1. Verify ABN and GST registration status
2. Extract GST from business receipts automatically
3. Calculate input tax credits for creditable purchases
4. Prepare quarterly BAS data
5. Monitor compliance obligations

### **For Tax Professionals**

1. Access client BAS preparation data
2. Review categorization confidence scores
3. Generate compliance checklists
4. Monitor business tax obligations

---

## 🔧 **Configuration & Setup**

### **Environment Variables**

```bash
# Optional - for enhanced ABN verification
ABR_API_KEY=your_abr_api_key_here

# Required for receipt processing
GEMINI_API_KEY=your_gemini_api_key
```

### **Configuration Settings**

- GST threshold: $75,000 (automatic GST registration requirement)
- Simplified invoice threshold: $82.50 (detailed tax invoice requirement)
- BAS quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
- Record retention: 7 years (ATO requirement)

---

## 📈 **Performance & Scalability**

### **Optimization Features**

- ABN lookup caching (24-hour duration)
- Merchant rule caching for performance
- Parallel processing support (future enhancement)
- Bulk processing for multiple receipts

### **Error Handling**

- Graceful API failure handling
- Fallback validation methods
- Retry mechanisms with exponential backoff
- Comprehensive error logging

---

## 🔮 **Future Enhancements**

### **Planned Features**

- Real-time ATO integration for lodgment
- Automated BAS form generation (PDF)
- PAYG calculation automation
- FBT (Fringe Benefits Tax) support
- Multi-entity business support

### **Advanced Capabilities**

- Machine learning for categorization improvement
- Blockchain receipt verification
- AI-powered compliance recommendations
- Integration with accounting software

---

## 📋 **Testing & Validation**

### **Test Coverage**

- ABN checksum validation algorithms
- GST calculation accuracy
- Input tax credit calculations
- BAS quarter data preparation
- API endpoint functionality

### **Compliance Testing**

- ATO guideline adherence
- Tax category accuracy
- Evidence requirement completeness
- Business rule validation

---

This comprehensive Australian business compliance system transforms TAAXDOG into
a complete tax compliance platform, providing both individual taxpayers and
businesses with the tools they need to meet their Australian tax obligations
efficiently and accurately.
