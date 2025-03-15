import os
import requests
import json
import uuid
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# DocuClipper API configuration
DOCUCLIPPER_API_KEY = os.environ.get('DOCUCLIPPER_API_KEY', 'demo-key-for-development')
DOCUCLIPPER_API_URL = os.environ.get('DOCUCLIPPER_API_URL', 'https://api.docuclipper.com/v1')

# For development/testing, we'll implement a simulation mode
SIMULATION_MODE = os.environ.get('SIMULATION_MODE', 'true').lower() == 'true'

def extract_receipt_data(image_base64, user_id=None):
    """
    Extract data from a receipt image using DocuClipper OCR API.
    
    Args:
        image_base64 (str): Base64-encoded image data
        user_id (str, optional): User ID for logging and tracking
        
    Returns:
        dict: Receipt data including merchant, amount, date, and items
    """
    if SIMULATION_MODE:
        # Simulate OCR response for development
        return simulate_receipt_extraction(image_base64)
    
    try:
        # Call DocuClipper API
        response = requests.post(
            f"{DOCUCLIPPER_API_URL}/extract",
            headers={
                "Authorization": f"Bearer {DOCUCLIPPER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "image": image_base64,
                "options": {
                    "extract_items": True,
                    "extract_tax": True
                },
                "metadata": {
                    "user_id": user_id
                }
            }
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Process and return the receipt data
        return {
            "success": True,
            "receipt_id": result.get("id", str(uuid.uuid4())),
            "merchant": result.get("merchant", {}).get("name", "Unknown Merchant"),
            "total_amount": result.get("total", {}).get("amount", 0.0),
            "date": result.get("date", datetime.now().strftime("%Y-%m-%d")),
            "items": result.get("items", []),
            "tax_amount": result.get("tax", {}).get("amount", 0.0),
            "confidence": result.get("confidence", 0.0)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def simulate_receipt_extraction(image_base64):
    """
    Simulate receipt data extraction for development/testing.
    
    Args:
        image_base64 (str): Base64-encoded image data (not used in simulation)
        
    Returns:
        dict: Simulated receipt data
    """
    # Generate a random receipt ID
    receipt_id = f"sim-receipt-{uuid.uuid4()}"
    
    # Current date for the receipt
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Simulated items based on common receipt items
    items = [
        {"name": "Milk 1L", "quantity": 1, "unit_price": 2.99, "total": 2.99},
        {"name": "Bread", "quantity": 1, "unit_price": 3.49, "total": 3.49},
        {"name": "Eggs (dozen)", "quantity": 1, "unit_price": 4.99, "total": 4.99},
        {"name": "Coffee", "quantity": 1, "unit_price": 8.99, "total": 8.99}
    ]
    
    # Calculate the total
    subtotal = sum(item["total"] for item in items)
    tax_rate = 0.10  # 10% tax
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount, 2)
    
    # Random merchants
    merchants = [
        "Grocery Store", 
        "Supermarket", 
        "Local Market", 
        "Fresh Foods", 
        "City Grocers"
    ]
    import random
    merchant = random.choice(merchants)
    
    return {
        "success": True,
        "receipt_id": receipt_id,
        "merchant": merchant,
        "total_amount": total_amount,
        "subtotal": subtotal,
        "date": today,
        "items": items,
        "tax_amount": tax_amount,
        "confidence": 0.95  # High confidence for simulated data
    }

def match_receipt_with_transaction(receipt_data, transactions):
    """
    Match a receipt with a banking transaction based on amount, date, and merchant.
    
    Args:
        receipt_data (dict): Receipt data extracted from the image
        transactions (list): List of user transactions from banking API
        
    Returns:
        dict: Matching transaction or None
    """
    if not transactions:
        return None
    
    # Extract relevant receipt data
    receipt_amount = float(receipt_data.get("total_amount", 0))
    receipt_date = receipt_data.get("date")
    receipt_merchant = receipt_data.get("merchant", "").lower()
    
    # Find matching transactions
    # We'll use a simple algorithm that looks for transactions with:
    # 1. Similar amount (within $0.10)
    # 2. Same date
    # 3. Optional: Similar merchant name
    
    for transaction in transactions:
        # Check amount (convert to absolute for comparing expenses which may be negative)
        tx_amount = abs(float(transaction.get("amount", 0)))
        amount_diff = abs(tx_amount - receipt_amount)
        
        # Check date
        tx_date = transaction.get("date")
        
        # Check merchant (in description)
        tx_description = transaction.get("description", "").lower()
        
        # Conditions for matching
        amount_match = amount_diff < 0.10  # Within 10 cents
        date_match = tx_date == receipt_date
        merchant_match = receipt_merchant in tx_description
        
        # Logic for matching
        if amount_match and date_match:
            # If we have an exact amount and date match, that's good enough
            match_confidence = 0.8
            if merchant_match:
                match_confidence = 0.95  # Even better if merchant also matches
            
            return {
                "transaction_id": transaction.get("id"),
                "confidence": match_confidence,
                "transaction": transaction
            }
    
    # No match found
    return None 