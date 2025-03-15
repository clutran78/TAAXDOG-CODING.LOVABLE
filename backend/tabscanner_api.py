import os
import requests
import json
import uuid
import base64
from dotenv import load_dotenv
from datetime import datetime
import time

# Load environment variables
load_dotenv()

# Tabscanner API configuration
TABSCANNER_API_KEY = os.environ.get('TABSCANNER_API_KEY', 'demo-key-for-development')
TABSCANNER_API_URL = os.environ.get('TABSCANNER_API_URL', 'https://api.tabscanner.com/api')

# For development/testing, we'll implement a simulation mode
# Force simulation mode to be true since we're in development
SIMULATION_MODE = True  # Changed to always be True for development

def submit_receipt_for_processing(image_base64, user_id=None):
    """
    Submit a receipt image to Tabscanner OCR API for processing.
    
    Args:
        image_base64 (str): Base64-encoded image data
        user_id (str, optional): User ID for logging and tracking
        
    Returns:
        dict: Response containing the token for retrieving results later
    """
    if SIMULATION_MODE:
        # Simulate submission in development mode
        return {
            "success": True,
            "token": f"sim-token-{uuid.uuid4()}",
            "message": "Receipt submitted for processing (simulation mode)"
        }
    
    try:
        # Strip any base64 header if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',', 1)[1]
        
        # Call Tabscanner API to submit receipt
        response = requests.post(
            f"{TABSCANNER_API_URL}/2/process",
            headers={
                "apikey": TABSCANNER_API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "image": image_base64,
                "documentType": "receipt"
            }
        )
        
        response.raise_for_status()
        result = response.json()
        
        return {
            "success": True,
            "token": result.get("token"),
            "message": "Receipt submitted for processing"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def get_processing_result(token):
    """
    Retrieve the processing result from Tabscanner using the token.
    
    Args:
        token (str): Token returned from submit_receipt_for_processing
        
    Returns:
        dict: Receipt data including merchant, amount, date, and items
    """
    if SIMULATION_MODE:
        # Simulate processing result in development mode
        return simulate_receipt_extraction(token)
    
    try:
        # Call Tabscanner API to get result
        response = requests.get(
            f"{TABSCANNER_API_URL}/2/result/{token}",
            headers={
                "apikey": TABSCANNER_API_KEY
            }
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Check if processing is complete
        status = result.get("status")
        if status == "pending" or status == "processing":
            return {
                "success": True,
                "completed": False,
                "status": status,
                "message": "Receipt is still being processed"
            }
        
        if status != "done":
            return {
                "success": False,
                "error": f"Processing failed with status: {status}"
            }
        
        # Extract the receipt data
        receipt_data = result.get("result", {})
        
        # Process and return the receipt data
        return {
            "success": True,
            "completed": True,
            "receipt_id": str(uuid.uuid4()),
            "merchant": receipt_data.get("establishment", {}).get("name", "Unknown Merchant"),
            "total_amount": receipt_data.get("total", 0.0),
            "date": receipt_data.get("date", {}).get("text", datetime.now().strftime("%Y-%m-%d")),
            "items": [
                {
                    "name": item.get("description", "Unknown Item"),
                    "quantity": item.get("qty", 1),
                    "unit_price": item.get("price", 0.0),
                    "total": item.get("amount", 0.0)
                }
                for item in receipt_data.get("lineItems", [])
            ],
            "tax_amount": receipt_data.get("tax", 0.0),
            "confidence": receipt_data.get("confidence", 0.0)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def simulate_receipt_extraction(token):
    """
    Simulate receipt data extraction for development/testing.
    
    Args:
        token (str): Simulated token (not used in simulation)
        
    Returns:
        dict: Simulated receipt data
    """
    # Generate a random receipt ID
    receipt_id = f"sim-receipt-{uuid.uuid4()}"
    
    # Current date for the receipt
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Simulated items based on common receipt items
    items = [
        {"name": "Organic Milk 1L", "quantity": 1, "unit_price": 3.99, "total": 3.99},
        {"name": "Whole Grain Bread", "quantity": 1, "unit_price": 4.49, "total": 4.49},
        {"name": "Free Range Eggs (dozen)", "quantity": 1, "unit_price": 5.99, "total": 5.99},
        {"name": "Fair Trade Coffee", "quantity": 1, "unit_price": 9.99, "total": 9.99}
    ]
    
    # Calculate the total
    subtotal = sum(item["total"] for item in items)
    tax_rate = 0.10  # 10% tax
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount, 2)
    
    # Random merchants
    merchants = [
        "Organic Grocery Store", 
        "Health Food Market", 
        "Local Farm Shop", 
        "Green Foods", 
        "Sustainable Market"
    ]
    import random
    merchant = random.choice(merchants)
    
    return {
        "success": True,
        "completed": True,
        "receipt_id": receipt_id,
        "merchant": merchant,
        "total_amount": total_amount,
        "subtotal": subtotal,
        "date": today,
        "items": items,
        "tax_amount": tax_amount,
        "confidence": 0.95  # High confidence for simulated data
    }

def process_receipt_with_polling(image_base64, user_id=None, max_attempts=5, delay_seconds=2):
    """
    Process a receipt image with polling for results.
    
    Args:
        image_base64 (str): Base64-encoded image data
        user_id (str, optional): User ID for logging
        max_attempts (int): Maximum number of polling attempts
        delay_seconds (int): Seconds to wait between polling attempts
        
    Returns:
        dict: Receipt data or error information
    """
    # Submit receipt for processing
    submission = submit_receipt_for_processing(image_base64, user_id)
    
    if not submission.get("success", False):
        return submission
    
    token = submission.get("token")
    
    # In simulation mode, return immediately
    if SIMULATION_MODE:
        return get_processing_result(token)
    
    # Poll for results
    for attempt in range(max_attempts):
        # Wait before polling
        time.sleep(delay_seconds)
        
        # Check result
        result = get_processing_result(token)
        
        # If completed or error, return immediately
        if not result.get("success", False) or result.get("completed", False):
            return result
    
    # If we've reached max attempts, return the last result
    return {
        "success": False,
        "error": f"Receipt processing timed out after {max_attempts} attempts"
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
        merchant_match = receipt_merchant in tx_description or any(word in tx_description for word in receipt_merchant.split())
        
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