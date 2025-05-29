import os
import requests
import json
import uuid
import base64
from dotenv import load_dotenv
from datetime import datetime
import time
import math
import logging

logger = logging.getLogger(__name__)

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
        
        # Extract merchant with fallbacks
        merchant_name = "Unknown Merchant"
        if receipt_data.get("establishment"):
            if isinstance(receipt_data["establishment"], dict) and receipt_data["establishment"].get("name"):
                merchant_name = receipt_data["establishment"]["name"]
            elif isinstance(receipt_data["establishment"], str):
                merchant_name = receipt_data["establishment"]
        elif receipt_data.get("merchantName"):
            merchant_name = receipt_data["merchantName"]
        elif receipt_data.get("vendor", {}).get("name"):
            merchant_name = receipt_data["vendor"]["name"]
        
        # Extract total amount with fallbacks
        total_amount = 0.0
        if receipt_data.get("totalAmount") and isinstance(receipt_data["totalAmount"], (int, float, str)):
            try:
                # Clean up any currency symbols
                if isinstance(receipt_data["totalAmount"], str):
                    cleaned_amount = receipt_data["totalAmount"].replace('$', '').replace('€', '').replace('£', '').strip()
                    total_amount = float(cleaned_amount)
                else:
                    total_amount = float(receipt_data["totalAmount"])
            except ValueError:
                total_amount = 0.0
        elif receipt_data.get("total") and isinstance(receipt_data["total"], (int, float, str)):
            try:
                # Clean up any currency symbols
                if isinstance(receipt_data["total"], str):
                    cleaned_amount = receipt_data["total"].replace('$', '').replace('€', '').replace('£', '').strip()
                    total_amount = float(cleaned_amount)
                else:
                    total_amount = float(receipt_data["total"])
            except ValueError:
                total_amount = 0.0
        elif receipt_data.get("amounts", {}).get("total"):
            try:
                total_amount = float(receipt_data["amounts"]["total"])
            except (ValueError, TypeError):
                total_amount = 0.0
                
        # Extract date with fallbacks
        receipt_date = datetime.now().strftime("%Y-%m-%d")
        if receipt_data.get("date"):
            if isinstance(receipt_data["date"], dict) and receipt_data["date"].get("text"):
                try:
                    date_text = receipt_data["date"]["text"]
                    # Try different date formats
                    for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%d-%m-%Y"]:
                        try:
                            parsed_date = datetime.strptime(date_text, fmt)
                            receipt_date = parsed_date.strftime("%Y-%m-%d")
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass
            elif isinstance(receipt_data["date"], str):
                try:
                    # Try to parse direct date string
                    parsed_date = datetime.fromisoformat(receipt_data["date"].replace('Z', '+00:00'))
                    receipt_date = parsed_date.strftime("%Y-%m-%d")
                except ValueError:
                    # Try different date formats
                    for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%d-%m-%Y"]:
                        try:
                            parsed_date = datetime.strptime(receipt_data["date"], fmt)
                            receipt_date = parsed_date.strftime("%Y-%m-%d")
                            break
                        except ValueError:
                            continue
        
        # Extract line items with careful error handling
        line_items = []
        if receipt_data.get("lineItems") and isinstance(receipt_data["lineItems"], list):
            for item in receipt_data["lineItems"]:
                try:
                    # Get item name with fallbacks
                    item_name = "Unknown Item"
                    if item.get("descClean"):
                        item_name = item["descClean"]
                    elif item.get("description"):
                        item_name = item["description"]
                    
                    # Get quantity with fallbacks and validation
                    item_qty = 1
                    if item.get("qty"):
                        try:
                            item_qty = float(item["qty"])
                            if item_qty <= 0 or math.isnan(item_qty):
                                item_qty = 1
                        except (ValueError, TypeError):
                            item_qty = 1
                    
                    # Get price with fallbacks and validation
                    item_price = 0.0
                    if item.get("price"):
                        try:
                            item_price = float(item["price"])
                        except (ValueError, TypeError):
                            item_price = 0.0
                    
                    # Get total with fallbacks and validation
                    item_total = 0.0
                    if item.get("totalPrice"):
                        try:
                            item_total = float(item["totalPrice"])
                        except (ValueError, TypeError):
                            # Calculate from price * quantity as fallback
                            item_total = item_price * item_qty
                    elif item.get("amount"):
                        try:
                            item_total = float(item["amount"])
                        except (ValueError, TypeError):
                            # Calculate from price * quantity as fallback
                            item_total = item_price * item_qty
                    else:
                        # Calculate from price * quantity as fallback
                        item_total = item_price * item_qty
                    
                    # Add item with rounded values
                    line_items.append({
                        "name": item_name,
                        "quantity": round(item_qty, 2),
                        "unit_price": round(item_price, 2),
                        "total": round(item_total, 2)
                    })
                except Exception as e:
                    # Log error but continue with other items
                    # print(f"Error processing line item: {e}")
                    logger.error(f"Error processing line item: {e}")
                    continue
        
        # Extract tax amount with fallbacks
        tax_amount = 0.0
        if receipt_data.get("taxAmount") and isinstance(receipt_data["taxAmount"], (int, float, str)):
            try:
                if isinstance(receipt_data["taxAmount"], str):
                    cleaned_tax = receipt_data["taxAmount"].replace('$', '').replace('€', '').replace('£', '').strip()
                    tax_amount = float(cleaned_tax)
                else:
                    tax_amount = float(receipt_data["taxAmount"])
            except ValueError:
                tax_amount = 0.0
        elif receipt_data.get("tax") and isinstance(receipt_data["tax"], (int, float, str)):
            try:
                if isinstance(receipt_data["tax"], str):
                    cleaned_tax = receipt_data["tax"].replace('$', '').replace('€', '').replace('£', '').strip()
                    tax_amount = float(cleaned_tax)
                else:
                    tax_amount = float(receipt_data["tax"])
            except ValueError:
                tax_amount = 0.0
        elif receipt_data.get("amounts", {}).get("tax"):
            try:
                tax_amount = float(receipt_data["amounts"]["tax"])
            except (ValueError, TypeError):
                tax_amount = 0.0
        
        # Process and return the receipt data
        receipt_id = str(uuid.uuid4())
        
        # Ensure all numeric values are positive and rounded
        total_amount = max(0, round(total_amount, 2))
        tax_amount = max(0, round(tax_amount, 2))
        
        # Construct the final result
        return {
            "success": True,
            "completed": True,
            "receipt_id": receipt_id,
            "merchant": merchant_name,
            "total_amount": total_amount,
            "date": receipt_date,
            "items": line_items,
            "tax_amount": tax_amount,
            "ocr_confidence": receipt_data.get("confidence", 0.0),
            "raw_data": receipt_data  # Include raw data for debugging
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

def tabscanner_process_receipt(image_base64, user_id=None):
    """
    Process a receipt image using Tabscanner API and extract data.
    This is a facade function that handles the entire process flow.
    
    Args:
        image_base64 (str): Base64-encoded image data
        user_id (str, optional): User ID for tracking and logging
        
    Returns:
        dict: Extracted receipt data or error information
    """
    # This function is a wrapper around process_receipt_with_polling
    # It ensures consistent interface for the application
    
    try:
        # Process receipt and get data
        result = process_receipt_with_polling(image_base64, user_id)
        
        # If processing succeeded, add any additional fields needed
        if result.get("success", False):
            # Add subtotal if not present (total - tax)
            if "subtotal" not in result and "total_amount" in result and "tax_amount" in result:
                total = float(result.get("total_amount", 0))
                tax = float(result.get("tax_amount", 0))
                result["subtotal"] = round(total - tax, 2)
            
            # Ensure receipt_id is present
            if "receipt_id" not in result:
                result["receipt_id"] = str(uuid.uuid4())
                
        return result
        
    except Exception as e:
        # Ensure consistent error response
        return {
            "success": False,
            "error": f"Receipt processing failed: {str(e)}"
        } 