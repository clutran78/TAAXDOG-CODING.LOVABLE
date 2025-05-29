from flask import Blueprint, request, jsonify
from firebase_config import db
from tabscanner_api import match_receipt_with_transaction, process_receipt_with_polling as tabscanner_process_receipt
from .utils import api_error, login_required, logger
from datetime import datetime
from basiq_api import get_user_transactions
from werkzeug.utils import secure_filename
import os, requests
import tempfile, mimetypes
from src.integrations.formx_client import extract_data_from_image_with_gemini

receipt_routes = Blueprint('receipts', __name__, url_prefix='/api/receipts')


@receipt_routes.route('/', methods=['GET'])
@login_required
def get_receipts():
    """
    Get all receipts for the user.
    """
    try:
        firebase_user_id = request.user_id
        receipts_ref = db.collection('users').document(firebase_user_id).collection('receipts')
        receipts = []
        
        # Get query parameters
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Query receipts with pagination
        query = receipts_ref.order_by('created_at', direction='DESCENDING').limit(limit).offset(offset)
        receipt_docs = query.stream()
        
        for doc in receipt_docs:
            receipt = doc.to_dict()
            receipts.append(receipt)
        
        return jsonify({
            'success': True,
            'receipts': receipts,
            'total': len(receipts),  # This is not accurate for large collections, but works for now
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))

# Receipt scanning and processing routes
@receipt_routes.route('/upload', methods=['POST'])
@login_required
def upload_receipt():
    """
    Upload and process a receipt image using Tabscanner OCR.
    """
    try:
        firebase_user_id = request.user_id
        
        if 'image' not in request.files and 'image_base64' not in request.form:
            return api_error('No image uploaded', status=400)
        
        # Process either file upload or base64 data
        image_base64 = None
        if 'image' in request.files:
            # Process file upload
            file = request.files['image']
            if file.filename == '':
                return api_error('No file selected', status=400)
                
            # Read file and convert to base64
            import base64
            image_data = file.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        else:
            # Use provided base64 data
            image_base64 = request.form.get('image_base64')
        
        # Extract receipt data using Tabscanner
        receipt_data = tabscanner_process_receipt(image_base64, user_id=firebase_user_id)
        
        if not receipt_data.get('success', False):
            return api_error('Failed to extract receipt data', status=400, details=receipt_data.get('error'))
        
        # Save category and notes if provided
        category = request.form.get('category', '')
        notes = request.form.get('notes', '')
        
        # Store receipt in Firestore
        receipt_id = receipt_data.get('receipt_id')
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        
        # Save receipt data to Firestore
        receipt_ref.set({
            'receipt_id': receipt_id,
            'user_id': firebase_user_id,
            'merchant': receipt_data.get('merchant'),
            'total_amount': receipt_data.get('total_amount'),
            'date': receipt_data.get('date'),
            'items': receipt_data.get('items', []),
            'tax_amount': receipt_data.get('tax_amount', 0.0),
            'subtotal': receipt_data.get('subtotal', 0.0),
            'confidence': receipt_data.get('confidence', 0.0),
            'category': category,
            'notes': notes,
            'ocr_provider': 'tabscanner',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        # Try to match with transactions
        user_doc = db.collection('users').document(firebase_user_id).get()
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        matched_transaction = None
        if basiq_user_id:
            # Get recent transactions
            transaction_result = get_user_transactions(basiq_user_id)
            if transaction_result.get('success'):
                transactions = transaction_result.get('transactions', [])
                # Try to match with a transaction
                match_result = match_receipt_with_transaction(receipt_data, transactions)
                if match_result:
                    matched_transaction = match_result.get('transaction')
                    # Update receipt with matched transaction
                    receipt_ref.update({
                        'matched_transaction_id': match_result.get('transaction_id'),
                        'match_confidence': match_result.get('confidence')
                    })
        
        return jsonify({
            'success': True,
            'receipt': receipt_data,
            'matched_transaction': matched_transaction
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/upload/tabscanner', methods=['POST'])
@login_required
def upload_receipt_tabscanner():
    """
    Upload and process a receipt image using Tabscanner OCR API.
    This endpoint specifically uses Tabscanner for receipt processing.
    """
    try:
        firebase_user_id = request.user_id
        
        if 'image' not in request.files and 'image_base64' not in request.form:
            return api_error('No image uploaded', status=400)
        
        # Process either file upload or base64 data
        image_base64 = None
        if 'image' in request.files:
            # Process file upload
            file = request.files['image']
            if file.filename == '':
                return api_error('No file selected', status=400)
                
            # Read file and convert to base64
            import base64
            image_data = file.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        else:
            # Use provided base64 data
            image_base64 = request.form.get('image_base64')
        
        # Extract receipt data using Tabscanner
        receipt_data = tabscanner_process_receipt(image_base64, user_id=firebase_user_id)
        
        if not receipt_data.get('success', False):
            return api_error('Failed to extract receipt data', status=400, details=receipt_data.get('error'))
        
        # Save category and notes if provided
        category = request.form.get('category', '')
        notes = request.form.get('notes', '')
        
        # Store receipt in Firestore
        receipt_id = receipt_data.get('receipt_id')
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        
        # Save receipt data to Firestore
        receipt_ref.set({
            'receipt_id': receipt_id,
            'user_id': firebase_user_id,
            'merchant': receipt_data.get('merchant'),
            'total_amount': receipt_data.get('total_amount'),
            'date': receipt_data.get('date'),
            'items': receipt_data.get('items', []),
            'tax_amount': receipt_data.get('tax_amount', 0.0),
            'subtotal': receipt_data.get('subtotal', 0.0),
            'confidence': receipt_data.get('confidence', 0.0),
            'category': category,
            'notes': notes,
            'ocr_provider': 'tabscanner',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id,
            'receipt_data': receipt_data
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/<receipt_id>', methods=['GET'])
@login_required
def get_receipt(receipt_id):
    """
    Get a specific receipt by ID.
    """
    try:
        firebase_user_id = request.user_id
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
            
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
        return api_error('Server error occurred', status=500, details=str(e))

@receipt_routes.route('/<receipt_id>/match', methods=['POST'])
@login_required
def match_receipt(receipt_id):
    """
    Manually match a receipt with a transaction.
    """
    try:
        firebase_user_id = request.user_id
        transaction_id = request.json.get('transaction_id')
        
        if not transaction_id:
            return api_error('Transaction ID is required', status=400)
        
        # Update receipt with matched transaction
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
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
        return api_error('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/<receipt_id>', methods=['DELETE'])
@login_required
def delete_receipt(receipt_id):
    """
    Delete a receipt.
    """
    try:
        firebase_user_id = request.user_id
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
        
        # Delete the receipt
        receipt_ref.delete()
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    
@receipt_routes.route('/<receipt_id>/match/suggest', methods=['GET'])
@login_required
def suggest_receipt_match(receipt_id):
    """
    Suggest possible transaction matches for a receipt.
    This is part of step 5.3 to implement receipt matching with banking transactions.
    """
    try:
        firebase_user_id = request.user_id
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return api_error('Receipt not found', status=404)
            
        receipt = receipt_doc.to_dict()
        
        # Get the user's Basiq ID to fetch transactions
        user_doc = db.collection('users').document(firebase_user_id).get()
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return api_error('No banking connection found', status=400)
        
        # Get recent transactions
        transaction_result = get_user_transactions(basiq_user_id)
        if not transaction_result.get('success'):
            return api_error('Failed to retrieve transactions', status=500, details=transaction_result.get('error'))
            
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

# --- New gemini Image Upload Route --- #
@receipt_routes.route('/upload/gemini', methods=['POST'])
def upload_receipt_form():
    temp_file_path = None

    try:
        # Handle uploaded file
        if 'receipt' in request.files:
            file = request.files['receipt']
            if file.filename == '':
                return api_error('No selected file', status=400)

            filename = secure_filename(file.filename)
            temp_file_path = os.path.join(receipt_routes.config['UPLOAD_FOLDER'], filename)
            file.save(temp_file_path)
            logger.info(f"File uploaded: {temp_file_path}")

        # Handle URL fallback
        elif 'url' in request.form:
            url = request.form['url']
            if not url:
                return api_error('Empty URL provided', status=400)

            response = requests.get(url, stream=True)
            if response.status_code != 200:
                return api_error('Failed to fetch image from URL', status=400)

            content_type = response.headers.get('Content-Type', 'image/jpeg')
            extension = mimetypes.guess_extension(content_type) or '.jpg'

            with tempfile.NamedTemporaryFile(delete=False, suffix=extension, dir=receipt_routes.config['UPLOAD_FOLDER']) as tmp:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        tmp.write(chunk)
                temp_file_path = tmp.name
                logger.info(f"Image downloaded: {temp_file_path}")

        else:
            return api_error('No receipt file or URL provided', status=400)

        # 🧠 Process image using Gemini
        extracted_data = extract_data_from_image_with_gemini(temp_file_path)
        return jsonify({'success': True, 'data': extracted_data})

    except Exception as e:
        logger.error(f"Error during receipt processing: {e}")
        return api_error('Error during receipt processing', status=500, details=str(e))

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Temporary file deleted: {temp_file_path}")
            except Exception as e:
                logger.error(f"Error deleting temp file: {e}")