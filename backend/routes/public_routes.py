from flask import Blueprint, request, render_template, jsonify
import re
from .utils import api_error, logger

public_bp = Blueprint('public', __name__)

# Legacy route for tax information submission
@public_bp.route('/submit-tax-info', methods=['POST'])
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
            return api_error('Validation errors', status=400, details=errors)
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
    logger.info(f"Received tax information: {form_data}")
    
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