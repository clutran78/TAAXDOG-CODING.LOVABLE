#!/usr/bin/env python3
"""
Enhanced Gemini 2.0 Flash OCR Test Script for Australian Tax Compliance

This script demonstrates the enhanced OCR capabilities including:
- Australian tax category suggestions (D1-D15, P8, Personal)
- GST extraction and calculation (10% Australian standard)
- Confidence scoring for each extracted field
- Australian date format parsing (DD/MM/YYYY)
- Business vs personal expense classification
"""

import sys
import os
import json
from pathlib import Path

# Add the src directory to the path
sys.path.append(str(Path(__file__).parent / "src"))

try:
    from integrations.formx_client import extract_data_from_image_with_gemini, AUSTRALIAN_TAX_CATEGORIES, MERCHANT_TAX_CATEGORY_MAPPING
except ImportError as e:
    print(f"Error importing: {e}")
    print("Make sure you're running this from the project root directory")
    sys.exit(1)


def test_receipt_extraction(image_path: str):
    """Test receipt extraction with enhanced Australian tax compliance features."""
    
    print("=" * 80)
    print("ENHANCED GEMINI 2.0 FLASH OCR - AUSTRALIAN TAX COMPLIANCE TEST")
    print("=" * 80)
    print(f"Processing: {image_path}")
    print()
    
    # Check if file exists
    if not os.path.exists(image_path):
        print(f"❌ Error: File not found - {image_path}")
        return False
    
    try:
        # Extract data using enhanced Gemini OCR
        result = extract_data_from_image_with_gemini(image_path)
        
        if not result.get("success"):
            print(f"❌ Extraction failed: {result.get('error', 'Unknown error')}")
            if 'raw_response' in result:
                print(f"Raw response preview: {result['raw_response']}")
            return False
        
        # Get extracted data and metadata
        data = result["documents"][0]["data"]
        metadata = result["processing_metadata"]
        
        print("✅ EXTRACTION SUCCESSFUL")
        print()
        
        # Display key extracted information
        print("📄 RECEIPT DETAILS")
        print("-" * 40)
        print(f"Merchant Name:      {data.get('merchant_name', 'N/A')}")
        print(f"ABN:                {data.get('abn', 'N/A')}")
        print(f"Date:               {data.get('date', 'N/A')}")
        print(f"Time:               {data.get('time', 'N/A')}")
        print()
        
        # Financial information
        print("💰 FINANCIAL DETAILS")
        print("-" * 40)
        total = data.get('total_amount', 0)
        subtotal = data.get('subtotal', 0)
        gst = data.get('gst_amount', 0)
        gst_method = data.get('gst_calculation_method', 'N/A')
        
        print(f"Total Amount:       ${total:.2f}")
        print(f"Subtotal:           ${subtotal:.2f}")
        print(f"GST Amount:         ${gst:.2f}")
        print(f"GST Rate:           {data.get('gst_rate', 0):.1f}%")
        print(f"GST Method:         {gst_method}")
        print(f"Payment Method:     {data.get('payment_method', 'N/A')}")
        print()
        
        # Tax categorization
        print("🏛️  AUSTRALIAN TAX COMPLIANCE")
        print("-" * 40)
        category = data.get('australian_tax_category', 'N/A')
        business_likelihood = data.get('business_expense_likelihood', 0)
        business_flag = data.get('business_expense', False)
        
        print(f"Tax Category:       {category}")
        if category in AUSTRALIAN_TAX_CATEGORIES:
            print(f"Category Desc:      {AUSTRALIAN_TAX_CATEGORIES[category]}")
        print(f"Business Likelihood: {business_likelihood:.1%}")
        print(f"Business Expense:   {'Yes' if business_flag else 'No'}")
        print()
        
        # Quality metrics
        print("📊 QUALITY METRICS")
        print("-" * 40)
        confidence = metadata.get('confidence', 0)
        text_quality = metadata.get('text_quality', 0)
        
        print(f"Overall Confidence: {confidence:.1%}")
        print(f"Text Quality:       {text_quality:.1%}")
        print(f"GST Extracted:      {'Yes' if metadata.get('gst_extracted') else 'No'}")
        print()
        
        # Items breakdown (if available)
        items = data.get('items', [])
        if items:
            print("🛒 ITEMS BREAKDOWN")
            print("-" * 40)
            for i, item in enumerate(items, 1):
                name = item.get('name', 'Unknown Item')
                qty = item.get('quantity', 1)
                price = item.get('total_price', 0)
                print(f"{i}. {name} (x{qty}) - ${price:.2f}")
            print()
        
        # Merchant details (if available)
        merchant_details = data.get('merchant_details', {})
        if merchant_details:
            print("🏪 MERCHANT DETAILS")
            print("-" * 40)
            for key, value in merchant_details.items():
                if value:
                    print(f"{key.title()}: {value}")
            print()
        
        # Enhanced features summary
        enhanced_features = metadata.get('enhanced_features', {})
        if enhanced_features:
            print("🚀 ENHANCED FEATURES USED")
            print("-" * 40)
            for feature, enabled in enhanced_features.items():
                status = "✅" if enabled else "❌"
                feature_name = feature.replace('_', ' ').title()
                print(f"{status} {feature_name}")
            print()
        
        # Categorization analysis
        print("🔍 CATEGORIZATION ANALYSIS")
        print("-" * 40)
        merchant_name = data.get('merchant_name', '').lower()
        matched_merchants = [key for key in MERCHANT_TAX_CATEGORY_MAPPING if key in merchant_name]
        if matched_merchants:
            print(f"Matched Keywords:   {', '.join(matched_merchants)}")
            suggested_category = MERCHANT_TAX_CATEGORY_MAPPING[matched_merchants[0]]
            print(f"Suggested Category: {suggested_category}")
        else:
            print("No keyword matches found in merchant mapping")
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def show_tax_categories():
    """Display available Australian tax categories."""
    print("📋 AUSTRALIAN TAX CATEGORIES")
    print("=" * 50)
    for code, description in AUSTRALIAN_TAX_CATEGORIES.items():
        print(f"{code:8} - {description}")
    print()


def show_merchant_mapping():
    """Display merchant keyword mapping for tax categories."""
    print("🏪 MERCHANT KEYWORD MAPPING")
    print("=" * 50)
    
    # Group by category
    category_groups = {}
    for merchant, category in MERCHANT_TAX_CATEGORY_MAPPING.items():
        if category not in category_groups:
            category_groups[category] = []
        category_groups[category].append(merchant)
    
    for category in sorted(category_groups.keys()):
        print(f"\n{category} - {AUSTRALIAN_TAX_CATEGORIES.get(category, 'Unknown')}")
        print("-" * 30)
        merchants = sorted(category_groups[category])
        for merchant in merchants:
            print(f"  • {merchant}")
    print()


def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 2:
        print("Enhanced Gemini 2.0 Flash OCR for Australian Tax Compliance")
        print("=" * 60)
        print()
        print("Usage:")
        print("  python test_enhanced_gemini.py <receipt_image_path>")
        print("  python test_enhanced_gemini.py --categories")
        print("  python test_enhanced_gemini.py --merchants")
        print()
        print("Examples:")
        print("  python test_enhanced_gemini.py receipt.jpg")
        print("  python test_enhanced_gemini.py /path/to/receipt.png")
        print()
        return
    
    arg = sys.argv[1]
    
    if arg == "--categories":
        show_tax_categories()
    elif arg == "--merchants":
        show_merchant_mapping()
    else:
        # Test receipt extraction
        success = test_receipt_extraction(arg)
        if success:
            print("🎉 Test completed successfully!")
        else:
            print("💥 Test failed!")
            sys.exit(1)


if __name__ == "__main__":
    main() 