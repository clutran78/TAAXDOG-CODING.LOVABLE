"""
Pytest configuration and shared fixtures for TAAXDOG receipt processing tests
"""

import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os
import json
import base64
from PIL import Image, ImageDraw, ImageFont
import io
from datetime import datetime, timedelta
import time
from decimal import Decimal

# Import TAAXDOG modules
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.app import create_app
from firebase_config import db
from src.integrations.formx_client import initialize_gemini_api
from backend.australian_tax_categorizer import AustralianTaxCategorizer, TaxCategory
from backend.australian_business_compliance import AustralianBusinessCompliance


# Test Configuration
@pytest.fixture(scope="session")
def test_app():
    """Create a test Flask application"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['FIREBASE_TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.app_context():
        yield app.test_client()


@pytest.fixture
def mock_firebase():
    """Mock Firebase database operations"""
    with patch('firebase_config.db') as mock_db:
        # Mock collection and document operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        mock_doc = Mock()
        
        mock_doc.to_dict.return_value = {
            'user_id': 'test_user_123',
            'id': 'test_receipt_123',
            'amount': 45.50,
            'merchant': 'Test Merchant',
            'date': '2024-01-15'
        }
        
        mock_doc_ref.get.return_value = mock_doc
        mock_collection.document.return_value = mock_doc_ref
        mock_collection.add.return_value = (mock_doc_ref, 'test_doc_id')
        mock_collection.where.return_value.get.return_value = [mock_doc]
        
        mock_db.collection.return_value = mock_collection
        
        yield mock_db


@pytest.fixture
def sample_receipt_image():
    """Create a test receipt image with realistic content"""
    # Create a white background image (receipt size)
    img = Image.new('RGB', (800, 1200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a basic font, fall back to default if not available
    try:
        font_large = ImageFont.truetype("arial.ttf", 24)
        font_medium = ImageFont.truetype("arial.ttf", 18)
        font_small = ImageFont.truetype("arial.ttf", 14)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw receipt content
    y_pos = 50
    
    # Header
    draw.text((300, y_pos), "OFFICEWORKS", fill='black', font=font_large)
    y_pos += 40
    draw.text((250, y_pos), "ABN: 13 004 590 964", fill='black', font=font_small)
    y_pos += 30
    
    # Store details
    draw.text((200, y_pos), "123 Collins Street, Melbourne VIC 3000", fill='black', font=font_small)
    y_pos += 20
    draw.text((300, y_pos), "Ph: (03) 9123 4567", fill='black', font=font_small)
    y_pos += 40
    
    # Date and transaction details
    draw.text((50, y_pos), "Date: 15/01/2024", fill='black', font=font_medium)
    draw.text((450, y_pos), "Time: 14:30", fill='black', font=font_medium)
    y_pos += 30
    draw.text((50, y_pos), "Transaction: T123456789", fill='black', font=font_small)
    y_pos += 40
    
    # Line separator
    draw.line([(50, y_pos), (750, y_pos)], fill='black', width=1)
    y_pos += 20
    
    # Items
    items = [
        ("A4 Copy Paper 500 sheets", "1", "$15.95"),
        ("Black Ink Cartridge HP 64", "2", "$89.00"),
        ("Lever Arch Files (5 pack)", "1", "$12.50")
    ]
    
    for item_name, qty, price in items:
        draw.text((50, y_pos), item_name, fill='black', font=font_small)
        draw.text((550, y_pos), f"Qty: {qty}", fill='black', font=font_small)
        draw.text((650, y_pos), price, fill='black', font=font_small)
        y_pos += 25
    
    y_pos += 20
    draw.line([(50, y_pos), (750, y_pos)], fill='black', width=1)
    y_pos += 20
    
    # Totals
    draw.text((500, y_pos), "Subtotal:", fill='black', font=font_medium)
    draw.text((650, y_pos), "$107.73", fill='black', font=font_medium)
    y_pos += 25
    draw.text((500, y_pos), "GST (10%):", fill='black', font=font_medium)
    draw.text((650, y_pos), "$10.77", fill='black', font=font_medium)
    y_pos += 25
    draw.text((500, y_pos), "TOTAL:", fill='black', font=font_large)
    draw.text((650, y_pos), "$118.50", fill='black', font=font_large)
    y_pos += 40
    
    # Payment method
    draw.text((200, y_pos), "Payment Method: EFTPOS Card", fill='black', font=font_medium)
    y_pos += 30
    
    # Footer
    draw.text((250, y_pos), "Thank you for shopping with us!", fill='black', font=font_small)
    y_pos += 20
    draw.text((200, y_pos), "Returns accepted within 30 days with receipt", fill='black', font=font_small)
    
    return img


@pytest.fixture
def sample_receipt_variants():
    """Create various receipt types for comprehensive testing"""
    receipts = {}
    
    # 1. Bunnings receipt (D6 - Tools/Equipment)
    bunnings_img = Image.new('RGB', (600, 800), color='white')
    bunnings_draw = ImageDraw.Draw(bunnings_img)
    bunnings_draw.text((200, 50), "BUNNINGS WAREHOUSE", fill='black')
    bunnings_draw.text((150, 100), "ABN: 87 008 672 179", fill='black')
    bunnings_draw.text((50, 200), "Cordless Drill", fill='black')
    bunnings_draw.text((50, 250), "Safety Glasses", fill='black')
    bunnings_draw.text((400, 400), "Total: $89.50", fill='black')
    receipts['bunnings'] = bunnings_img
    
    # 2. Shell fuel receipt (D1 - Car expenses)
    shell_img = Image.new('RGB', (600, 800), color='white')
    shell_draw = ImageDraw.Draw(shell_img)
    shell_draw.text((250, 50), "SHELL", fill='black')
    shell_draw.text((150, 100), "Unleaded 91 - 45.2L", fill='black')
    shell_draw.text((400, 300), "Total: $67.80", fill='black')
    receipts['shell'] = shell_img
    
    # 3. Woolworths grocery receipt (Personal)
    woolworths_img = Image.new('RGB', (600, 800), color='white')
    woolworths_draw = ImageDraw.Draw(woolworths_img)
    woolworths_draw.text((200, 50), "WOOLWORTHS", fill='black')
    woolworths_draw.text((50, 150), "Milk 2L", fill='black')
    woolworths_draw.text((50, 200), "Bread Loaf", fill='black')
    woolworths_draw.text((400, 400), "Total: $8.95", fill='black')
    receipts['woolworths'] = woolworths_img
    
    # 4. Restaurant receipt (D2 - Travel/Meals - if business)
    restaurant_img = Image.new('RGB', (600, 800), color='white')
    restaurant_draw = ImageDraw.Draw(restaurant_img)
    restaurant_draw.text((200, 50), "THE COFFEE CLUB", fill='black')
    restaurant_draw.text((50, 150), "Business Lunch", fill='black')
    restaurant_draw.text((50, 200), "2x Coffee", fill='black')
    restaurant_draw.text((400, 400), "Total: $35.50", fill='black')
    receipts['restaurant'] = restaurant_img
    
    # 5. Poor quality/faded receipt
    faded_img = Image.new('RGB', (600, 800), color=(240, 240, 240))  # Light gray background
    faded_draw = ImageDraw.Draw(faded_img)
    faded_draw.text((200, 50), "FADED RECEIPT", fill=(100, 100, 100))  # Gray text
    faded_draw.text((50, 150), "Hard to read", fill=(120, 120, 120))
    receipts['faded'] = faded_img
    
    return receipts


@pytest.fixture
def sample_receipt_files(tmp_path, sample_receipt_image, sample_receipt_variants):
    """Create temporary receipt image files for testing"""
    files = {}
    
    # Main test receipt
    main_receipt_path = tmp_path / "test_receipt.jpg"
    sample_receipt_image.save(main_receipt_path, format='JPEG')
    files['main'] = str(main_receipt_path)
    
    # Variant receipts
    for name, img in sample_receipt_variants.items():
        file_path = tmp_path / f"{name}_receipt.jpg"
        img.save(file_path, format='JPEG')
        files[name] = str(file_path)
    
    # Different formats
    png_path = tmp_path / "test_receipt.png"
    sample_receipt_image.save(png_path, format='PNG')
    files['png'] = str(png_path)
    
    # Large file (for size testing)
    large_img = sample_receipt_image.resize((3000, 4000))
    large_path = tmp_path / "large_receipt.jpg"
    large_img.save(large_path, format='JPEG', quality=95)
    files['large'] = str(large_path)
    
    # Corrupted file
    corrupt_path = tmp_path / "corrupt_receipt.jpg"
    with open(corrupt_path, 'wb') as f:
        f.write(b'This is not an image file')
    files['corrupt'] = str(corrupt_path)
    
    return files


@pytest.fixture
def mock_gemini_api():
    """Mock Gemini API responses for testing"""
    with patch('src.integrations.formx_client.model') as mock_model:
        # Successful response
        mock_response = Mock()
        mock_response.text = json.dumps({
            "merchant_name": "OFFICEWORKS",
            "abn": "13 004 590 964",
            "date": "2024-01-15",
            "time": "14:30",
            "total_amount": 118.50,
            "subtotal": 107.73,
            "gst_amount": 10.77,
            "gst_rate": 10.0,
            "gst_calculation_method": "explicit",
            "payment_method": "EFTPOS Card",
            "suggested_tax_category": "D5",
            "business_expense_likelihood": 0.8,
            "confidence_score": 0.9,
            "text_quality_score": 0.95,
            "items": [
                {"name": "A4 Copy Paper 500 sheets", "quantity": 1, "price": 15.95},
                {"name": "Black Ink Cartridge HP 64", "quantity": 2, "price": 44.50},
                {"name": "Lever Arch Files (5 pack)", "quantity": 1, "price": 12.50}
            ]
        })
        
        mock_model.generate_content.return_value = mock_response
        yield mock_model


@pytest.fixture
def sample_user_profile():
    """Sample user tax profile for testing categorization"""
    return {
        "personalInfo": {
            "entity_type": "INDIVIDUAL",
            "occupation": "Software Developer",
            "industry": "Information Technology",
            "annual_income": 85000,
            "business_use_vehicle": True,
            "home_office": True
        },
        "taxInfo": {
            "tfn": "123456789",
            "abn": None,
            "gst_registered": False,
            "income_sources": ["SALARY"],
            "claiming_categories": ["D1", "D4", "D5"]
        },
        "preferences": {
            "default_work_percentage": 0.8,
            "automatic_categorization": True
        }
    }


@pytest.fixture
def sample_transactions():
    """Sample banking transactions for matching tests"""
    return [
        {
            "id": "txn_001",
            "account_id": "acc_123",
            "amount": "-118.50",
            "description": "EFTPOS OFFICEWORKS MELBOURNE",
            "postDate": "2024-01-15T14:30:00Z",
            "category": "shopping",
            "merchant": {
                "name": "OFFICEWORKS",
                "category": "office_supplies"
            }
        },
        {
            "id": "txn_002", 
            "account_id": "acc_123",
            "amount": "-67.80",
            "description": "SHELL FUEL PURCHASE",
            "postDate": "2024-01-14T08:15:00Z",
            "category": "transport",
            "merchant": {
                "name": "SHELL",
                "category": "fuel"
            }
        },
        {
            "id": "txn_003",
            "account_id": "acc_123", 
            "amount": "-35.50",
            "description": "THE COFFEE CLUB",
            "postDate": "2024-01-13T12:30:00Z",
            "category": "dining",
            "merchant": {
                "name": "THE COFFEE CLUB",
                "category": "restaurant"
            }
        }
    ]


@pytest.fixture
def performance_timer():
    """Utility fixture for measuring performance"""
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            
        def start(self):
            self.start_time = time.time()
            
        def stop(self):
            self.end_time = time.time()
            return self.elapsed()
            
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()


@pytest.fixture
def tax_categorizer():
    """Instance of Australian Tax Categorizer for testing"""
    return AustralianTaxCategorizer()


@pytest.fixture
def business_compliance():
    """Instance of Australian Business Compliance for testing"""
    return AustralianBusinessCompliance()


# Test data constants
TEST_ABNS = {
    'valid': '53004085616',  # Valid ABN format and checksum
    'invalid_format': '1234567890',  # Invalid format
    'invalid_checksum': '53004085617',  # Valid format, invalid checksum
    'officeworks': '13004590964'  # Real Officeworks ABN
}

TEST_MERCHANTS = {
    'office_supplies': ['officeworks', 'staples', 'office works'],
    'fuel': ['shell', 'bp', 'caltex', '7-eleven', 'ampol'],
    'hardware': ['bunnings', 'masters', 'mitre 10'],
    'grocery': ['woolworths', 'coles', 'aldi', 'iga'],
    'restaurant': ['mcdonalds', 'kfc', 'subway', 'coffee club'],
    'technology': ['jb hi-fi', 'harvey norman', 'apple store']
}

# Test configuration
TEST_CONFIG = {
    'max_processing_time': 30.0,  # seconds
    'min_confidence_score': 0.5,
    'max_file_size': 10 * 1024 * 1024,  # 10MB
    'allowed_formats': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
    'api_timeout': 30,
    'retry_attempts': 3
} 