import os
import requests
import json
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Basiq API base URL and configuration
BASIQ_API_URL = os.environ.get('BASIQ_SERVER_URL', 'https://au-api.basiq.io')
BASIQ_API_KEY = os.environ.get('BASIQ_API_KEY')

# Token cache to avoid requesting new tokens unnecessarily
token_cache = {
    'access_token': None,
    'expires_at': None
}

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

def get_headers():
    """
    Get the headers required for Basiq API calls, including the auth token.
    
    Returns:
        dict: Headers dictionary
    """
    token = get_auth_token()
    if not token:
        raise Exception("Failed to get authentication token")
        
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'basiq-version': '3.0'
    }

def create_basiq_user(email, mobile=None, name=None):
    """
    Create a new user in the Basiq system.
    
    Args:
        email (str): User's email address
        mobile (str, optional): User's mobile number
        name (str, optional): User's full name
        
    Returns:
        dict: User data including Basiq user ID on success, or error info
    """
    url = f"{BASIQ_API_URL}/users"
    headers = get_headers()
    
    # Prepare user data
    user_data = {
        'email': email
    }
    
    if mobile:
        user_data['mobile'] = mobile
    
    if name:
        user_data['name'] = name
    
    try:
        response = requests.post(url, headers=headers, json=user_data)
        response.raise_for_status()
        return {
            'success': True,
            'user': response.json()
        }
    except requests.exceptions.HTTPError as e:
        # Handle specific error cases
        error_data = {}
        try:
            error_data = e.response.json()
        except:
            pass
        
        return {
            'success': False,
            'status_code': e.response.status_code,
            'error': str(e),
            'error_data': error_data
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
    url = f"{BASIQ_API_URL}/users/{user_id}/auth_link"
    headers = get_headers()
    
    data = {
        'mobile': mobile
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
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
    headers = get_headers()
    
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
    
    Args:
        user_id (str): Basiq user ID
        
    Returns:
        dict: List of accounts on success, or error info
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/accounts"
    headers = get_headers()
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'accounts': response.json()
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_user_transactions(user_id, filter_str=None):
    """
    Get transactions for a user, with optional filter.
    
    Args:
        user_id (str): Basiq user ID
        filter_str (str, optional): Filter string in Basiq format
        
    Returns:
        dict: List of transactions on success, or error info
    """
    url = f"{BASIQ_API_URL}/users/{user_id}/transactions"
    if filter_str:
        url += f"?filter={filter_str}"
        
    headers = get_headers()
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {
            'success': True,
            'transactions': response.json()
        }
    except requests.exceptions.RequestException as e:
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