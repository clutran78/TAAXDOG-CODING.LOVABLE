import pdb
import sys
import os
import tempfile
import mimetypes
import requests
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from flask import Flask, request, render_template, redirect, url_for, flash, jsonify, session, send_from_directory
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
from tabscanner_api import match_receipt_with_transaction, process_receipt_with_polling as tabscanner_process_receipt
from datetime import datetime, timedelta
# Import financial insights module
from ai.financial_insights import (
    analyze_transactions,
    identify_tax_deductions,
    generate_financial_report,
    suggest_financial_goals
)
# Import secure_filename for safe file handling
from werkzeug.utils import secure_filename
# Import the FormX client
# from src.integrations.formx_client import extract_data_from_image
from src.integrations.formx_client import extract_data_from_image_with_gemini

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder='../frontend', static_folder='../frontend')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Enable CORS for all routes
CORS(app)

# Define the upload folder and ensure it exists
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Allowed file extensions (optional, but good practice)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Optional: Enable mock auth explicitly via .env
USE_MOCK_AUTH = os.environ.get("USE_MOCK_AUTH", "false").lower() == "true"

# Authentication middleware
from flask import request, jsonify
from functools import wraps
import os

USE_MOCK_AUTH = os.getenv("USE_MOCK_AUTH", "false").lower() == "true"

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        id_token = request.headers.get('Authorization')
        if id_token and id_token.startswith('Bearer '):
            id_token = id_token[7:]

        if id_token:
            try:
                print("🔐 Received Auth Token:", id_token[:10], "..." if len(id_token) > 20 else "")
                decoded_token = auth.verify_id_token(id_token)
                request.user_id = decoded_token.get('uid')

                print("✅ Firebase Token Verified - UID:", request.user_id)

                # Check for mock fallback in production
                if request.user_id.startswith("mock-") and not USE_MOCK_AUTH:
                    print("🚫 Mock user detected but USE_MOCK_AUTH is disabled.")
                    return jsonify({'success': False, 'error': 'Mock users not allowed'}), 403

                return f(*args, **kwargs)

            except Exception as e:
                print(f"🔐 Firebase token verification failed: {e}")

                if USE_MOCK_AUTH:
                    request.user_id = "mock-user-123"
                    print("⚠️ Using fallback mock-user-123 (dev only).")
                    return f(*args, **kwargs)

                return jsonify({'success': False, 'error': 'Invalid or expired authentication token'}), 401

        if USE_MOCK_AUTH:
            request.user_id = "mock-user-123"
            print("⚠️ No token provided, using mock-user-123 (dev only).")
            return f(*args, **kwargs)

        print("🚫 No token provided and mock mode disabled.")
        return jsonify({'success': False, 'error': 'Authentication token required'}), 401

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
    Set up a user in the Basiq system using data from request payload.
    If the user already has a Basiq user ID, return it.
    Otherwise, create a new Basiq user.
    """
    try:
        firebase_user_id = request.user_id
        print("🔥 Firebase UID received from token:", firebase_user_id)

        # Get Firestore user document
        user_doc = db.collection('users').document(firebase_user_id).get()

        if not user_doc.exists:
            return jsonify({
                'success': False,
                'error': 'User not found in Firebase'
            }), 404

        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')

        # If already exists, return user from Basiq
        if basiq_user_id:
            result = get_basiq_user(basiq_user_id)
            if result['success']:
                return jsonify({
                    'success': True,
                    'user': result['user'],
                    'message': 'Retrieved existing Basiq user'
                })
            else:
                basiq_user_id = None  # fallback to recreate

        # 🔽 Extract form data from request body
        data = request.get_json()
        email = data.get('email')
        mobile = data.get('mobile')
        first_name = data.get('firstName')
        last_name = data.get('lastName')
        business_name = data.get('businessName')
        business_id = data.get('businessIdNo')
        business_id_type = data.get('businessIdNoType')
        verification_status = data.get('verificationStatus', True)
        verification_date = data.get('verificationDate')
        business_address = data.get('businessAddress')

        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400

        # Call your Basiq API user creation logic
        result = create_basiq_user(
            email=email,
            mobile=mobile,
            name=f"{first_name} {last_name}",
            business_name=business_name,
            business_id=business_id,
            business_id_type=business_id_type,
            verification_status=verification_status,
            verification_date=verification_date,
            business_address=business_address
        )

        if result['success']:
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
        print("❌ Exception:", str(e))
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/banking/auth-link', methods=['POST'])
@login_required
def get_auth_link():
    """
    Get an authentication link for connecting bank accounts.
    """
    try:
        firebase_user_id = request.user_id
        data = request.get_json() or {}
        user_doc = None

        # Check if we're in development mode
        if os.environ.get('FLASK_ENV') == 'development' or not db:
            # In dev mode, create a mock auth link
            mock_auth_link = {
                'success': True,
                'auth_link': {
                    'url': 'https://mockbank-connect.basiq.io?token=mock-token',
                    'expiresAt': (datetime.now() + timedelta(hours=1)).isoformat()
                },
                'message': 'Generated mock auth link for development'
            }
            return jsonify(mock_auth_link)
        else:
            # In production mode, use real Basiq API
            user_doc = db.collection('users').document(firebase_user_id).get()
            
            if not user_doc.exists:
                return jsonify({
                    'success': False, 
                    'error': 'User not found in Firebase'
                }), 404
                
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')
            
            # If user doesn't have a Basiq ID yet, create one
            if not basiq_user_id:
                # Create a Basiq user first
                setup_result = setup_basiq_user()
                if not isinstance(setup_result, tuple):  # Not an error response
                    response_data = json.loads(setup_result.data)
                    if response_data.get('success'):
                        basiq_user_id = response_data['user']['id']
                    else:
                        return jsonify({
                            'success': False,
                            'error': 'Failed to create Basiq user',
                            'details': response_data.get('error')
                        }), 400
                else:
                    return setup_result  # Return the error response
            
            # For mobile or desktop
            mobile = data.get('mobile', True)
            
            # Get the auth link from Basiq
            result = create_auth_link(basiq_user_id, mobile)
            
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error getting auth link: {str(e)}'
        }), 500

@app.route('/api/banking/connections', methods=['GET'])
@login_required
def get_bank_connections():
    try:
        firebase_user_id = request.user_id
        user_doc = db.collection('users').document(firebase_user_id).get()
        
        if not user_doc.exists:
            return jsonify({'success': False, 'error': 'User not found in Firebase'}), 404

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
            return jsonify({'success': False, 'error': result.get('error', 'Unknown error')}), 400

    except Exception as e:
        print(f"[ERROR] Failed to get bank connections: {e}")
        return jsonify({'success': False, 'error': 'Server error occurred'}), 500


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
    Upload and process a receipt image using Tabscanner OCR.
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

@app.route('/api/receipts/<receipt_id>/match/suggest', methods=['GET'])
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
            return jsonify({
                'success': False,
                'error': 'Receipt not found'
            }), 404
            
        receipt = receipt_doc.to_dict()
        
        # Get the user's Basiq ID to fetch transactions
        user_doc = db.collection('users').document(firebase_user_id).get()
        user_data = user_doc.to_dict()
        basiq_user_id = user_data.get('basiq_user_id')
        
        if not basiq_user_id:
            return jsonify({
                'success': False,
                'error': 'No banking connection found'
            }), 400
        
        # Get recent transactions
        transaction_result = get_user_transactions(basiq_user_id)
        if not transaction_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'Failed to retrieve transactions'
            }), 500
            
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
        return jsonify({'success': False, 'error': str(e)}), 500

# API endpoint for financial insights
@app.route('/api/financial/insights', methods=['GET'])
@login_required
def get_financial_insights():
    """
    Get AI-powered financial insights based on user's transactions
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'Failed to get transactions',
                'details': transactions_result.get('error')
            }), 400
        
        # Get user profile
        user_profile = None
        if db:
            try:
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists:
                    user_profile = user_doc.to_dict()
            except Exception as e:
                print(f"Error fetching user profile: {e}")
        
        # Analyze transactions with Claude 3.7
        insights = analyze_transactions(
            transactions_result.get('transactions', {}).get('data', []),
            user_profile
        )
        
        if insights.get('error'):
            return jsonify({
                'success': False,
                'error': 'Failed to analyze transactions',
                'details': insights.get('error')
            }), 500
        
        return jsonify({
            'success': True,
            'insights': insights
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API endpoint for tax deductions
@app.route('/api/financial/tax-deductions', methods=['GET'])
@login_required
def get_tax_deductions():
    """
    Get potential tax deductions based on user's transactions and receipts
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'Failed to get transactions',
                'details': transactions_result.get('error')
            }), 400
        
        # Get user's receipts
        receipts = []
        if db:
            try:
                receipts_ref = db.collection('users').document(user_id).collection('receipts')
                receipts_docs = receipts_ref.get()
                for doc in receipts_docs:
                    receipt = doc.to_dict()
                    receipt['id'] = doc.id
                    receipts.append(receipt)
            except Exception as e:
                print(f"Error fetching receipts: {e}")
        
        # Identify tax deductions with Claude 3.7
        deductions = identify_tax_deductions(
            transactions_result.get('transactions', {}).get('data', []),
            receipts
        )
        
        if isinstance(deductions, dict) and deductions.get('error'):
            return jsonify({
                'success': False,
                'error': 'Failed to identify tax deductions',
                'details': deductions.get('error')
            }), 500
        
        return jsonify({
            'success': True,
            'deductions': deductions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API endpoint for financial reports
@app.route('/api/financial/reports', methods=['GET'])
@login_required
def get_financial_report():
    """
    Generate a comprehensive financial report
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get time period from request
        time_period = request.args.get('period', 'monthly')
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'Failed to get transactions',
                'details': transactions_result.get('error')
            }), 400
        
        # Generate financial report with Claude 3.7
        report = generate_financial_report(
            user_id,
            transactions_result.get('transactions', {}).get('data', []),
            time_period
        )
        
        if report.get('error'):
            return jsonify({
                'success': False,
                'error': 'Failed to generate financial report',
                'details': report.get('error')
            }), 500
        
        return jsonify({
            'success': True,
            'report': report
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API endpoint for financial goals
@app.route('/api/financial/goals', methods=['GET'])
@login_required
def get_financial_goals():
    """
    Get AI-suggested financial goals based on user's transactions
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'Failed to get transactions',
                'details': transactions_result.get('error')
            }), 400
        
        # Generate financial goals with Claude 3.7
        goals = suggest_financial_goals(
            user_id,
            transactions_result.get('transactions', {}).get('data', [])
        )
        
        if isinstance(goals, dict) and goals.get('error'):
            return jsonify({
                'success': False,
                'error': 'Failed to suggest financial goals',
                'details': goals.get('error')
            }), 500
        
        return jsonify({
            'success': True,
            'goals': goals
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Route to serve firebase-config.js from the root URL
@app.route('/firebase-config.js')
def serve_firebase_config():
    """
    Serve firebase-config.js from the frontend directory to fix 404 errors
    """
    return send_from_directory(app.static_folder, 'firebase-config.js')

# Add a catch-all route for frontend files
@app.route('/<path:filename>')
def serve_static(filename):
    """
    Serve static files from the frontend directory
    """
    return send_from_directory(app.static_folder, filename)

# --- New FormX.AI Receipt Upload Route --- #
# @app.route('/api/receipts/upload/formx', methods=['POST'])
# def upload_receipt_formx():
#     temp_file_path = None

#     try:
#         # Check for uploaded file
#         if 'receipt' in request.files:
#             file = request.files['receipt']
#             if file.filename == '':
#                 return jsonify({'success': False, 'error': 'No selected file'}), 400

#             filename = secure_filename(file.filename)
#             temp_file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
#             file.save(temp_file_path)
#             print(f"File uploaded: {temp_file_path}")

#         # Check for URL if file is not present
#         elif 'url' in request.form:
#             url = request.form['url']
#             if not url:
#                 return jsonify({'success': False, 'error': 'Empty URL provided'}), 400

#             response = requests.get(url, stream=True)
#             if response.status_code != 200:
#                 return jsonify({'success': False, 'error': 'Failed to fetch image from URL'}), 400

#             content_type = response.headers.get('Content-Type', 'image/jpeg')
#             extension = mimetypes.guess_extension(content_type) or '.jpg'

#             with tempfile.NamedTemporaryFile(delete=False, suffix=extension, dir=app.config['UPLOAD_FOLDER']) as tmp:
#                 for chunk in response.iter_content(chunk_size=1024):
#                     if chunk:
#                         tmp.write(chunk)
#                 temp_file_path = tmp.name
#                 print(f"Downloaded file from URL: {temp_file_path}")

#         else:
#             return jsonify({'success': False, 'error': 'No receipt file or URL provided'}), 400

#         # Process the file
#         extracted_data = extract_data_from_image(temp_file_path)
#         return jsonify({'success': True, 'data': extracted_data})

#     except Exception as e:
#         print(f"Error during receipt processing: {e}")
#         return jsonify({'success': False, 'error': str(e)}), 500



# --- New gemini Image Upload Route --- #
@app.route('/api/receipts/upload/gemini', methods=['POST'])
def upload_receipt_form():
    temp_file_path = None

    try:
        # Handle uploaded file
        if 'receipt' in request.files:
            file = request.files['receipt']
            if file.filename == '':
                return jsonify({'success': False, 'error': 'No selected file'}), 400

            filename = secure_filename(file.filename)
            temp_file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(temp_file_path)
            print(f"📥 File uploaded: {temp_file_path}")

        # Handle URL fallback
        elif 'url' in request.form:
            url = request.form['url']
            if not url:
                return jsonify({'success': False, 'error': 'Empty URL provided'}), 400

            response = requests.get(url, stream=True)
            if response.status_code != 200:
                return jsonify({'success': False, 'error': 'Failed to fetch image from URL'}), 400

            content_type = response.headers.get('Content-Type', 'image/jpeg')
            extension = mimetypes.guess_extension(content_type) or '.jpg'

            with tempfile.NamedTemporaryFile(delete=False, suffix=extension, dir=app.config['UPLOAD_FOLDER']) as tmp:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        tmp.write(chunk)
                temp_file_path = tmp.name
                print(f"🌐 Image downloaded: {temp_file_path}")

        else:
            return jsonify({'success': False, 'error': 'No receipt file or URL provided'}), 400

        # 🧠 Process image using Gemini
        extracted_data = extract_data_from_image_with_gemini(temp_file_path)
        return jsonify({'success': True, 'data': extracted_data})

    except Exception as e:
        print(f"❌ Error during receipt processing: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

    finally:
        # 🧹 Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                print(f"🧽 Temporary file deleted: {temp_file_path}")
            except Exception as e:
                print(f"⚠️ Error deleting temp file: {e}")


if __name__ == "__main__":
    port = int(os.environ.get('FLASK_RUN_PORT', 8080))
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    app.run(debug=True, host=host, port=port, threaded=True)