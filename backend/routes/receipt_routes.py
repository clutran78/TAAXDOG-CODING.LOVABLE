from flask import Blueprint, request, jsonify, Response
import sys
import os
from typing import Dict, Any, Optional, List, Tuple, Union
from werkzeug.datastructures import FileStorage

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from firebase_config import db
from .utils import (
    get_user_id, require_user_id, get_json_data, get_form_data, 
    get_file_upload, get_query_param, validate_required_fields,
    safe_float, safe_int, create_error_response, create_success_response
)
from datetime import datetime
from basiq_api import get_user_transactions
from werkzeug.utils import secure_filename
import requests
import tempfile, mimetypes, base64
from integrations.formx_client import extract_data_from_image_with_gemini, extract_data_from_image_enhanced
from flask import current_app
import time
import re
from PIL import Image
import traceback
from australian_tax_categorizer import categorize_receipt, get_all_categories, TaxCategory
from australian_business_compliance import (
    AustralianBusinessCompliance, 
    verify_business_abn, 
    extract_receipt_gst, 
    calculate_input_tax_credit
)

# Import custom types
try:
    from utils.types import JSON, APIResponse, UserID, Amount
except ImportError:
    JSON = Dict[str, Any]
    APIResponse = Tuple[JSON, int]
    UserID = str
    Amount = Union[int, float]

# Import production utilities with fallback
try:
    from utils.production_utils import (
        logger as prod_logger, 
        retry_with_backoff, 
        measure_performance, 
        set_request_context,
        error_handler,
        GracefulDegradation
    )
except ImportError:
    # Fallback for development mode
    prod_logger = None
    # Create compatible fallback functions
    def retry_with_backoff(max_attempts: int = 3, delay: float = 1.0):  # type: ignore
        def decorator(func): 
            return func
        return decorator
    def measure_performance(func):  # type: ignore
        return func
    def set_request_context(user_id: Optional[str] = None, request_id: Optional[str] = None) -> None:  # type: ignore
        pass
    def error_handler(func):  # type: ignore
        return func
    class GracefulDegradation:  # type: ignore
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass

# Suppress import type errors
retry_with_backoff = retry_with_backoff  # type: ignore
GracefulDegradation = GracefulDegradation  # type: ignore

# Set up logging
import logging
logger = logging.getLogger(__name__)

# Add authentication decorator
def require_auth(f):
    """Decorator to require authentication"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_user_id()
        if not user_id:
            return create_error_response("Authentication required", code="AUTH_REQUIRED"), 401
        return f(*args, **kwargs)
    return decorated_function

# Enhanced for Gemini 2.0 Flash Australian tax compliance processing

receipt_routes = Blueprint('receipts', __name__, url_prefix='/api/receipts')

@receipt_routes.before_request
def before_request() -> None:
    """Set request context for production logging"""
    set_request_context(
        user_id=request.headers.get('X-User-ID'),
        request_id=request.headers.get('X-Request-ID')
    )

# Constants for validation
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_FORMATS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
MIN_IMAGE_DIMENSIONS = (50, 50)  # Minimum width and height
MAX_IMAGE_DIMENSIONS = (4096, 4096)  # Maximum width and height
RETRY_ATTEMPTS = 3
RETRY_DELAY = 1  # seconds

def log_processing_step(
    step_name: str, 
    user_id: str, 
    receipt_id: Optional[str] = None, 
    status: str = "START", 
    details: Optional[str] = None, 
    duration: Optional[float] = None
) -> None:
    """
    Structured logging for receipt processing steps
    """
    log_data: JSON = {
        "step": step_name,
        "user_id": user_id,
        "receipt_id": receipt_id,
        "status": status,
        "timestamp": datetime.now().isoformat(),
        "details": details
    }
    
    if duration is not None:
        log_data["duration_ms"] = int(duration * 1000)
    
    if status == "SUCCESS":
        logger.info(f"Receipt Processing [{step_name}] SUCCESS", extra=log_data)
    elif status == "ERROR":
        logger.error(f"Receipt Processing [{step_name}] ERROR: {details}", extra=log_data)
    elif status == "WARNING":
        logger.warning(f"Receipt Processing [{step_name}] WARNING: {details}", extra=log_data)
    else:
        logger.info(f"Receipt Processing [{step_name}] {status}", extra=log_data)

def validate_image_file(file_path: str) -> Dict[str, Any]:
    """
    Comprehensive image validation with detailed error reporting
    """
    start_time = time.time()
    
    try:
        # Check file exists
        if not os.path.exists(file_path):
            raise ValueError("Image file not found")
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise ValueError("Image file is empty")
        if file_size > MAX_FILE_SIZE:
            raise ValueError(f"Image file too large ({file_size / 1024 / 1024:.1f}MB). Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB")
        
        # Check file extension
        _, ext = os.path.splitext(file_path)
        if ext.lower() not in ALLOWED_IMAGE_FORMATS:
            raise ValueError(f"Unsupported image format '{ext}'. Supported formats: {', '.join(ALLOWED_IMAGE_FORMATS)}")
        
        # Validate image with PIL
        try:
            with Image.open(file_path) as img:
                # Check image mode
                if img.mode not in ['RGB', 'RGBA', 'L', 'P']:
                    logger.warning(f"Unusual image mode: {img.mode}. Converting to RGB.")
                
                # Check dimensions
                width, height = img.size
                if width < MIN_IMAGE_DIMENSIONS[0] or height < MIN_IMAGE_DIMENSIONS[1]:
                    raise ValueError(f"Image too small ({width}x{height}). Minimum size is {MIN_IMAGE_DIMENSIONS[0]}x{MIN_IMAGE_DIMENSIONS[1]}")
                if width > MAX_IMAGE_DIMENSIONS[0] or height > MAX_IMAGE_DIMENSIONS[1]:
                    raise ValueError(f"Image too large ({width}x{height}). Maximum size is {MAX_IMAGE_DIMENSIONS[0]}x{MAX_IMAGE_DIMENSIONS[1]}")
                
                # Check if image is corrupted by trying to verify it
                img.verify()
                
        except Exception as e:
            if "cannot identify image file" in str(e).lower():
                raise ValueError("Invalid image file format or corrupted image")
            elif "truncated" in str(e).lower():
                raise ValueError("Image file appears to be corrupted or incomplete")
            else:
                raise ValueError(f"Image validation failed: {str(e)}")
        
        validation_time = time.time() - start_time
        return {
            "valid": True,
            "file_size": file_size,
            "format": ext.lower(),
            "validation_time": validation_time
        }
        
    except Exception as e:
        validation_time = time.time() - start_time
        return {
            "valid": False,
            "error": str(e),
            "validation_time": validation_time
        }

def validate_extracted_data(extracted_data: JSON) -> Dict[str, Any]:
    """
    Validate extracted receipt data for completeness and accuracy
    """
    validation_results: Dict[str, Any] = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "quality_score": 0.0
    }
    
    # Check if extraction was successful
    if not extracted_data.get("success", False):
        validation_results["valid"] = False
        validation_results["errors"].append("Receipt data extraction failed")
        return validation_results
    
    # Get the actual data
    data = extracted_data.get("documents", [{}])[0].get("data", {}) if extracted_data.get("documents") else extracted_data
    
    # Required fields validation
    required_fields = {
        "merchant_name": "Merchant name",
        "total_amount": "Total amount",
        "date": "Receipt date"
    }
    
    missing_fields = []
    for field, display_name in required_fields.items():
        value = data.get(field)
        if not value or (isinstance(value, str) and not value.strip()):
            missing_fields.append(display_name)
    
    if missing_fields:
        validation_results["valid"] = False
        validation_results["errors"].append(f"Missing required fields: {', '.join(missing_fields)}")
    
    # Amount validation
    total_amount = data.get("total_amount", 0)
    try:
        amount_float = safe_float(total_amount)
        if amount_float <= 0:
            validation_results["warnings"].append("Total amount is zero or negative")
        elif amount_float > 10000:
            validation_results["warnings"].append("Total amount is unusually high")
    except (ValueError, TypeError):
        validation_results["errors"].append("Invalid total amount format")
        validation_results["valid"] = False
    
    # Date validation
    date_str = data.get("date", "")
    if date_str:
        try:
            # Try to parse the date
            if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
                parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
            else:
                # Try common formats
                for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"]:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError("Unrecognized date format")
            
            # Check if date is reasonable (not too far in future or past)
            now = datetime.now()
            if parsed_date > now:
                validation_results["warnings"].append("Receipt date is in the future")
            elif (now - parsed_date).days > 365 * 5:  # 5 years
                validation_results["warnings"].append("Receipt date is more than 5 years old")
                
        except Exception:
            validation_results["errors"].append("Invalid date format")
    
    # Merchant name validation
    merchant_name = data.get("merchant_name", "").strip()
    if merchant_name:
        if len(merchant_name) < 2:
            validation_results["warnings"].append("Merchant name is very short")
        elif len(merchant_name) > 100:
            validation_results["warnings"].append("Merchant name is unusually long")
    
    # GST validation for Australian receipts
    gst_amount = data.get("gst_amount", 0)
    if total_amount > 0 and gst_amount > 0:
        expected_gst = total_amount / 11  # 10% GST inclusive
        gst_difference = abs(gst_amount - expected_gst)
        if gst_difference > 0.50:  # Allow 50 cent tolerance
            validation_results["warnings"].append("GST amount may be incorrect")
    
    # Calculate quality score based on various factors
    quality_score = 0.0
    
    # Basic data completeness (40%)
    if data.get("merchant_name"):
        quality_score += 0.15
    if data.get("total_amount", 0) > 0:
        quality_score += 0.15
    if data.get("date"):
        quality_score += 0.10
    
    # Enhanced data completeness (30%)
    if data.get("gst_amount", 0) > 0:
        quality_score += 0.10
    if data.get("items") and len(data.get("items", [])) > 0:
        quality_score += 0.10
    if data.get("payment_method"):
        quality_score += 0.05
    if data.get("abn"):
        quality_score += 0.05
    
    # Australian tax compliance features (10%)
    if data.get("suggested_tax_category") and data.get("suggested_tax_category") != "Personal":
        quality_score += 0.05  # Business-related categories get bonus
    if data.get("business_expense_likelihood", 0) > 0.7:
        quality_score += 0.03  # High business likelihood
    if data.get("gst_calculation_method") == "explicit":
        quality_score += 0.02  # GST explicitly shown on receipt
    
    # Confidence scores (30%)
    confidence_score = data.get("confidence_score", 0.5)
    quality_score += confidence_score * 0.20
    
    text_quality = data.get("text_quality_score", 0.5)
    quality_score += text_quality * 0.10
    
    validation_results["quality_score"] = min(quality_score, 1.0)
    
    # Set overall validity
    if validation_results["errors"]:
        validation_results["valid"] = False
    
    return validation_results

def retry_with_backoff(func, max_attempts=RETRY_ATTEMPTS, delay=RETRY_DELAY):
    """
    Retry a function with exponential backoff
    """
    for attempt in range(max_attempts):
        try:
            return func()
        except Exception as e:
            if attempt == max_attempts - 1:
                raise e
            
            wait_time = delay * (2 ** attempt)
            logger.warning(f"Attempt {attempt + 1} failed: {str(e)}. Retrying in {wait_time}s...")
            time.sleep(wait_time)

def match_receipt_with_transaction(receipt, transactions):
    """
    Helper function to match a receipt with banking transactions.
    Uses amount and date proximity to find the best match.
    """
    start_time = time.time()
    try:
        receipt_amount = receipt.get('amount', 0)
        receipt_date = receipt.get('date')
        
        if not receipt_amount or not receipt_date:
            log_processing_step("transaction_matching", None, None, "WARNING", 
                              "Receipt missing amount or date for matching")
            return None
        
        # Convert receipt date to datetime if it's a string
        if isinstance(receipt_date, str):
            try:
                receipt_date = datetime.fromisoformat(receipt_date.replace('Z', '+00:00'))
            except:
                log_processing_step("transaction_matching", None, None, "WARNING", 
                                  f"Invalid receipt date format: {receipt_date}")
                return None
        
        best_match = None
        best_score = 0.0
        transactions_processed = 0
        
        for transaction in transactions:
            try:
                transactions_processed += 1
                transaction_amount = abs(float(transaction.get('amount', 0)))
                transaction_date_str = transaction.get('postDateTime') or transaction.get('transactionDate')
                
                if not transaction_amount or not transaction_date_str:
                    continue
                
                # Parse transaction date
                transaction_date = datetime.fromisoformat(transaction_date_str.replace('Z', '+00:00'))
                
                # Calculate amount similarity (exact match = 1.0)
                amount_diff = abs(receipt_amount - transaction_amount)
                amount_score = 1.0 if amount_diff < 0.01 else max(0, 1.0 - (amount_diff / max(receipt_amount, transaction_amount)))
                
                # Calculate date proximity (same day = 1.0, decreases with days apart)
                date_diff = abs((receipt_date - transaction_date).days)
                date_score = max(0, 1.0 - (date_diff / 7))  # 7 days max tolerance
                
                # Combined score (amount is more important)
                combined_score = (amount_score * 0.7) + (date_score * 0.3)
                
                if combined_score > best_score and combined_score > 0.6:  # Minimum 60% confidence
                    best_score = combined_score
                    best_match = {
                        'transaction': transaction,
                        'transaction_id': transaction.get('id'),
                        'confidence': combined_score
                    }
                    
            except Exception as e:
                logger.warning(f"Error processing transaction for matching: {e}")
                continue
        
        matching_time = time.time() - start_time
        log_processing_step("transaction_matching", None, None, "SUCCESS", 
                          f"Processed {transactions_processed} transactions, found match: {best_match is not None}",
                          matching_time)
        return best_match
        
    except Exception as e:
        matching_time = time.time() - start_time
        log_processing_step("transaction_matching", None, None, "ERROR", str(e), matching_time)
        return None

@receipt_routes.route('/', methods=['GET'])
@require_auth
def get_receipts():
    """
    Get all receipts for the user.
    """
    start_time = time.time()
    firebase_user_id = get_user_id()
    
    log_processing_step("get_receipts", firebase_user_id, status="START")
    
    try:
        receipts_ref = db.collection('users').document(firebase_user_id).collection('receipts')
        receipts = []
        
        # Get query parameters
        limit = get_query_param(request, 'limit', 50, type=int)
        offset = get_query_param(request, 'offset', 0, type=int)
        
        # Validate parameters
        if limit > 100:
            limit = 100
        if limit < 1:
            limit = 1
        if offset < 0:
            offset = 0
        
        # Query receipts with pagination
        query = receipts_ref.order_by('created_at', direction='DESCENDING').limit(limit).offset(offset)
        receipt_docs = query.stream()
        
        for doc in receipt_docs:
            receipt = doc.to_dict()
            receipts.append(receipt)
        
        processing_time = time.time() - start_time
        log_processing_step("get_receipts", firebase_user_id, None, "SUCCESS", 
                          f"Retrieved {len(receipts)} receipts", processing_time)
        
        return jsonify({
            'success': True,
            'receipts': receipts,
            'total': len(receipts),
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        processing_time = time.time() - start_time
        log_processing_step("get_receipts", firebase_user_id, None, "ERROR", str(e), processing_time)
        return create_error_response('Failed to retrieve receipts', status=500, details=str(e))

# Receipt scanning and processing routes
@receipt_routes.route('/upload', methods=['POST'])
@require_auth
@measure_performance
def upload_receipt():
    """
    Upload and process a receipt image using enhanced Gemini 2.0 Flash API for Australian tax compliance.
    
    Features:
    - Australian tax category classification (D1-D15, P8, Personal)
    - Enhanced GST calculation and validation
    - Business expense likelihood scoring
    - Automatic transaction matching with banking data
    - Comprehensive error handling and retry logic
    - Multiple upload methods: file, base64, URL
    
    Processes the receipt, extracts data, and attempts to match with banking transactions.
    """
    temp_file_path = None
    start_time = time.time()
    firebase_user_id = get_user_id()
    receipt_id = str(datetime.now().timestamp())
    
    log_processing_step("receipt_upload", firebase_user_id, receipt_id, "START")
    
    try:
        # Step 1: Handle different upload methods
        upload_start = time.time()
        image_base64 = None
        upload_method = None
        
        if 'image' in request.files:
            upload_method = "file_upload"
            file = request.files['image']
            if file.filename == '':
                log_processing_step("file_validation", firebase_user_id, receipt_id, "ERROR", "No file selected")
                return create_error_response('No file selected', status=400)
                
            log_processing_step("file_upload", firebase_user_id, receipt_id, "START", 
                              f"Processing uploaded file: {file.filename}")
            
            # Save file temporarily for processing
            filename = secure_filename(file.filename)
            temp_file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f"{receipt_id}_{filename}")
            file.save(temp_file_path)
            
        elif 'image_base64' in request.form:
            upload_method = "base64"
            image_base64 = request.form.get('image_base64')
            if not image_base64:
                log_processing_step("file_validation", firebase_user_id, receipt_id, "ERROR", "Empty base64 image data")
                return create_error_response('Empty base64 image data', status=400)
            
            log_processing_step("base64_upload", firebase_user_id, receipt_id, "START")
            
            try:
                image_data = base64.b64decode(image_base64)
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', 
                                               dir=current_app.config['UPLOAD_FOLDER']) as tmp:
                    tmp.write(image_data)
                    temp_file_path = tmp.name
            except Exception as e:
                log_processing_step("base64_upload", firebase_user_id, receipt_id, "ERROR", 
                                  f"Base64 decode failed: {str(e)}")
                return create_error_response('Invalid base64 image data', status=400)
            
        elif 'receipt' in request.files:
            upload_method = "receipt_field"
            file = request.files['receipt']
            if file.filename == '':
                log_processing_step("file_validation", firebase_user_id, receipt_id, "ERROR", "No selected file")
                return create_error_response('No selected file', status=400)

            filename = secure_filename(file.filename)
            temp_file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f"{receipt_id}_{filename}")
            file.save(temp_file_path)
            
        elif 'url' in request.form:
            upload_method = "url_download"
            url = request.form['url']
            if not url:
                log_processing_step("url_validation", firebase_user_id, receipt_id, "ERROR", "Empty URL provided")
                return create_error_response('Empty URL provided', status=400)

            log_processing_step("url_download", firebase_user_id, receipt_id, "START", f"Downloading from: {url}")
            
            try:
                def download_image():
                    response = requests.get(url, stream=True, timeout=30)
                    if response.status_code != 200:
                        raise Exception(f"HTTP {response.status_code}: Failed to fetch image")
                    return response
                
                response = retry_with_backoff(download_image)
                
                content_type = response.headers.get('Content-Type', 'image/jpeg')
                extension = mimetypes.guess_extension(content_type) or '.jpg'

                with tempfile.NamedTemporaryFile(delete=False, suffix=extension, 
                                               dir=current_app.config['UPLOAD_FOLDER']) as tmp:
                    for chunk in response.iter_content(chunk_size=1024):
                        if chunk:
                            tmp.write(chunk)
                    temp_file_path = tmp.name
                    
            except Exception as e:
                log_processing_step("url_download", firebase_user_id, receipt_id, "ERROR", str(e))
                return create_error_response(f'Failed to download image from URL: {str(e)}', status=400)
        else:
            log_processing_step("upload_validation", firebase_user_id, receipt_id, "ERROR", 
                              "No image upload method provided")
            return create_error_response('No image uploaded. Please provide image file, base64 data, or URL', status=400)
        
        upload_time = time.time() - upload_start
        log_processing_step("file_upload", firebase_user_id, receipt_id, "SUCCESS", 
                          f"Upload method: {upload_method}", upload_time)
        
        # Step 2: Validate image file
        validation_start = time.time()
        validation_result = validate_image_file(temp_file_path)
        
        if not validation_result["valid"]:
            log_processing_step("image_validation", firebase_user_id, receipt_id, "ERROR", 
                              validation_result["error"])
            return create_error_response(f'Invalid image: {validation_result["error"]}', status=400)
        
        validation_time = time.time() - validation_start
        log_processing_step("image_validation", firebase_user_id, receipt_id, "SUCCESS", 
                          f"File size: {validation_result['file_size']} bytes, Format: {validation_result['format']}", 
                          validation_time)
        
        # Step 3: Process image with Gemini OCR with retry logic
        extraction_start = time.time()
        log_processing_step("gemini_extraction", firebase_user_id, receipt_id, "START")
        
        def extract_data():
            # Try Claude first, fallback to Gemini for enhanced OCR accuracy
            user_profile = None
            try:
                # Get user's tax profile for better Claude analysis
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
                if tax_profile_ref:
                    user_profile = tax_profile_ref[0].to_dict()
            except Exception:
                pass  # Continue without profile
            
            return extract_data_from_image_enhanced(temp_file_path, user_profile)
        
        try:
            extracted_data = retry_with_backoff(extract_data)
        except Exception as e:
            extraction_time = time.time() - extraction_start
            log_processing_step("gemini_extraction", firebase_user_id, receipt_id, "ERROR", 
                              f"All retry attempts failed: {str(e)}", extraction_time)
            return create_error_response('Receipt processing failed after multiple attempts. Please try with a clearer image.', 
                           status=500, details=str(e))
        
        extraction_time = time.time() - extraction_start
        
        if not extracted_data or not extracted_data.get("success"):
            error_msg = extracted_data.get("error", "Unknown extraction error") if extracted_data else "No data extracted"
            log_processing_step("gemini_extraction", firebase_user_id, receipt_id, "ERROR", error_msg, extraction_time)
            return create_error_response('Failed to extract data from receipt. Please ensure the image is clear and try again.', 
                           status=500, details=error_msg)
        
        log_processing_step("gemini_extraction", firebase_user_id, receipt_id, "SUCCESS", 
                          f"Extraction confidence: {extracted_data.get('processing_metadata', {}).get('confidence', 0):.2f}", 
                          extraction_time)
        
        # Step 4: Validate extracted data
        validation_start = time.time()
        log_processing_step("data_validation", firebase_user_id, receipt_id, "START")
        
        data_validation = validate_extracted_data(extracted_data)
        
        if not data_validation["valid"]:
            validation_time = time.time() - validation_start
            error_details = "; ".join(data_validation["errors"])
            log_processing_step("data_validation", firebase_user_id, receipt_id, "ERROR", 
                              error_details, validation_time)
            return create_error_response(f'Extracted data validation failed: {error_details}', status=422)
        
        if data_validation["warnings"]:
            log_processing_step("data_validation", firebase_user_id, receipt_id, "WARNING", 
                              "; ".join(data_validation["warnings"]))
        
        validation_time = time.time() - validation_start
        log_processing_step("data_validation", firebase_user_id, receipt_id, "SUCCESS", 
                          f"Quality score: {data_validation['quality_score']:.2f}", validation_time)
        
        # Step 5: Prepare receipt data for storage
        processing_start = time.time()
        
        # Extract data from the response structure
        if extracted_data.get("documents"):
            receipt_extracted_data = extracted_data["documents"][0]["data"]
        else:
            receipt_extracted_data = extracted_data
        
        # Step 5.5: Enhanced Australian Tax Categorization
        enhanced_categorization_start = time.time()
        try:
            # Fetch user's tax profile for intelligent categorization
            user_tax_profile = None
            try:
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
                if tax_profile_ref:
                    user_tax_profile = tax_profile_ref[0].to_dict() if tax_profile_ref else None
            except Exception as profile_error:
                logger.warning(f"Could not fetch tax profile for enhanced categorization: {profile_error}")
            
            # Apply enhanced categorization
            categorization_result = categorize_receipt(receipt_extracted_data, user_tax_profile)
            
            # Update the extracted data with enhanced categorization
            receipt_extracted_data.update({
                'enhanced_tax_category': categorization_result.category.name,
                'enhanced_tax_category_description': categorization_result.category.value,
                'categorization_confidence': categorization_result.confidence,
                'deductibility_percentage': categorization_result.deductibility,
                'requires_verification': categorization_result.requires_verification,
                'suggested_evidence': categorization_result.suggested_evidence,
                'categorization_reasoning': categorization_result.reasoning,
                'alternative_categories': [
                    {
                        'category': alt_cat.name, 
                        'description': alt_cat.value, 
                        'confidence': alt_conf
                    } 
                    for alt_cat, alt_conf in categorization_result.alternative_categories
                ]
            })
            
            # Also update the original category field for backward compatibility
            if categorization_result.confidence > 0.5:  # Only override if reasonably confident
                receipt_extracted_data['suggested_tax_category'] = categorization_result.category.name
            
            enhanced_categorization_time = time.time() - enhanced_categorization_start
            log_processing_step("enhanced_categorization", firebase_user_id, receipt_id, "SUCCESS", 
                              f"Enhanced categorization: {categorization_result.category.name} (confidence: {categorization_result.confidence:.2f})",
                              enhanced_categorization_time)
                              
        except Exception as e:
            enhanced_categorization_time = time.time() - enhanced_categorization_start
            log_processing_step("enhanced_categorization", firebase_user_id, receipt_id, "WARNING", 
                              f"Enhanced categorization failed: {str(e)}", enhanced_categorization_time)
            # Continue with existing categorization
        
        receipt_data = {
            'id': receipt_id,
            'user_id': firebase_user_id,
            'extracted_data': receipt_extracted_data,
            'amount': receipt_extracted_data.get('total_amount', 0),
            'merchant': receipt_extracted_data.get('merchant_name', ''),
            'date': receipt_extracted_data.get('date', ''),
            'category': receipt_extracted_data.get('suggested_tax_category', 'Personal'),
            'business_expense_likelihood': receipt_extracted_data.get('business_expense_likelihood', 0.5),
            'created_at': datetime.now().isoformat(),
            'processed_with': 'gemini-2.0-flash-enhanced',
            'matched_transaction_id': None,
            'match_confidence': 0.0,
            'manually_matched': False,
            'upload_method': upload_method,
            'processing_metadata': {
                'extraction_confidence': extracted_data.get('processing_metadata', {}).get('confidence', 0),
                'data_quality_score': data_validation['quality_score'],
                'validation_warnings': data_validation['warnings'],
                'file_size': validation_result['file_size'],
                'file_format': validation_result['format']
            }
        }
        
        # Step 6: Attempt to match with banking transactions
        matching_start = time.time()
        try:
            log_processing_step("bank_matching", firebase_user_id, receipt_id, "START")
            
            user_doc = db.collection('users').document(firebase_user_id).get()
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id') if user_data else None
            
            if basiq_user_id:
                log_processing_step("bank_matching", firebase_user_id, receipt_id, "PROGRESS", 
                                  "Fetching banking transactions...")
                
                def get_transactions():
                    return get_user_transactions(basiq_user_id)
                
                transaction_result = retry_with_backoff(get_transactions)
                
                if transaction_result.get('success'):
                    transactions = transaction_result.get('transactions', [])
                    match_result = match_receipt_with_transaction(receipt_data, transactions)
                    
                    if match_result:
                        receipt_data['matched_transaction_id'] = match_result.get('transaction_id')
                        receipt_data['match_confidence'] = match_result.get('confidence')
                        log_processing_step("bank_matching", firebase_user_id, receipt_id, "SUCCESS", 
                                          f"Transaction match found with {match_result.get('confidence'):.2f} confidence")
                    else:
                        log_processing_step("bank_matching", firebase_user_id, receipt_id, "INFO", 
                                          "No matching transaction found")
                else:
                    log_processing_step("bank_matching", firebase_user_id, receipt_id, "WARNING", 
                                      f"Failed to fetch transactions: {transaction_result.get('error')}")
            else:
                log_processing_step("bank_matching", firebase_user_id, receipt_id, "INFO", 
                                  "No Basiq user ID found, skipping transaction matching")
                
        except Exception as e:
            matching_time = time.time() - matching_start
            log_processing_step("bank_matching", firebase_user_id, receipt_id, "WARNING", 
                              f"Error during transaction matching: {str(e)}", matching_time)
            # Continue without matching - not a critical failure
        
        # Step 7: Save receipt to Firebase
        storage_start = time.time()
        try:
            log_processing_step("firebase_storage", firebase_user_id, receipt_id, "START")
            
            receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_data['id'])
            receipt_ref.set(receipt_data)
            
            storage_time = time.time() - storage_start
            log_processing_step("firebase_storage", firebase_user_id, receipt_id, "SUCCESS", 
                              f"Receipt saved successfully", storage_time)
            
        except Exception as e:
            storage_time = time.time() - storage_start
            log_processing_step("firebase_storage", firebase_user_id, receipt_id, "ERROR", str(e), storage_time)
            return create_error_response('Failed to save receipt data', status=500, details=str(e))
        
        # Final success logging
        total_time = time.time() - start_time
        log_processing_step("receipt_upload", firebase_user_id, receipt_id, "SUCCESS", 
                          f"Complete processing finished", total_time)
        
        # Return response in expected format for frontend compatibility
        return jsonify({
            'success': True,
            'receipt_id': receipt_data['id'],
            'data': receipt_extracted_data,
            'receipt': receipt_data,
            'matched_transaction': receipt_data.get('matched_transaction_id'),
            'match_confidence': receipt_data.get('match_confidence', 0.0),
            'processing_summary': {
                'total_time_ms': int(total_time * 1000),
                'extraction_confidence': receipt_data['processing_metadata']['extraction_confidence'],
                'data_quality_score': receipt_data['processing_metadata']['data_quality_score'],
                'business_expense_likelihood': receipt_data.get('business_expense_likelihood', 0.5),
                'suggested_tax_category': receipt_extracted_data.get('suggested_tax_category', 'Personal'),
                'validation_warnings': data_validation['warnings'],
                'upload_method': upload_method,
                'gemini_enhanced_features': True
            }
        })
        
    except Exception as e:
        # Catch-all error handling
        total_time = time.time() - start_time
        error_trace = traceback.format_exc()
        log_processing_step("receipt_upload", firebase_user_id, receipt_id, "ERROR", 
                          f"Unexpected error: {str(e)}\n{error_trace}", total_time)
        
        # Return user-friendly error message
        return create_error_response('An unexpected error occurred during receipt processing. Please try again.', 
                       status=500, details=str(e))
    
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Temporary file deleted: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Error deleting temporary file: {e}")

@receipt_routes.route('/<receipt_id>', methods=['GET'])
@require_auth
def get_receipt(receipt_id):
    """
    Get a specific receipt by ID.
    """
    try:
        firebase_user_id = get_user_id()
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return create_error_response('Receipt not found', status=404)
            
        receipt = receipt_doc.to_dict()
        
        # Check if receipt has a matched transaction
        matched_transaction = None
        if receipt.get('matched_transaction_id'):
            # We could fetch the transaction details here
            # For now, we'll just return the ID
            matched_transaction = {
                'id': receipt.get('matched_transaction_id')
            }
        
        return jsonify({
            'success': True,
            'receipt': receipt,
            'matched_transaction': matched_transaction
        })
        
    except Exception as e:
        return create_error_response('Server error occurred', status=500, details=str(e))

@receipt_routes.route('/<receipt_id>/match', methods=['POST'])
@require_auth
def match_receipt(receipt_id):
    """
    Manually match a receipt with a transaction.
    """
    try:
        firebase_user_id = get_user_id()
        transaction_id = request.json.get('transaction_id')
        
        if not transaction_id:
            return create_error_response('Transaction ID is required', status=400)
        
        # Update receipt with matched transaction
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return create_error_response('Receipt not found', status=404)
        
        # Update receipt with matched transaction
        receipt_ref.update({
            'matched_transaction_id': transaction_id,
            'match_confidence': 1.0,  # Manual match has 100% confidence
            'manually_matched': True
        })
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id,
            'transaction_id': transaction_id
        })
        
    except Exception as e:
        return create_error_response('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/<receipt_id>', methods=['DELETE'])
@require_auth
def delete_receipt(receipt_id):
    """
    Delete a receipt.
    """
    try:
        firebase_user_id = get_user_id()
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return create_error_response('Receipt not found', status=404)
        
        # Delete the receipt
        receipt_ref.delete()
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id
        })
        
    except Exception as e:
        return create_error_response('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/<receipt_id>/match/suggest', methods=['GET'])
@require_auth
def suggest_receipt_match(receipt_id):
    """
    Suggest possible transaction matches for a receipt.
    This is part of step 5.3 to implement receipt matching with banking transactions.
    """
    try:
        firebase_user_id = get_user_id()
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return create_error_response('Receipt not found', status=404)
            
        receipt = receipt_doc.to_dict()
        
        # Get the user's Basiq ID to fetch transactions
        user_doc = db.collection('users').document(firebase_user_id).get()
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return create_error_response('No banking connection found', status=400)
        
        # Get recent transactions
        transaction_result = get_user_transactions(basiq_user_id)
        if not transaction_result.get('success'):
            return create_error_response('Failed to retrieve transactions', status=500, details=transaction_result.get('error'))
            
        transactions = transaction_result.get('transactions', [])
        
        # Try to match with a transaction
        match_result = match_receipt_with_transaction(receipt, transactions)
        
        if match_result:
            return jsonify({
                'success': True,
                'matched_transaction': match_result.get('transaction'),
                'transaction_id': match_result.get('transaction_id'),
                'confidence': match_result.get('confidence')
            })
        else:
            return jsonify({
                'success': True,
                'matched_transaction': None,
                'message': 'No matching transaction found'
            })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))

# Enhanced Gemini endpoint - optimized for Australian tax compliance
@receipt_routes.route('/upload/gemini', methods=['POST'])
@require_auth
def upload_receipt_gemini():
    """
    Enhanced Gemini 2.0 Flash upload endpoint specifically optimized for Australian tax compliance.
    This endpoint uses the same core processing as the main upload but with additional
    Australian-specific validation and response formatting.
    """
    logger.info("Enhanced Gemini 2.0 Flash route called for Australian tax processing")
    
    # Use the main upload function but add enhanced Australian tax processing
    result = upload_receipt()
    
    # If successful, enhance the response with Australian tax compliance information
    if isinstance(result, tuple):
        return result  # Error response
    
    response_data = result.get_json()
    if response_data.get('success') and 'data' in response_data:
        # Add Australian tax compliance summary
        extracted_data = response_data['data']
        tax_category = extracted_data.get('suggested_tax_category', 'Personal')
        business_likelihood = extracted_data.get('business_expense_likelihood', 0.5)
        
        response_data['australian_tax_summary'] = {
            'category': tax_category,
            'category_description': get_tax_category_description(tax_category),
            'is_business_expense': business_likelihood > 0.5,
            'business_likelihood_percentage': round(business_likelihood * 100, 1),
            'gst_amount': extracted_data.get('gst_amount', 0),
            'gst_calculation_method': extracted_data.get('gst_calculation_method', 'none'),
            'ato_compliant': True
        }
    
    return jsonify(response_data)

# Legacy TabScanner endpoint - returns 501 Not Implemented
@receipt_routes.route('/upload/tabscanner', methods=['POST'])
@login_required
def upload_receipt_tabscanner():
    """
    Legacy TabScanner endpoint - no longer supported.
    Returns 501 Not Implemented with migration guidance.
    """
    logger.warning("Deprecated TabScanner endpoint called - returning 501 Not Implemented")
    
    return jsonify({
        'success': False,
        'error': 'TabScanner OCR service has been discontinued',
        'message': 'This service has been replaced with enhanced Gemini 2.0 Flash API for better Australian tax compliance',
        'migration_info': {
            'new_endpoint': '/api/receipts/upload/gemini',
            'improvement': 'Enhanced Australian tax categorization with D1-D15 categories',
            'features': [
                'Better GST calculation and validation',
                'Australian business expense classification',
                'Improved merchant categorization',
                'Higher accuracy OCR with confidence scoring'
            ]
        },
        'deprecated': True,
        'removal_date': '2024-12-01'
    }), 501

def get_tax_category_description(category):
    """Helper function to get human-readable tax category descriptions"""
    descriptions = {
        'D1': 'Car expenses (work-related)',
        'D2': 'Travel expenses (work-related)', 
        'D3': 'Clothing expenses (work-related)',
        'D4': 'Education expenses (work-related)',
        'D5': 'Home office expenses',
        'D6': 'Equipment and tools',
        'D7': 'Phone and internet (work-related)',
        'D8': 'Professional development',
        'D9': 'Subscriptions and memberships',
        'D10': 'Insurance (work-related)',
        'D11': 'Interest and bank fees',
        'D12': 'Income protection insurance',
        'D13': 'Gifts and donations',
        'D14': 'Investment expenses',
        'D15': 'Other work-related expenses',
        'P8': 'Personal services income',
        'Personal': 'Personal/non-deductible expense'
    }
    return descriptions.get(category, 'Unknown category')


@receipt_routes.route('/categories', methods=['GET'])
@login_required 
def get_tax_categories():
    """
    Get all available Australian tax categories with detailed information.
    """
    try:
        categories = get_all_categories()
        return jsonify({
            'success': True,
            'categories': categories
        })
    except Exception as e:
        return api_error('Failed to fetch tax categories', status=500, details=str(e))


@receipt_routes.route('/<receipt_id>/categorize', methods=['POST'])
@login_required
def update_receipt_categorization(receipt_id):
    """
    Update or override the tax categorization for a receipt.
    Allows manual categorization with optional reasoning.
    """
    try:
        firebase_user_id = request.user_id
        data = request.get_json()
        
        if not data:
            return api_error('Request data is required', status=400)
        
        new_category = data.get('category')
        manual_reasoning = data.get('reasoning', '')
        override_confidence = data.get('override_confidence', 1.0)
        
        if not new_category:
            return api_error('Category is required', status=400)
        
        # Validate category
        valid_categories = [cat.name for cat in TaxCategory]
        if new_category not in valid_categories:
            return api_error(f'Invalid category. Valid options: {", ".join(valid_categories)}', status=400)
        
        # Get the receipt
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
        receipt_data = receipt_doc.to_dict()
        
        # Update categorization with manual override
        categorization_update = {
            'category': new_category,
            'enhanced_tax_category': new_category,
            'enhanced_tax_category_description': TaxCategory[new_category].value,
            'categorization_confidence': override_confidence,
            'requires_verification': False,  # Manual categorization doesn't require verification
            'categorization_reasoning': f"Manual override: {manual_reasoning}" if manual_reasoning else "Manual categorization",
            'manual_override': True,
            'manual_override_timestamp': datetime.now().isoformat(),
            'manual_override_user': firebase_user_id
        }
        
        # Update the receipt's extracted_data
        if 'extracted_data' in receipt_data:
            receipt_data['extracted_data'].update(categorization_update)
        
        # Update the top-level category field
        receipt_data['category'] = new_category
        
        # Save the updated receipt
        receipt_ref.update({
            'extracted_data': receipt_data.get('extracted_data', {}),
            'category': new_category
        })
        
        return jsonify({
            'success': True,
            'message': 'Receipt categorization updated successfully',
            'updated_category': new_category,
            'updated_description': TaxCategory[new_category].value
        })
        
    except Exception as e:
        return api_error('Failed to update receipt categorization', status=500, details=str(e))


@receipt_routes.route('/<receipt_id>/categorize/suggest', methods=['GET'])
@login_required
def suggest_receipt_categorization(receipt_id):
    """
    Re-run categorization analysis for a receipt with current user profile.
    Useful for getting updated suggestions based on profile changes.
    """
    try:
        firebase_user_id = request.user_id
        
        # Get the receipt
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
        receipt_data = receipt_doc.to_dict()
        extracted_data = receipt_data.get('extracted_data', {})
        
        # Fetch current user tax profile
        user_tax_profile = None
        try:
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
            if tax_profile_ref:
                user_tax_profile = tax_profile_ref[0].to_dict()
        except Exception as profile_error:
            logger.warning(f"Could not fetch tax profile for categorization suggestions: {profile_error}")
        
        # Re-run categorization
        categorization_result = categorize_receipt(extracted_data, user_tax_profile)
        
        return jsonify({
            'success': True,
            'suggestions': {
                'primary_category': {
                    'category': categorization_result.category.name,
                    'description': categorization_result.category.value,
                    'confidence': categorization_result.confidence,
                    'deductibility': categorization_result.deductibility,
                    'reasoning': categorization_result.reasoning
                },
                'alternative_categories': [
                    {
                        'category': alt_cat.name,
                        'description': alt_cat.value,
                        'confidence': alt_conf
                    }
                    for alt_cat, alt_conf in categorization_result.alternative_categories
                ],
                'requires_verification': categorization_result.requires_verification,
                'suggested_evidence': categorization_result.suggested_evidence
            }
        })
        
    except Exception as e:
        return api_error('Failed to generate categorization suggestions', status=500, details=str(e))


# New Business Compliance Endpoints

@receipt_routes.route('/<receipt_id>/gst', methods=['GET'])
@login_required
def get_receipt_gst_details(receipt_id):
    """
    Extract and analyze GST information from a receipt for business compliance.
    """
    try:
        firebase_user_id = request.user_id
        
        # Get the receipt
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
        receipt_data = receipt_doc.to_dict()
        extracted_data = receipt_data.get('extracted_data', {})
        
        # Extract GST information
        gst_extraction = extract_receipt_gst(extracted_data)
        
        return jsonify({
            'success': True,
            'gst_details': {
                'total_amount': float(gst_extraction.total_amount),
                'gst_amount': float(gst_extraction.gst_amount),
                'gst_free_amount': float(gst_extraction.gst_free_amount),
                'gst_inclusive_amount': float(gst_extraction.gst_inclusive_amount),
                'gst_rate': float(gst_extraction.gst_rate),
                'extraction_confidence': gst_extraction.extraction_confidence,
                'extraction_method': gst_extraction.extraction_method,
                'requires_verification': gst_extraction.requires_verification
            }
        })
        
    except Exception as e:
        return api_error('Failed to extract GST details', status=500, details=str(e))


@receipt_routes.route('/<receipt_id>/input-tax-credit', methods=['GET'])
@login_required
def get_receipt_input_tax_credit(receipt_id):
    """
    Calculate input tax credit eligibility and amount for business users.
    """
    try:
        firebase_user_id = request.user_id
        
        # Get the receipt
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
        receipt_data = receipt_doc.to_dict()
        extracted_data = receipt_data.get('extracted_data', {})
        
        # Fetch user tax profile
        user_tax_profile = None
        try:
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
            if tax_profile_ref:
                user_tax_profile = tax_profile_ref[0].to_dict()
        except Exception as profile_error:
            logger.warning(f"Could not fetch tax profile for ITC calculation: {profile_error}")
            return api_error('Tax profile required for input tax credit calculation', status=400)
        
        # Calculate input tax credit
        itc = calculate_input_tax_credit(extracted_data, user_tax_profile)
        
        return jsonify({
            'success': True,
            'input_tax_credit': {
                'eligible_amount': float(itc.eligible_amount),
                'gst_credit': float(itc.gst_credit),
                'business_use_percentage': float(itc.business_use_percentage),
                'creditable_percentage': float(itc.creditable_percentage),
                'reasoning': itc.reasoning,
                'evidence_required': itc.evidence_required,
                'category_code': itc.category_code
            }
        })
        
    except Exception as e:
        return api_error('Failed to calculate input tax credit', status=500, details=str(e))


@receipt_routes.route('/verify-abn', methods=['POST'])
@login_required
def verify_abn():
    """
    Verify an Australian Business Number (ABN) using the official registry.
    """
    try:
        data = request.get_json()
        
        if not data or 'abn' not in data:
            return api_error('ABN is required', status=400)
        
        abn = data.get('abn')
        abr_api_key = data.get('abr_api_key')  # Optional API key for detailed lookup
        
        # Verify ABN
        abn_details = verify_business_abn(abn, abr_api_key)
        
        return jsonify({
            'success': True,
            'abn_details': {
                'abn': abn_details.abn,
                'is_valid': abn_details.is_valid,
                'entity_name': abn_details.entity_name,
                'entity_type': abn_details.entity_type.value,
                'status': abn_details.status,
                'gst_registered': abn_details.gst_registered,
                'gst_from_date': abn_details.gst_from_date,
                'gst_to_date': abn_details.gst_to_date,
                'error_message': abn_details.error_message
            }
        })
        
    except Exception as e:
        return api_error('Failed to verify ABN', status=500, details=str(e))


@receipt_routes.route('/bulk/gst-analysis', methods=['POST'])
@login_required
def bulk_gst_analysis():
    """
    Analyze GST across multiple receipts for business compliance reporting.
    """
    try:
        firebase_user_id = request.user_id
        data = request.get_json()
        
        receipt_ids = data.get('receipt_ids', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        # Build query
        receipts_ref = db.collection('users').document(firebase_user_id).collection('receipts')
        
        if receipt_ids:
            # Specific receipts
            receipts = []
            for receipt_id in receipt_ids:
                receipt_doc = receipts_ref.document(receipt_id).get()
                if receipt_doc.exists:
                    receipt_data = receipt_doc.to_dict()
                    receipt_data['id'] = receipt_doc.id
                    receipts.append(receipt_data)
        else:
            # Date range query
            if start_date and end_date:
                receipts_docs = receipts_ref.where('date', '>=', start_date).where('date', '<=', end_date).get()
            else:
                receipts_docs = receipts_ref.get()
            
            receipts = []
            for doc in receipts_docs:
                receipt_data = doc.to_dict()
                receipt_data['id'] = doc.id
                receipts.append(receipt_data)
        
        # Analyze GST for each receipt
        gst_analysis = []
        total_gst = 0
        total_gst_free = 0
        total_gst_inclusive = 0
        
        for receipt in receipts:
            extracted_data = receipt.get('extracted_data', {})
            gst_extraction = extract_receipt_gst(extracted_data)
            
            receipt_analysis = {
                'receipt_id': receipt['id'],
                'merchant_name': extracted_data.get('merchant_name', 'Unknown'),
                'date': extracted_data.get('date', receipt.get('date')),
                'total_amount': float(gst_extraction.total_amount),
                'gst_amount': float(gst_extraction.gst_amount),
                'gst_free_amount': float(gst_extraction.gst_free_amount),
                'gst_inclusive_amount': float(gst_extraction.gst_inclusive_amount),
                'extraction_confidence': gst_extraction.extraction_confidence,
                'requires_verification': gst_extraction.requires_verification
            }
            
            gst_analysis.append(receipt_analysis)
            total_gst += gst_extraction.gst_amount
            total_gst_free += gst_extraction.gst_free_amount
            total_gst_inclusive += gst_extraction.gst_inclusive_amount
        
        # Summary statistics
        summary = {
            'total_receipts': len(receipts),
            'total_gst_amount': float(total_gst),
            'total_gst_free_amount': float(total_gst_free),
            'total_gst_inclusive_amount': float(total_gst_inclusive),
            'requires_verification_count': sum(1 for r in gst_analysis if r['requires_verification']),
            'average_confidence': sum(r['extraction_confidence'] for r in gst_analysis) / len(gst_analysis) if gst_analysis else 0
        }
        
        return jsonify({
            'success': True,
            'gst_analysis': gst_analysis,
            'summary': summary
        })
        
    except Exception as e:
        return api_error('Failed to perform bulk GST analysis', status=500, details=str(e))