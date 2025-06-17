import os
import json
from PIL import Image
from io import BytesIO
from flask import jsonify
from google.generativeai import GenerativeModel, configure
from dotenv import load_dotenv
import logging
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Load environment variables
load_dotenv()

# Enhanced logging configuration
logger = logging.getLogger(__name__)

# Retry configuration for API calls
MAX_RETRIES = 3
BACKOFF_FACTOR = 1
RATE_LIMIT_DELAY = 60  # seconds to wait on rate limit
NETWORK_TIMEOUT = 30  # seconds

# Configure Gemini API with enhanced error handling
api_key = None
model = None

def initialize_gemini_api():
    """
    Initialize Gemini API with proper error handling and validation
    """
    global api_key, model
    
    try:
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            logger.error("GOOGLE_API_KEY environment variable is not set")
            raise ValueError("GOOGLE_API_KEY environment variable is not set")
        
        # Validate API key format (basic check)
        if len(api_key) < 20:
            logger.error("GOOGLE_API_KEY appears to be invalid (too short)")
            raise ValueError("GOOGLE_API_KEY appears to be invalid")
        
        logger.info("Configuring Gemini API...")
        configure(api_key=api_key)
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        logger.info("Gemini API configured successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to configure Gemini API: {e}")
        model = None
        return False

# Initialize on module load
initialize_gemini_api()

def log_api_call(step, status, details=None, duration=None, attempt=None):
    """
    Structured logging for API calls
    """
    log_data = {
        "api": "gemini",
        "step": step,
        "status": status,
        "timestamp": time.time(),
        "details": details,
        "attempt": attempt
    }
    
    if duration is not None:
        log_data["duration_ms"] = int(duration * 1000)
    
    if status == "SUCCESS":
        logger.info(f"Gemini API [{step}] SUCCESS", extra=log_data)
    elif status == "ERROR":
        logger.error(f"Gemini API [{step}] ERROR: {details}", extra=log_data)
    elif status == "WARNING":
        logger.warning(f"Gemini API [{step}] WARNING: {details}", extra=log_data)
    elif status == "RETRY":
        logger.warning(f"Gemini API [{step}] RETRY {attempt}: {details}", extra=log_data)
    else:
        logger.info(f"Gemini API [{step}] {status}", extra=log_data)

def handle_api_error(error, attempt=1):
    """
    Enhanced error handling for Gemini API responses
    """
    error_str = str(error).lower()
    
    # Rate limiting detection
    if any(keyword in error_str for keyword in ['rate limit', 'quota', 'too many requests', '429']):
        log_api_call("rate_limit_detection", "WARNING", 
                    f"Rate limit detected on attempt {attempt}", attempt=attempt)
        return {
            "error_type": "rate_limit",
            "should_retry": attempt < MAX_RETRIES,
            "delay": RATE_LIMIT_DELAY * attempt,
            "message": "API rate limit exceeded. Please wait before retrying."
        }
    
    # Network/timeout errors
    if any(keyword in error_str for keyword in ['timeout', 'connection', 'network', 'unreachable']):
        log_api_call("network_error", "WARNING", 
                    f"Network error detected on attempt {attempt}: {error}", attempt=attempt)
        return {
            "error_type": "network",
            "should_retry": attempt < MAX_RETRIES,
            "delay": BACKOFF_FACTOR * (2 ** attempt),
            "message": "Network connection issue. Retrying..."
        }
    
    # Authentication errors
    if any(keyword in error_str for keyword in ['auth', 'api key', 'permission', 'forbidden', '401', '403']):
        log_api_call("auth_error", "ERROR", 
                    f"Authentication error: {error}", attempt=attempt)
        return {
            "error_type": "authentication",
            "should_retry": False,
            "delay": 0,
            "message": "API authentication failed. Please check your API key."
        }
    
    # Service unavailable
    if any(keyword in error_str for keyword in ['service unavailable', '503', 'internal server error', '500']):
        log_api_call("service_error", "WARNING", 
                    f"Service error on attempt {attempt}: {error}", attempt=attempt)
        return {
            "error_type": "service",
            "should_retry": attempt < MAX_RETRIES,
            "delay": BACKOFF_FACTOR * (2 ** attempt),
            "message": "Service temporarily unavailable. Retrying..."
        }
    
    # Invalid image format errors
    if any(keyword in error_str for keyword in ['invalid image', 'unsupported format', 'image format']):
        log_api_call("image_format_error", "ERROR", 
                    f"Invalid image format: {error}", attempt=attempt)
        return {
            "error_type": "image_format",
            "should_retry": False,
            "delay": 0,
            "message": "Invalid image format. Please use JPG, PNG, or WebP format."
        }
    
    # Generic error
    log_api_call("generic_error", "ERROR", 
                f"Unhandled error on attempt {attempt}: {error}", attempt=attempt)
    return {
        "error_type": "generic",
        "should_retry": attempt < MAX_RETRIES,
        "delay": BACKOFF_FACTOR * attempt,
        "message": f"API error: {str(error)}"
    }

def validate_image_for_api(image_path):
    """
    Enhanced image validation before API call
    """
    try:
        start_time = time.time()
        
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        file_size = os.path.getsize(image_path)
        if file_size == 0:
            raise ValueError("Image file is empty")
        
        # Gemini API size limits (adjust based on current limits)
        max_size = 20 * 1024 * 1024  # 20MB
        if file_size > max_size:
            raise ValueError(f"Image too large ({file_size / 1024 / 1024:.1f}MB). Maximum size is {max_size / 1024 / 1024}MB")
        
        # Validate image with PIL
        with Image.open(image_path) as img:
            width, height = img.size
            
            # Check minimum dimensions for OCR
            if width < 100 or height < 100:
                logger.warning(f"Image dimensions very small ({width}x{height}). OCR quality may be poor.")
            
            # Check for supported formats
            if img.format not in ['JPEG', 'PNG', 'WEBP', 'GIF']:
                logger.warning(f"Image format {img.format} may not be optimal. Consider using JPEG, PNG, or WebP.")
            
            # Convert problematic formats
            if img.mode not in ['RGB', 'RGBA']:
                logger.info(f"Converting image from {img.mode} to RGB for better API compatibility")
            
            # Check for extremely large images that might cause processing issues
            pixel_count = width * height
            if pixel_count > 16_000_000:  # 4000x4000 pixels
                logger.warning(f"Very large image ({width}x{height}). Processing may be slow.")
        
        validation_time = time.time() - start_time
        log_api_call("image_validation", "SUCCESS", 
                    f"Image validated: {file_size} bytes, {width}x{height}", validation_time)
        
        return {"valid": True, "file_size": file_size, "dimensions": (width, height)}
        
    except Exception as e:
        validation_time = time.time() - start_time
        log_api_call("image_validation", "ERROR", str(e), validation_time)
        return {"valid": False, "error": str(e)}

# Australian Tax Categories for improved categorization
AUSTRALIAN_TAX_CATEGORIES = {
    "D1": "Car expenses (work-related)",
    "D2": "Travel expenses (work-related)", 
    "D3": "Clothing expenses (work-related)",
    "D4": "Education expenses (work-related)",
    "D5": "Home office expenses",
    "D6": "Equipment and tools",
    "D7": "Phone and internet (work-related)",
    "D8": "Professional development",
    "D9": "Subscriptions and memberships",
    "D10": "Insurance (work-related)",
    "D11": "Interest and bank fees",
    "D12": "Income protection insurance",
    "D13": "Gifts and donations",
    "D14": "Investment expenses",
    "D15": "Other work-related expenses",
    "P8": "Personal services income",
    "Personal": "Personal/non-deductible expense"
}

# Enhanced merchant categorization mapping for Australian tax compliance
MERCHANT_TAX_CATEGORY_MAPPING = {
    # Fuel and automotive (D1 - Car expenses)
    "bp": "D1", "shell": "D1", "caltex": "D1", "7-eleven": "D1", "united petroleum": "D1",
    "ampol": "D1", "mobil": "D1", "auto": "D1", "mechanic": "D1", "service station": "D1",
    "car wash": "D1", "parking": "D1", "toll": "D1", "rego": "D1", "registration": "D1",
    
    # Travel expenses (D2)
    "hotel": "D2", "motel": "D2", "accommodation": "D2", "flight": "D2", "airline": "D2",
    "jetstar": "D2", "qantas": "D2", "virgin": "D2", "tigerair": "D2", "taxi": "D2", 
    "uber": "D2", "ola": "D2", "rental": "D2", "train": "D2", "bus": "D2", "ferry": "D2",
    
    # Office supplies and equipment (D5/D6/D15)
    "officeworks": "D5", "staples": "D5", "office": "D5", "stationery": "D5", "printer": "D6",
    "computer": "D6", "laptop": "D6", "harvey norman": "D6", "jb hi-fi": "D6", "dick smith": "D6",
    "bunnings": "D6", "tools": "D6", "equipment": "D6", "software": "D15",
    
    # Phone and internet (D7)
    "telstra": "D7", "optus": "D7", "vodafone": "D7", "tpg": "D7", "iinet": "D7",
    "mobile": "D7", "phone": "D7", "internet": "D7", "nbn": "D7",
    
    # Professional development and education (D4/D8)
    "university": "D4", "tafe": "D4", "college": "D4", "course": "D8", "training": "D8",
    "conference": "D8", "seminar": "D8", "workshop": "D8", "certification": "D8",
    
    # Subscriptions and memberships (D9)
    "gym": "D9", "fitness": "D9", "club": "D9", "association": "D9", "membership": "D9",
    "subscription": "D9", "netflix": "Personal", "spotify": "Personal", "amazon prime": "Personal",
    
    # Insurance (D10/D12)
    "insurance": "D10", "allianz": "D10", "nrma": "D10", "rac": "D10", "aami": "D10",
    
    # Personal expenses
    "woolworths": "Personal", "coles": "Personal", "aldi": "Personal", "iga": "Personal",
    "supermarket": "Personal", "grocery": "Personal", "restaurant": "Personal", "cafe": "Personal",
    "mcdonald": "Personal", "kfc": "Personal", "subway": "Personal", "domino": "Personal",
    "pharmacy": "Personal", "chemist": "Personal", "retail": "Personal", "shopping": "Personal"
}

def extract_data_from_image_with_gemini(image_path: str) -> dict:
    """
    Extract receipt data using Google's Gemini 2.0 Flash API with comprehensive error handling
    and enhanced Australian tax compliance features.
    
    Args:
        image_path (str): Path to the receipt image file
        
    Returns:
        dict: Extracted receipt data with Australian tax compliance fields and processing metadata
    """
    start_time = time.time()
    log_api_call("extraction_start", "START", f"Processing image: {image_path}")
    
    # Check if API is properly configured
    if not model:
        log_api_call("api_check", "ERROR", "Gemini API not properly configured")
        return {
            "success": False, 
            "error": "Gemini API not properly configured. Please check your API key.",
            "confidence": 0.0,
            "error_type": "configuration"
        }
    
    # Step 1: Enhanced image validation
    log_api_call("image_validation", "START")
    validation_result = validate_image_for_api(image_path)
    
    if not validation_result["valid"]:
        log_api_call("image_validation", "ERROR", validation_result["error"])
        return {
            "success": False,
            "error": f"Image validation failed: {validation_result['error']}",
            "confidence": 0.0,
            "error_type": "validation"
        }
    
    # Step 2: Process image with retry logic
    log_api_call("image_processing", "START")
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            attempt_start = time.time()
            log_api_call("api_attempt", "START", f"Attempt {attempt} of {MAX_RETRIES}", attempt=attempt)
            
            # Load and process image
            with Image.open(image_path) as img:
                # Convert to RGB if necessary for better processing
                if img.mode != 'RGB':
                    log_api_call("image_conversion", "INFO", f"Converting image from {img.mode} to RGB")
                    img = img.convert('RGB')
                
                # Enhanced Australian tax-focused prompt for receipt extraction with improved specificity
                prompt = """
                You are an expert Australian Tax Office (ATO) compliant receipt parser specializing in business expense extraction.
                
                ANALYZE this receipt image and extract data into VALID JSON format ONLY (no markdown, no explanations):

                {
                  "merchant_name": "string - exact business name from receipt header (clean, no extra characters)",
                  "abn": "string - 11-digit Australian Business Number if visible (format: XX XXX XXX XXX)",
                  "acn": "string - 9-digit Australian Company Number if visible", 
                  "date": "string - convert to YYYY-MM-DD format strictly (handle DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY)",
                  "time": "string - time in HH:MM format (24-hour) if visible",
                  "total_amount": "number - final amount paid (NO $ symbol, decimal number only)",
                  "subtotal": "number - amount before GST if explicitly shown (NO $ symbol)",
                  "gst_amount": "number - GST/tax amount extracted or calculated (NO $ symbol)",
                  "gst_rate": "number - GST percentage (usually 10.0 in Australia)",
                  "gst_calculation_method": "string - 'explicit' (shown), 'calculated_inclusive' (total/11), 'calculated_from_subtotal' (total-subtotal), or 'none'",
                  "payment_method": "string - cash, card, eftpos, contactless, etc.",
                  "suggested_tax_category": "string - assign ONE category based on merchant/items:
                    D1: Fuel (BP, Shell, Caltex, 7-Eleven), car services, parking, tolls, automotive
                    D2: Hotels, flights (Qantas, Jetstar, Virgin), taxis, Uber, public transport, accommodation
                    D3: Work uniforms, safety clothing, protective equipment (work-specific only)
                    D4: University, TAFE, education courses, textbooks, training materials
                    D5: Officeworks, office supplies, stationery, printer cartridges, home office items
                    D6: Bunnings, tools, work equipment, computers (if work-related), machinery
                    D7: Telstra, Optus, Vodafone, mobile bills, internet bills, phone expenses
                    D8: Professional conferences, seminars, certifications, work training, subscriptions
                    D9: Professional memberships, industry associations, work-related gym/club fees
                    D10: Work-related insurance, professional indemnity, business insurance
                    D11: Bank fees, loan interest, investment-related costs, financial services
                    D12: Income protection insurance premiums, salary continuance
                    D13: Charity donations, workplace giving, deductible gifts
                    D14: Investment expenses, financial planning, share trading fees
                    D15: Other work-related expenses not covered above
                    P8: Personal services income related expenses
                    Personal: Supermarkets (Woolworths, Coles, ALDI), restaurants, personal shopping, entertainment",
                  "business_expense_likelihood": "number - probability 0.0-1.0 this expense is work-related",
                  "confidence_score": "number - overall extraction confidence 0.0-1.0 based on text clarity",
                  "text_quality_score": "number - 0.0-1.0 score for receipt readability and print quality",
                  "items": [
                    {
                      "name": "string - item description exactly as printed",
                      "quantity": "number - quantity purchased (default 1)",
                      "price": "number - individual item price (NO $ symbol)"
                    }
                  ]
                }

                CRITICAL EXTRACTION RULES:
                1. DATE: Convert Australian formats (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY) to YYYY-MM-DD
                2. GST CALCULATION:
                   - If GST explicitly shown: use exact amount, method='explicit'
                   - If only total amount: GST = total÷11, subtotal = total-GST, method='calculated_inclusive'
                   - If subtotal+GST shown: validate math, method='calculated_from_subtotal'
                3. TAX CATEGORIES - STRICT MAPPING:
                   - Fuel stations, automotive → D1
                   - Airlines, hotels, transport → D2  
                   - Officeworks, office supplies → D5
                   - Bunnings, tools, equipment → D6
                   - Telstra, Optus, phone bills → D7
                   - Woolworths, Coles, restaurants → Personal
                4. BUSINESS LIKELIHOOD:
                   - D1-D15, P8 categories: 0.7-0.9
                   - Personal merchants: 0.1-0.3
                   - Uncertain merchants: 0.5
                5. CONFIDENCE SCORING:
                   - 0.9-1.0: Clear text, all fields visible, GST explicit
                   - 0.7-0.8: Good text, most fields clear, GST calculable
                   - 0.5-0.6: Readable text, basic fields extracted
                   - 0.0-0.4: Poor quality, minimal data extracted

                RETURN ONLY VALID JSON - NO MARKDOWN, NO EXTRA TEXT, NO EXPLANATIONS.
                ALL MONETARY VALUES AS DECIMAL NUMBERS WITHOUT CURRENCY SYMBOLS.
                """

                # Generate response using Gemini with timeout handling
                log_api_call("gemini_request", "START", "Sending request to Gemini API", attempt=attempt)
                
                response = model.generate_content([prompt, img])
                raw_text = response.text.strip()
                
                attempt_time = time.time() - attempt_start
                log_api_call("gemini_request", "SUCCESS", 
                           f"Response received ({len(raw_text)} characters)", attempt_time, attempt)

                # Step 3: Parse and validate response
                log_api_call("response_parsing", "START", attempt=attempt)
                
                # Extract JSON from response - handle potential markdown formatting
                json_text = raw_text
                if '```json' in raw_text:
                    # Remove markdown formatting
                    json_start = raw_text.find('```json') + 7
                    json_end = raw_text.find('```', json_start)
                    if json_end != -1:
                        json_text = raw_text[json_start:json_end].strip()
                elif '{' in raw_text and '}' in raw_text:
                    # Extract JSON object
                    json_start = raw_text.find('{')
                    json_end = raw_text.rfind('}')
                    json_text = raw_text[json_start:json_end+1]
                
                try:
                    extracted_data = json.loads(json_text)
                except json.JSONDecodeError as e:
                    log_api_call("json_parsing", "ERROR", f"JSON decode error: {str(e)}", attempt=attempt)
                    raise ValueError(f"Failed to parse JSON response: {str(e)}")

                # Step 4: Validate and enhance extracted data
                log_api_call("data_validation", "START", attempt=attempt)
                validated_data = _validate_and_enhance_data(extracted_data)
                
                # Calculate overall confidence based on required fields
                confidence = _calculate_confidence(validated_data)
                validated_data["confidence_score"] = confidence

                total_time = time.time() - start_time
                log_api_call("extraction_complete", "SUCCESS", 
                           f"Extraction completed successfully with confidence {confidence:.2f}", total_time)

                # Return in the exact format expected by receipt_routes.py
                return {
                    "success": True,
                    "documents": [{
                        "data": {
                            "merchant_name": validated_data.get("merchant_name", ""),
                            "date": validated_data.get("date", ""),
                            "total_amount": validated_data.get("total_amount", 0.0),
                            "gst_amount": validated_data.get("gst_amount", 0.0),
                            "suggested_tax_category": validated_data.get("suggested_tax_category", "Personal"),
                            "confidence_score": confidence,
                            "business_expense_likelihood": validated_data.get("business_expense_likelihood", 0.5),
                            "items": validated_data.get("items", [])
                        }
                    }],
                    "extraction_method": "gemini-2.0-flash-enhanced",
                    "processing_metadata": {
                        "image_processed": True,
                        "australian_tax_compliant": True,
                        "gst_extracted": bool(validated_data.get("gst_amount")),
                        "gst_calculation_method": validated_data.get("gst_calculation_method", "none"),
                        "tax_category_assigned": validated_data.get("suggested_tax_category", "Personal"),
                        "business_likelihood": validated_data.get("business_expense_likelihood", 0.0),
                        "confidence": confidence,
                        "text_quality": validated_data.get("text_quality_score", 0.5),
                        "processing_time_ms": int(total_time * 1000),
                        "attempts_made": attempt,
                        "image_size": validation_result.get("file_size", 0),
                        "image_dimensions": validation_result.get("dimensions", (0, 0)),
                        "enhanced_features": {
                            "australian_date_parsing": True,
                            "merchant_category_mapping": True,
                            "enhanced_gst_calculation": True,
                            "confidence_scoring_v2": True,
                            "retry_logic": True,
                            "error_handling": True
                        }
                    }
                }
                
        except Exception as e:
            attempt_time = time.time() - attempt_start
            error_info = handle_api_error(e, attempt)
            
            log_api_call("api_attempt", "ERROR", 
                        f"Attempt {attempt} failed: {error_info['message']}", attempt_time, attempt)
            
            # If this was the last attempt or we shouldn't retry, return error
            if not error_info["should_retry"] or attempt == MAX_RETRIES:
                total_time = time.time() - start_time
                log_api_call("extraction_failed", "ERROR", 
                           f"All attempts failed. Final error: {error_info['message']}", total_time)
                
                return {
                    "success": False,
                    "error": error_info["message"],
                    "error_type": error_info["error_type"],
                    "confidence": 0.0,
                    "processing_metadata": {
                        "processing_time_ms": int(total_time * 1000),
                        "attempts_made": attempt,
                        "image_size": validation_result.get("file_size", 0),
                        "final_error": str(e),
                        "error_category": error_info["error_type"]
                    }
                }
            
            # Wait before retry
            if error_info["delay"] > 0:
                log_api_call("retry_delay", "INFO", 
                           f"Waiting {error_info['delay']}s before retry", attempt=attempt)
                time.sleep(error_info["delay"])
    
    # This should never be reached, but just in case
    total_time = time.time() - start_time
    log_api_call("extraction_failed", "ERROR", "Unexpected end of retry loop", total_time)
    return {
        "success": False,
        "error": "Unexpected error in processing loop",
        "confidence": 0.0
    }

def _validate_and_enhance_data(data: dict) -> dict:
    """
    Validate and enhance extracted receipt data with Australian tax compliance.
    
    Args:
        data (dict): Raw extracted data from Gemini
        
    Returns:
        dict: Validated and enhanced data
    """
    import re
    from datetime import datetime
    
    # Ensure required fields have defaults with improved naming
    enhanced_data = {
        "merchant_name": data.get("merchant_name", "Unknown Merchant"),
        "abn": data.get("abn", ""),
        "acn": data.get("acn", ""),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "total_amount": float(data.get("total_amount", 0.0)),
        "subtotal": float(data.get("subtotal", 0.0)),
        "gst_amount": float(data.get("gst_amount", 0.0)),
        "gst_rate": float(data.get("gst_rate", 10.0)),
        "gst_calculation_method": data.get("gst_calculation_method", "none"),
        "payment_method": data.get("payment_method", ""),
        "suggested_tax_category": data.get("suggested_tax_category", "Personal"),
        "business_expense_likelihood": float(data.get("business_expense_likelihood", 0.5)),
        "confidence_score": float(data.get("confidence_score", 0.5)),
        "text_quality_score": float(data.get("text_quality_score", 0.5)),
        "items": data.get("items", [])
    }
    
    # Enhanced date parsing for Australian formats
    date_str = enhanced_data["date"]
    if date_str and not re.match(r'\d{4}-\d{2}-\d{2}', date_str):
        enhanced_data["date"] = _parse_australian_date(date_str)
    
    # Enhanced GST calculation with better logic
    total = enhanced_data["total_amount"]
    gst = enhanced_data["gst_amount"]
    subtotal = enhanced_data["subtotal"]
    
    if total > 0:
        if gst == 0.0:  # No GST extracted, calculate it
            if subtotal > 0:  # We have subtotal, GST = total - subtotal
                enhanced_data["gst_amount"] = round(total - subtotal, 2)
                enhanced_data["gst_calculation_method"] = "calculated_from_subtotal"
            else:  # GST-inclusive pricing, GST = total / 11
                enhanced_data["gst_amount"] = round(total / 11, 2)
                enhanced_data["subtotal"] = total - enhanced_data["gst_amount"]
                enhanced_data["gst_calculation_method"] = "calculated_inclusive"
        else:  # GST was extracted from receipt
            enhanced_data["gst_calculation_method"] = "explicit"
            if subtotal == 0.0:
                enhanced_data["subtotal"] = total - gst
    
    # Enhanced merchant categorization using mapping
    merchant_name = enhanced_data["merchant_name"].lower()
    if enhanced_data["suggested_tax_category"] == "Personal":
        # Try to improve categorization using merchant mapping
        for merchant_key, category in MERCHANT_TAX_CATEGORY_MAPPING.items():
            if merchant_key in merchant_name:
                enhanced_data["suggested_tax_category"] = category
                break
    
    # Validate Australian tax category
    if enhanced_data["suggested_tax_category"] not in AUSTRALIAN_TAX_CATEGORIES:
        enhanced_data["suggested_tax_category"] = "Personal"
    
    # Set business expense likelihood based on category
    category = enhanced_data["suggested_tax_category"]
    if category in ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "D14", "D15", "P8"]:
        enhanced_data["business_expense_likelihood"] = max(enhanced_data["business_expense_likelihood"], 0.7)
    elif category == "Personal":
        enhanced_data["business_expense_likelihood"] = min(enhanced_data["business_expense_likelihood"], 0.3)
    
    return enhanced_data

def _parse_australian_date(date_str: str) -> str:
    """
    Parse Australian date formats (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY) to YYYY-MM-DD.
    
    Args:
        date_str (str): Date string in various Australian formats
        
    Returns:
        str: Date in YYYY-MM-DD format or original string if parsing fails
    """
    import re
    from datetime import datetime
    
    if not date_str:
        return ""
    
    # Clean the date string
    date_str = date_str.strip()
    
    # Try different Australian date patterns
    patterns = [
        (r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', "%d/%m/%Y"),  # DD/MM/YYYY or DD-MM-YYYY
        (r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})', "%d/%m/%y"),   # DD/MM/YY or DD-MM-YY
        (r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})', "%Y/%m/%d"),   # YYYY/MM/DD (already ISO-ish)
    ]
    
    for pattern, format_str in patterns:
        match = re.match(pattern, date_str)
        if match:
            try:
                if len(match.group(3)) == 2:  # Two-digit year
                    year = int(match.group(3))
                    # Assume years 00-30 are 2000-2030, 31-99 are 1931-1999
                    if year <= 30:
                        year += 2000
                    else:
                        year += 1900
                    day, month = int(match.group(1)), int(match.group(2))
                elif format_str == "%Y/%m/%d":  # Year first format
                    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                else:  # DD/MM/YYYY format
                    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                
                # Validate date components
                if 1 <= month <= 12 and 1 <= day <= 31 and 1900 <= year <= 2100:
                    return f"{year:04d}-{month:02d}-{day:02d}"
            except (ValueError, IndexError):
                continue
    
    # If no pattern matches, return original string
    return date_str

def _calculate_confidence(data: dict) -> float:
    """
    Calculate enhanced confidence score based on completeness and quality of extracted data.
    
    Args:
        data (dict): Extracted receipt data
        
    Returns:
        float: Confidence score between 0.0 and 1.0
    """
    import re
    
    score = 0.0
    
    # Critical fields for Australian tax compliance (50% of score)
    critical_fields = ["merchant_name", "date", "total_amount"]
    critical_score = 0
    for field in critical_fields:
        value = data.get(field)
        if value and str(value).strip():
            if field == "date":
                # Extra points for properly formatted date
                if re.match(r'\d{4}-\d{2}-\d{2}', str(value)):
                    critical_score += 1.2  # Bonus for correct date format
                else:
                    critical_score += 0.8  # Partial credit for date present but not formatted
            else:
                critical_score += 1
    score += (critical_score / (len(critical_fields) + 0.6)) * 0.5  # Account for date bonus
    
    # GST-related fields (25% of score) - critical for Australian tax
    gst_score = 0
    if data.get("gst_amount", 0) > 0:
        gst_score += 0.7  # GST amount present
        if data.get("gst_calculation_method") == "explicit":
            gst_score += 0.3  # Bonus for GST explicitly shown on receipt
        elif data.get("gst_calculation_method") in ["calculated_from_subtotal", "calculated_inclusive"]:
            gst_score += 0.2  # Some credit for calculated GST
    if data.get("gst_rate", 0) > 0:
        gst_score += 0.1  # GST rate present
    score += min(gst_score, 1.0) * 0.25
    
    # Tax categorization accuracy (15% of score)
    tax_score = 0
    category = data.get("suggested_tax_category", "")
    if category and category in AUSTRALIAN_TAX_CATEGORIES:
        tax_score += 0.5
        # Bonus for well-categorized merchants
        merchant = data.get("merchant_name", "").lower()
        if any(key in merchant for key in MERCHANT_TAX_CATEGORY_MAPPING):
            tax_score += 0.3
    if data.get("business_expense_likelihood", 0) > 0:
        tax_score += 0.2
    score += min(tax_score, 1.0) * 0.15
    
    # Data completeness (10% of score)
    completion_fields = ["time", "payment_method", "items", "abn"]
    completion_score = 0
    for field in completion_fields:
        value = data.get(field)
        if field == "items" and isinstance(value, list) and len(value) > 0:
            completion_score += 0.4  # Items are valuable
        elif field == "abn" and value and len(str(value).replace(" ", "")) == 11:
            completion_score += 0.3  # Valid ABN format
        elif value and str(value).strip():
            completion_score += 0.1
    score += min(completion_score, 1.0) * 0.1
    
    # Text quality bonus (uses text_quality_score if provided by Gemini)
    text_quality = data.get("text_quality_score", 0.5)
    if text_quality > 0:
        score *= (0.8 + 0.2 * text_quality)  # Scale final score by text quality
    
    # Additional Australian-specific bonuses
    bonuses = 0
    
    # ABN present bonus
    if data.get("abn") and len(str(data["abn"]).replace(" ", "")) == 11:
        bonuses += 0.05
    
    # GST calculation validation bonus
    total = data.get("total_amount", 0)
    gst = data.get("gst_amount", 0)
    if total > 0 and gst > 0:
        # Check if GST calculation is reasonable (around 9.09% of total for GST-inclusive)
        expected_gst = total / 11
        if abs(gst - expected_gst) / expected_gst < 0.1:  # Within 10% of expected
            bonuses += 0.05
    
    score += bonuses
    
    # Ensure score is between 0.0 and 1.0
    return min(max(score, 0.0), 1.0)

# CLI testing function for development
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python gemini_ocr_client.py <path_to_receipt_image>")
        print("\nGemini 2.0 Flash OCR for Australian Tax Compliance")
        print("Features:")
        print("- Australian tax category suggestions (D1-D15, P8, Personal)")
        print("- GST extraction and calculation (10% Australian standard)")
        print("- Confidence scoring for each extracted field")
        print("- Australian date format parsing (DD/MM/YYYY)")
        print("- Business vs personal expense classification")
        print("- Enhanced merchant categorization")
        sys.exit(1)
    
    test_path = sys.argv[1]
    
    try:
        print(f"Processing receipt: {test_path}")
        print("Enhanced Australian tax compliance extraction...")
        
        result = extract_data_from_image_with_gemini(test_path)
        
        if result.get("success"):
            print("\n=== EXTRACTION SUCCESSFUL ===")
            data = result["documents"][0]["data"]
            metadata = result["processing_metadata"]
            
            print(f"Merchant: {data.get('merchant_name', 'N/A')}")
            print(f"Date: {data.get('date', 'N/A')}")
            print(f"Total Amount: ${data.get('total_amount', 0):.2f}")
            print(f"GST Amount: ${data.get('gst_amount', 0):.2f}")
            print(f"Tax Category: {data.get('suggested_tax_category', 'N/A')}")
            print(f"Business Likelihood: {data.get('business_expense_likelihood', 0):.1%}")
            print(f"Confidence Score: {metadata.get('confidence', 0):.1%}")
            print(f"Text Quality: {metadata.get('text_quality', 0):.1%}")
            
            print(f"\nFull JSON result:")
            print(json.dumps(result, indent=2))
        else:
            print(f"\n=== EXTRACTION FAILED ===")
            print(f"Error: {result.get('error', 'Unknown error')}")
            
    except Exception as err:
        print(f"Error: {err}")
        sys.exit(1)
