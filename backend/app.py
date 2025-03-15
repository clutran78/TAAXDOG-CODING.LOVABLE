from flask import Flask, request, render_template, redirect, url_for, flash, jsonify, session
from flask_cors import CORS
import re
import os
import json
from functools import wraps
from dotenv import load_dotenv
from firebase_config import db, auth
from basiq_api import (
    create_basiq_user, 
    get_basiq_user, 
    create_auth_link, 
    get_user_connections, 
    get_user_accounts, 
    get_user_transactions,
    refresh_connection,
    delete_connection
)
from docuclipper_api import extract_receipt_data, match_receipt_with_transaction
from tabscanner_api import process_receipt_with_polling as tabscanner_process_receipt
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder='../frontend', static_folder='../frontend')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Enable CORS for all routes
CORS(app)

# Authentication middleware
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if we're in development mode
        if os.environ.get('FLASK_ENV') == 'development' or not db:
            # In development mode, mock authentication
            request.user_id = "mock-user-123"
            return f(*args, **kwargs)
        
        # Check if id_token is in the request headers
        id_token = request.headers.get('Authorization')
        if id_token:
            try:
                # Remove 'Bearer ' prefix if present
                if id_token.startswith('Bearer '):
                    id_token = id_token[7:]
                
                # Verify the ID token
                decoded_token = auth.verify_id_token(id_token)
                # Add user_id to the request context
                request.user_id = decoded_token['uid']
                return f(*args, **kwargs)
            except Exception as e:
                print(f"Authentication error: {e}")
                # For development, we'll mock authentication
                if os.environ.get('FLASK_ENV') == 'development':
                    request.user_id = "mock-user-123"
                    return f(*args, **kwargs)
                return jsonify({'success': False, 'error': 'Invalid authentication token'}), 401
        
        # No token provided
        if os.environ.get('FLASK_ENV') == 'development':
            # In development mode, mock authentication
            request.user_id = "mock-user-123"
            return f(*args, **kwargs)
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    return decorated_function

# Routes for serving HTML pages
@app.route('/')
def index():
    # Render the main HTML page
    return render_template('index.html')

@app.route('/login')
def login_page():
    # Render the login page
    return render_template('login.html')

@app.route('/register')
def register_page():
    # Render the registration page
    return render_template('register.html')

# API Routes for authentication
@app.route('/api/auth/verify-token', methods=['POST'])
def verify_token():
    """
    Verify a Firebase ID token
    """
    try:
        # Get the ID token from the request
        data = request.get_json()
        id_token = data.get('idToken')
        
        if not id_token:
            return jsonify({'success': False, 'error': 'No token provided'}), 400
        
        # Verify the ID token
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        
        # Get user data from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return jsonify({
                'success': True, 
                'user': user_data
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'User document not found'
            }), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 401

@app.route('/api/users/profile', methods=['GET'])
@login_required
def get_user_profile():
    """
    Get the current user's profile
    """
    try:
        user_id = request.user_id
        user_doc = db.collection('users').document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Remove sensitive information
            if 'password' in user_data:
                del user_data['password']
            
            return jsonify({
                'success': True, 
                'user': user_data
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'User not found'
            }), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """
    Update the current user's profile
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Fields that can be updated
        allowed_fields = ['name', 'phone']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_data:
            return jsonify({
                'success': False, 
                'error': 'No valid fields to update'
            }), 400
        
        # Update the user document
        db.collection('users').document(user_id).update(update_data)
        
        return jsonify({
            'success': True, 
            'message': 'Profile updated successfully'
        })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Banking integration with Basiq API
@app.route('/api/banking/setup-user', methods=['POST'])
@login_required
def setup_basiq_user():
    """
    Set up a user in the Basiq system.
    If the user already has a Basiq user ID, retrieve their data.
    Otherwise, create a new Basiq user.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        # If user already has a Basiq ID, retrieve their data
        if basiq_user_id:
            result = get_basiq_user(basiq_user_id)
            if result['success']:
                return jsonify({
                    'success': True,
                    'user': result['user'],
                    'message': 'Retrieved existing Basiq user'
                })
            else:
                # If there was an error retrieving the user, create a new one
                basiq_user_id = None
        
        # Create a new Basiq user
        email = user_data.get('email')
        name = user_data.get('name')
        mobile = user_data.get('phone')
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'User email not found'
            }), 400
            
        result = create_basiq_user(email, mobile, name)
        
        if result['success']:
            # Save the Basiq user ID in Firebase
            basiq_user_id = result['user']['id']
            db.collection('users').document(firebase_user_id).update({
                'basiq_user_id': basiq_user_id
            })
            
            return jsonify({
                'success': True,
                'user': result['user'],
                'message': 'Created new Basiq user'
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/create-auth-link', methods=['POST'])
@login_required
def create_bank_auth_link():
    """
    Create an authentication link for connecting a bank account.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        data = request.get_json() or {}
        mobile = data.get('mobile', True)
        
        result = create_auth_link(basiq_user_id, mobile)
        
        if result['success']:
            return jsonify({
                'success': True,
                'auth_link': result['auth_link']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/connections', methods=['GET'])
@login_required
def get_bank_connections():
    """
    Get all bank connections for the user.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        result = get_user_connections(basiq_user_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'connections': result['connections']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/accounts', methods=['GET'])
@login_required
def get_bank_accounts():
    """
    Get all bank accounts for the user.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        result = get_user_accounts(basiq_user_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'accounts': result['accounts']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/transactions', methods=['GET'])
@login_required
def get_bank_transactions():
    """
    Get bank transactions for the user.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        # Optional filter
        filter_str = request.args.get('filter')
        
        result = get_user_transactions(basiq_user_id, filter_str)
        
        if result['success']:
            return jsonify({
                'success': True,
                'transactions': result['transactions']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/connections/<connection_id>/refresh', methods=['POST'])
@login_required
def refresh_bank_connection(connection_id):
    """
    Refresh a bank connection to update account and transaction data.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        result = refresh_connection(basiq_user_id, connection_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'job': result['job']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/banking/connections/<connection_id>', methods=['DELETE'])
@login_required
def delete_bank_connection(connection_id):
    """
    Delete a bank connection.
    """
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False, 
                'error': 'User not found in Firebase'
            }), 404
            
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'Basiq user not set up. Please call /api/banking/setup-user first.'
            }), 400
            
        result = delete_connection(basiq_user_id, connection_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message']
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Legacy route for tax information submission
@app.route('/submit-tax-info', methods=['POST'])
def submit_tax_info():
    """
    Handle the tax information form submission.
    This route processes the form data and would typically store it in a database.
    """
    # Get form data
    form_data = {
        'fullName': request.form.get('fullName'),
        'email': request.form.get('email'),
        'phone': request.form.get('phone'),
        'taxYear': request.form.get('taxYear'),
        'filingStatus': request.form.get('filingStatus'),
        'income': request.form.get('income'),
        'dependents': request.form.get('dependents'),
        'additionalInfo': request.form.get('additionalInfo'),
        'consent': request.form.get('consent')
    }
    
    # Server-side validation
    errors = {}
    
    # Validate required fields
    required_fields = ['fullName', 'email', 'taxYear', 'filingStatus', 'income', 'consent']
    for field in required_fields:
        if not form_data.get(field):
            errors[field] = f"{field} is required"
    
    # Validate email format
    if form_data.get('email') and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', form_data['email']):
        errors['email'] = "Invalid email format"
    
    # Validate Australian phone number if provided
    if form_data.get('phone'):
        # Australian phone regex pattern
        phone_pattern = r'^(?:\(?(?:0|\+61)(?:\)|[ -])?)?(?:4[ -]?[0-9]{2}|(?:3[1-9]|[57-9][0-9]|2[1-9])[ -]?[0-9])[ -]?[0-9]{3}[ -]?[0-9]{3}$'
        if not re.match(phone_pattern, form_data['phone']):
            errors['phone'] = "Invalid Australian phone number format"
    
    # If there are validation errors, return them
    if errors:
        if request.headers.get('Content-Type') == 'application/json':
            return jsonify({'success': False, 'errors': errors}), 400
        else:
            # In a real app, you would flash messages and redirect back to the form
            error_html = "<ul>"
            for field, message in errors.items():
                error_html += f"<li>{message}</li>"
            error_html += "</ul>"
            return f"""
            <html>
                <head>
                    <title>TAAXDOG - Validation Error</title>
                    <style>
                        body {{
                            font-family: 'Arial', sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f5f5f5;
                        }}
                        .container {{
                            background-color: white;
                            padding: 30px;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                        }}
                        h1 {{
                            color: #e74c3c;
                        }}
                        ul {{
                            color: #e74c3c;
                        }}
                        a {{
                            display: inline-block;
                            margin-top: 20px;
                            color: #3498db;
                            text-decoration: none;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Validation Error</h1>
                        <p>Please correct the following errors:</p>
                        {error_html}
                        <a href="/">Return to Form</a>
                    </div>
                </body>
            </html>
            """
    
    # Here you would typically:
    # 1. Store the data in a database
    # 2. Process it as needed
    
    # For now, just print the data (for debugging)
    print("Received tax information:", form_data)
    
    # Return a JSON response for API usage or redirect for web form
    if request.headers.get('Content-Type') == 'application/json':
        return jsonify({'success': True, 'message': 'Tax information received successfully'})
    else:
        # In a real application, you might want to redirect to a thank you page
        return """
        <html>
            <head>
                <title>TAAXDOG - Submission Successful</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f5f5f5;
                        text-align: center;
                    }
                    .container {
                        background-color: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                        margin-top: 50px;
                    }
                    h1 {
                        color: #2c3e50;
                    }
                    .success-icon {
                        color: #27ae60;
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    a {
                        display: inline-block;
                        margin-top: 20px;
                        color: #3498db;
                        text-decoration: none;
                    }
                    a:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✓</div>
                    <h1>Thank You!</h1>
                    <p>Your tax information has been submitted successfully.</p>
                    <p>We will process your information and contact you soon.</p>
                    <a href="/">Return to Form</a>
                </div>
            </body>
        </html>
        """

# Receipt scanning and processing routes
@app.route('/api/receipts/upload', methods=['POST'])
@login_required
def upload_receipt():
    """
    Upload and process a receipt image using DocuClipper OCR.
    """
    try:
        firebase_user_id = request.user_id
        
        if 'image' not in request.files and 'image_base64' not in request.form:
            return jsonify({
                'success': False,
                'error': 'No image uploaded'
            }), 400
        
        # Process either file upload or base64 data
        image_base64 = None
        if 'image' in request.files:
            # Process file upload
            file = request.files['image']
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'No file selected'
                }), 400
                
            # Read file and convert to base64
            import base64
            image_data = file.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        else:
            # Use provided base64 data
            image_base64 = request.form.get('image_base64')
        
        # Check if we should use Tabscanner or DocuClipper
        use_tabscanner = request.form.get('use_tabscanner', 'false').lower() == 'true'
        
        if use_tabscanner:
            # Extract receipt data using Tabscanner
            receipt_data = tabscanner_process_receipt(image_base64, user_id=firebase_user_id)
        else:
            # Extract receipt data using DocuClipper
            receipt_data = extract_receipt_data(image_base64, user_id=firebase_user_id)
        
        if not receipt_data.get('success', False):
            return jsonify({
                'success': False,
                'error': receipt_data.get('error', 'Failed to extract receipt data')
            }), 400
        
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
            'tax_amount': receipt_data.get('tax_amount'),
            'created_at': datetime.now().isoformat(),
            'matched_transaction_id': None
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/receipts/upload/tabscanner', methods=['POST'])
@login_required
def upload_receipt_tabscanner():
    """
    Upload and process a receipt image using Tabscanner OCR API.
    This endpoint specifically uses Tabscanner for receipt processing.
    """
    try:
        firebase_user_id = request.user_id
        
        if 'image' not in request.files and 'image_base64' not in request.form:
            return jsonify({
                'success': False,
                'error': 'No image uploaded'
            }), 400
        
        # Process either file upload or base64 data
        image_base64 = None
        if 'image' in request.files:
            # Process file upload
            file = request.files['image']
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'No file selected'
                }), 400
                
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
            return jsonify({
                'success': False,
                'error': receipt_data.get('error', 'Failed to extract receipt data')
            }), 400
        
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
            'ocr_provider': 'tabscanner',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id,
            'receipt_data': receipt_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/receipts', methods=['GET'])
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/receipts/<receipt_id>', methods=['GET'])
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
            return jsonify({
                'success': False,
                'error': 'Receipt not found'
            }), 404
            
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/receipts/<receipt_id>/match', methods=['POST'])
@login_required
def match_receipt(receipt_id):
    """
    Manually match a receipt with a transaction.
    """
    try:
        firebase_user_id = request.user_id
        transaction_id = request.json.get('transaction_id')
        
        if not transaction_id:
            return jsonify({
                'success': False,
                'error': 'Transaction ID is required'
            }), 400
        
        # Update receipt with matched transaction
        receipt_ref = db.collection('users').document(firebase_user_id).collection('receipts').document(receipt_id)
        receipt_doc = receipt_ref.get()
        
        if not receipt_doc.exists:
            return jsonify({
                'success': False,
                'error': 'Receipt not found'
            }), 404
        
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/receipts/<receipt_id>', methods=['DELETE'])
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
            return jsonify({
                'success': False,
                'error': 'Receipt not found'
            }), 404
        
        # Delete the receipt
        receipt_ref.delete()
        
        return jsonify({
            'success': True,
            'receipt_id': receipt_id
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)