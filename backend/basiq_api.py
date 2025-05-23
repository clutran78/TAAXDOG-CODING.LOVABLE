import os
import requests
import json
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
import logging

# Load environment variables
load_dotenv()

# Basiq API base URL and configuration
BASIQ_API_URL = os.environ.get('BASIQ_SERVER_URL', 'https://au-api.basiq.io')
BASIQ_API_KEY = os.environ.get('BASIQ_API_KEY', 'MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjRkNzI4M2VhLTViYTMtNGJlMi04ZGJlLTAwMGQ5ODhhMzZiOQ') 

# Token cache to avoid requesting new tokens unnecessarily
token_cache = {
    'access_token': None,
    'expires_at': None
}

logger = logging.getLogger(__name__)

def get_auth_token():
    """
    Get an authentication token from Basiq API.
    The token is cached and only refreshed when expired.
    
    Returns:
        str: The access token
    """
    global token_cache
    
    # Check if we have a valid cached token
    now = datetime.now()
    if token_cache['access_token'] and token_cache['expires_at'] and now < token_cache['expires_at']:
        return token_cache['access_token']
    
    # Request a new token
    url = f"{BASIQ_API_URL}/token"
    headers = {
        'Authorization': f'Basic {BASIQ_API_KEY}',
        'Content-Type': 'application/x-www-form-urlencoded',
        'basiq-version': '3.0'
    }
    data = {
        'scope': 'SERVER_ACCESS'
    }
    
    try:
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()  # Raise exception for non-200 responses
        
        token_data = response.json()
        
        # Cache the token with expiration (subtract 5 minutes for safety)
        token_cache['access_token'] = token_data['access_token']
        expires_in_seconds = token_data.get('expires_in', 3600)  # Default to 1 hour if not specified
        token_cache['expires_at'] = now + timedelta(seconds=expires_in_seconds - 300)
        
        return token_cache['access_token']
    except requests.exceptions.RequestException as e:
        print(f"Error getting auth token: {e}")
        return None


cached_token = None
token_expiry = None

def get_auth_token():
    global cached_token, token_expiry
    if cached_token and token_expiry and token_expiry > datetime.utcnow():
        return cached_token

    # Fetch new token
    response = requests.post(
        f'{BASIQ_SERVER_URL}/token',
        headers={'Authorization': f'Basic {BASIQ_API_KEY}'},
        data={'scope': 'SERVER_ACCESS', 'grant_type': 'client_credentials'}
    )

    if response.status_code == 200:
        token_data = response.json()
        cached_token = token_data['access_token']
        token_expiry = datetime.utcnow() + timedelta(seconds=int(token_data['expires_in']))
        return cached_token
    else:
        raise Exception(f"Token request failed: {response.status_code} - {response.text}")

def get_headers():
    return {
        'Authorization': f'Basic {BASIQ_API_KEY}',
        'Content-Type': 'application/json'
    }

def get_basiq_token():
    global cached_token, token_expiry

    if cached_token and token_expiry and token_expiry > datetime.utcnow():
        return cached_token

    headers = {
        "Authorization": f"Basic {BASIQ_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded",
        "basiq-version": "3.0"
    }

    data = "grant_type=client_credentials&scope=SERVER_ACCESS"

    try:
        response = requests.post(f"{BASIQ_API_URL}/token", headers=headers, data=data)
        response.raise_for_status()

        token_data = response.json()
        cached_token = token_data["access_token"]
        token_expiry = datetime.utcnow() + timedelta(seconds=int(token_data["expires_in"]))
        print("✅ Basiq token acquired.")
        return cached_token

    except requests.exceptions.RequestException as e:
        print("❌ Failed to get Basiq token:", e)
        if e.response is not None:
            print("📄 Response:", e.response.status_code, e.response.text)
        return None


def create_basiq_user(email, mobile=None, name=None, business_name=None,
                      business_id=None, business_id_type=None,
                      verification_status=True, verification_date=None,
                      business_address=None):
    token = get_basiq_token()
    if not token:
        return {
            'success': False,
            'error': 'Failed to get Basiq access token'
        }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "basiq-version": "3.0"
    }

    # Default address if none provided
    if not business_address:
        business_address = {
            "addressLine1": "21 Sydney Rd",
            "suburb": "Manly",
            "state": "NSW",
            "postcode": "2095",
            "countryCode": "AUS"
        }

    # Build final payload
    payload = {
        "email": email,
        "mobile": mobile,
        "firstName": name.split(" ")[0] if name else None,
        "lastName": name.split(" ")[1] if name and " " in name else None,
        "businessName": business_name,
        "businessIdNo": business_id,
        "businessIdNoType": business_id_type,
        "verificationStatus": verification_status,
        "verificationDate": verification_date,
        "businessAddress": business_address
    }

    # Remove any None values (clean payload)
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        response = requests.post(f"{BASIQ_API_URL}/users", headers=headers, json=payload)
        response.raise_for_status()
        return {
            'success': True,
            'user': response.json()
        }
    except requests.exceptions.HTTPError as e:
        error_data = {}
        raw_text = ""
        if e.response is not None:
            try:
                error_data = e.response.json()
            except ValueError:
                raw_text = e.response.text

        return {
            'success': False,
            'status_code': e.response.status_code,
            'error': str(e),
            'error_data': error_data,
            'raw_response': raw_text
        }

    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_basiq_user(user_id):
    """
    Retrieve a user from the Basiq system.
    
    Args:
        user_id (str): Basiq user ID
        
    Returns:
        dict: User data on success, or error info
    """
    url = f"{BASIQ_API_URL}/users/{user_id}"
    headers = get_headers()
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'user': response.json()
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }

def create_auth_link(user_id, mobile=True):
    """
    Create an authentication link for connecting bank accounts.
    
    Args:
        user_id (str): Basiq user ID
        mobile (bool): Whether the link is for mobile use
        
    Returns:
        dict: Auth link data on success, or error info
    """
    

    token = get_basiq_token()

    if not token:
        return {
            'success': False,
            'error': 'Failed to get Basiq access token'
        }

    url = f"{BASIQ_API_URL}/users/{user_id}/auth_link"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "basiq-version": "3.0"
    }

    # headers = get_headers()
    
    payload = {
      "type": "link",
      "options": {
          "mobile": mobile
    }
    }   
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return {
            'success': True,
            'auth_link': response.json()
        }
    except requests.exceptions.RequestException as e:
        error_data = {}
        try:
            error_data = e.response.json()
        except:
            pass
            
        return {
            'success': False,
            'error': str(e),
            'error_data': error_data
        }

def get_user_connections(user_id):
    """
    Get all connections for a user.
    
    Args:
        user_id (str): Basiq user ID
        
    Returns:
        dict: List of connections on success, or error info
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/connections"
    token = get_basiq_token()

    if not token:
        return {
            'success': False,
            'error': 'Failed to get Basiq access token'
        }

    url = f"{BASIQ_API_URL}/users/{user_id}/auth_link"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "basiq-version": "3.0"
    }

    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'connections': response.json()
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_user_accounts(user_id):
    """
    Get all accounts for a user across all their connections.
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/accounts"

    token = get_basiq_token()
    if not token:
        return {
            'success': False,
            'error': 'Failed to get Basiq access token'
        }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "basiq-version": "3.0"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        return {
            'success': True,
            'accounts': response.json()  # will contain "data": [...]
        }

    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }
def get_user_transactions(user_id, filter_str=None):
    """
    Get transactions for a user, with optional Basiq filter string.

    Args:
        user_id (str): Basiq user ID
        filter_str (str, optional): e.g. "account.id.eq('account-id')"

    Returns:
        dict: {
            success: True/False,
            transactions: JSON data on success or error on failure
        }
    """
    token = get_basiq_token()
    if not token:
        return {
            'success': False,
            'error': 'Failed to obtain Basiq access token'
        }

    base_url = f"{BASIQ_API_URL}/users/{user_id}/transactions"
    url = f"{base_url}?filter={filter_str}" if filter_str else base_url

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "basiq-version": "3.0"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        return {
            'success': True,
            'transactions': response.json()
        }

    except requests.exceptions.RequestException as e:
        # Log the response content for debugging if needed
        return {
            'success': False,
            'error': str(e)
        }

def refresh_connection(user_id, connection_id):
    """
    Refresh a specific connection to update account and transaction data.
    
    Args:
        user_id (str): Basiq user ID
        connection_id (str): Connection ID to refresh
        
    Returns:
        dict: Job information for the refresh on success, or error info
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/connections/{connection_id}/refresh"
    headers = get_headers()
    
    try:
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'job': response.json()
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }

def delete_connection(user_id, connection_id):
    """
    Delete a connection for a user.
    
    Args:
        user_id (str): Basiq user ID
        connection_id (str): Connection ID to delete
        
    Returns:
        dict: Success status and message
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/connections/{connection_id}"
    headers = get_headers()
    
    try:
        response = requests.delete(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'message': 'Connection deleted successfully'
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        } 