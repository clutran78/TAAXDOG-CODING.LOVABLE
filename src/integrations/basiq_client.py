import requests
import base64
import json
import os
from datetime import datetime, timedelta
from flask import current_app
from typing import List, Dict, Optional, Tuple
import logging
try:
    from fuzzywuzzy import fuzz
except ImportError:
    # Fallback if fuzzywuzzy is not available
    class MockFuzz:
        def ratio(self, a, b): return 0
        def partial_ratio(self, a, b): return 0
    fuzz = MockFuzz()
import re

# Configure logging
logger = logging.getLogger(__name__)

class BasiqClient:
    """
    Comprehensive BASIQ API client with environment switching capabilities.
    Supports development and production modes with automatic token management,
    transaction processing, and receipt matching.
    """
    
    def __init__(self, app=None):
        """
        Initialize BASIQ client with optional Flask app configuration.
        
        Args:
            app: Flask application instance (optional)
        """
        self.access_token = None
        self.token_expires = None
        self.app = app
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """
        Initialize the BASIQ client with Flask app configuration.
        
        Args:
            app: Flask application instance
        """
        self.app = app
        
        # Set default configuration
        app.config.setdefault('BASIQ_ENVIRONMENT', 'development')
        app.config.setdefault('BASIQ_BASE_URL_DEV', 'https://au-api.basiq.io')
        app.config.setdefault('BASIQ_BASE_URL_PROD', 'https://au-api.basiq.io')
        
        # Register the client with the app
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['basiq_client'] = self
    
    @property
    def api_key(self):
        """Get the appropriate API key based on current environment."""
        if self.app:
            env = self.app.config.get('BASIQ_ENVIRONMENT', 'development')
            if env == 'production':
                return self.app.config.get('BASIQ_API_KEY_PROD') or os.getenv('BASIQ_API_KEY_PROD')
            return self.app.config.get('BASIQ_API_KEY_DEV') or os.getenv('BASIQ_API_KEY_DEV')
        
        # Fallback to environment variables
        env = os.getenv('BASIQ_ENVIRONMENT', 'development')
        if env == 'production':
            return os.getenv('BASIQ_API_KEY_PROD')
        return os.getenv('BASIQ_API_KEY_DEV')
    
    @property
    def base_url(self):
        """Get the appropriate base URL based on current environment."""
        if self.app:
            env = self.app.config.get('BASIQ_ENVIRONMENT', 'development')
            if env == 'production':
                return self.app.config.get('BASIQ_BASE_URL_PROD')
            return self.app.config.get('BASIQ_BASE_URL_DEV')
        
        # Fallback to environment variables
        env = os.getenv('BASIQ_ENVIRONMENT', 'development')
        if env == 'production':
            return os.getenv('BASIQ_BASE_URL_PROD', 'https://au-api.basiq.io')
        return os.getenv('BASIQ_BASE_URL_DEV', 'https://au-api.basiq.io')
    
    @property
    def environment(self):
        """Get the current environment."""
        if self.app:
            return self.app.config.get('BASIQ_ENVIRONMENT', 'development')
        return os.getenv('BASIQ_ENVIRONMENT', 'development')
    
    def get_access_token(self):
        """
        Get a valid access token, refreshing if necessary.
        
        Returns:
            str: Access token or None if failed
        """
        # Check if current token is still valid
        if self.access_token and self.token_expires and datetime.now() < self.token_expires:
            return self.access_token
        
        # Request new token
        url = f"{self.base_url}/token"
        
        # Encode API key for basic auth
        if not self.api_key:
            logger.error("❌ BASIQ API key not configured")
            return None
            
        encoded_key = base64.b64encode(self.api_key.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {encoded_key}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'basiq-version': '3.0'
        }
        
        data = {
            'scope': 'SERVER_ACCESS',
            'grant_type': 'client_credentials'
        }
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data['access_token']
            
            # Set expiration with 5-minute buffer
            expires_in = token_data.get('expires_in', 3600)
            self.token_expires = datetime.now() + timedelta(seconds=expires_in - 300)
            
            logger.info(f"✅ BASIQ token acquired for {self.environment} environment")
            return self.access_token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get BASIQ access token: {str(e)}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response: {e.response.status_code} - {e.response.text}")
            return None
    
    def _get_headers(self, include_auth=True):
        """
        Get standard headers for BASIQ API requests.
        
        Args:
            include_auth: Whether to include authorization header
            
        Returns:
            dict: Headers dictionary
        """
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'basiq-version': '3.0'
        }
        
        if include_auth:
            token = self.get_access_token()
            if token:
                headers['Authorization'] = f'Bearer {token}'
        
        return headers
    
    # User Management Methods
    
    def create_basiq_user(self, user_data: Dict) -> Dict:
        """
        Create a new BASIQ user.
        
        Args:
            user_data: Dictionary containing user information
            
        Returns:
            dict: API response with user data or error information
        """
        url = f"{self.base_url}/users"
        headers = self._get_headers()
        
        # Clean payload - remove None values
        clean_data = {k: v for k, v in user_data.items() if v is not None}
        
        try:
            response = requests.post(url, headers=headers, json=clean_data)
            response.raise_for_status()
            
            user = response.json()
            logger.info(f"✅ Created BASIQ user: {user.get('id')}")
            
            return {
                'success': True,
                'user': user
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to create BASIQ user: {str(e)}")
            error_data = {}
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                except:
                    error_data = {'raw_response': e.response.text}
            
            return {
                'success': False,
                'error': str(e),
                'error_data': error_data
            }
    
    def get_user(self, user_id: str) -> Dict:
        """
        Get BASIQ user information.
        
        Args:
            user_id: BASIQ user ID
            
        Returns:
            dict: User information or error
        """
        url = f"{self.base_url}/users/{user_id}"
        headers = self._get_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            return {
                'success': True,
                'user': response.json()
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get BASIQ user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Institution and Connection Methods
    
    def get_supported_institutions(self) -> List[Dict]:
        """
        Get list of supported financial institutions.
        
        Returns:
            list: List of supported Australian institutions
        """
        url = f"{self.base_url}/institutions"
        headers = self._get_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            institutions = response.json()
            
            # Filter for Australian banks
            australian_banks = [
                inst for inst in institutions.get('data', [])
                if inst.get('country') == 'AU'
            ]
            
            logger.info(f"✅ Retrieved {len(australian_banks)} Australian institutions")
            return australian_banks
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get institutions: {str(e)}")
            return []
    
    def create_user_connection(self, user_id: str, institution_id: str) -> Dict:
        """
        Create a new bank connection for a user.
        
        Args:
            user_id: BASIQ user ID
            institution_id: Institution ID to connect to
            
        Returns:
            dict: Connection information
        """
        url = f"{self.base_url}/users/{user_id}/connections"
        headers = self._get_headers()
        
        data = {
            'loginId': institution_id,
            'password': 'password'  # This will be handled by BASIQ's secure flow
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            
            connection = response.json()
            logger.info(f"✅ Created connection {connection.get('id')} for user {user_id}")
            
            return {
                'success': True,
                'connection': connection
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to create connection: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def initiate_bank_connection(self, user_id: str, institution_id: str) -> Dict:
        """
        Initiate bank connection process for a user.
        
        Args:
            user_id: BASIQ user ID
            institution_id: Institution to connect to
            
        Returns:
            dict: Connection initiation response
        """
        # First ensure BASIQ user exists
        user_result = self.get_user(user_id)
        if not user_result.get('success'):
            # User doesn't exist, would need to create first
            return {
                'success': False,
                'error': 'BASIQ user not found. Please create user first.'
            }
        
        # Initiate connection
        connection = self.create_user_connection(user_id, institution_id)
        
        if connection.get('success'):
            conn_data = connection.get('connection', {})
            return {
                'connection_id': conn_data.get('id'),
                'status': conn_data.get('status'),
                'next_step': conn_data.get('steps', [{}])[0] if conn_data.get('steps') else None
            }
        
        return connection
    
    def get_user_connections(self, user_id: str) -> Dict:
        """
        Get all connections for a user.
        
        Args:
            user_id: BASIQ user ID
            
        Returns:
            dict: List of user connections
        """
        url = f"{self.base_url}/users/{user_id}/connections"
        headers = self._get_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            connections = response.json()
            logger.info(f"✅ Retrieved {len(connections.get('data', []))} connections for user {user_id}")
            
            return {
                'success': True,
                'connections': connections
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get connections for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Account Management Methods
    
    def get_user_accounts(self, user_id: str) -> Dict:
        """
        Get all accounts for a user across all connections.
        
        Args:
            user_id: BASIQ user ID
            
        Returns:
            dict: Account information
        """
        url = f"{self.base_url}/users/{user_id}/accounts"
        headers = self._get_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            accounts = response.json()
            logger.info(f"✅ Retrieved {len(accounts.get('data', []))} accounts for user {user_id}")
            
            return {
                'success': True,
                'accounts': accounts
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get accounts for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def sync_user_accounts(self, user_id: str) -> List[Dict]:
        """
        Synchronize and return formatted account information.
        
        Args:
            user_id: BASIQ user ID
            
        Returns:
            list: List of formatted account dictionaries
        """
        try:
            accounts_data = self.get_user_accounts(user_id)
            
            if not accounts_data.get('success'):
                logger.error(f"Failed to sync accounts for user {user_id}: {accounts_data.get('error')}")
                return []
            
            accounts = []
            for account in accounts_data.get('accounts', {}).get('data', []):
                account_info = {
                    'basiq_account_id': account['id'],
                    'account_name': account.get('name'),
                    'account_number': account.get('accountNo'),
                    'bsb': account.get('routingNo'),
                    'institution': account.get('institution', {}).get('name'),
                    'account_type': account.get('type'),
                    'balance': float(account.get('balance', 0)),
                    'available_funds': float(account.get('availableFunds', 0)),
                    'last_updated': datetime.now().isoformat()
                }
                accounts.append(account_info)
                
                # Save to database if available
                if hasattr(self, 'save_account_to_db'):
                    self.save_account_to_db(user_id, account_info)
            
            logger.info(f"✅ Synced {len(accounts)} accounts for user {user_id}")
            return accounts
            
        except Exception as e:
            logger.error(f"❌ Failed to sync accounts for user {user_id}: {str(e)}")
            return []
    
    # Transaction Methods
    
    def get_account_transactions(self, user_id: str, account_id: str, 
                               from_date: Optional[str] = None, 
                               to_date: Optional[str] = None) -> Dict:
        """
        Get transactions for a specific account.
        
        Args:
            user_id: BASIQ user ID
            account_id: Account ID
            from_date: Start date (YYYY-MM-DD format)
            to_date: End date (YYYY-MM-DD format)
            
        Returns:
            dict: Transaction data
        """
        url = f"{self.base_url}/users/{user_id}/accounts/{account_id}/transactions"
        headers = self._get_headers()
        
        params = {}
        if from_date:
            params['filter.transaction.postDate.from'] = from_date
        if to_date:
            params['filter.transaction.postDate.to'] = to_date
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            transactions = response.json()
            return {
                'success': True,
                'transactions': transactions
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get transactions for account {account_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_user_transactions(self, user_id: str, filter_str: Optional[str] = None) -> Dict:
        """
        Get all transactions for a user.
        
        Args:
            user_id: BASIQ user ID
            filter_str: Optional filter string
            
        Returns:
            dict: Transaction data
        """
        url = f"{self.base_url}/users/{user_id}/transactions"
        headers = self._get_headers()
        
        params = {}
        if filter_str:
            params['filter'] = filter_str
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            transactions = response.json()
            return {
                'success': True,
                'transactions': transactions
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get transactions for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def import_transactions(self, user_id: str, days_back: int = 30) -> List[Dict]:
        """
        Import and process transactions for a user.
        
        Args:
            user_id: BASIQ user ID
            days_back: Number of days to look back for transactions
            
        Returns:
            list: List of processed transactions
        """
        from_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        to_date = datetime.now().strftime('%Y-%m-%d')
        
        # Get user accounts first
        accounts_result = self.get_user_accounts(user_id)
        if not accounts_result.get('success'):
            logger.error(f"Failed to get accounts for transaction import: {accounts_result.get('error')}")
            return []
        
        all_transactions = []
        accounts = accounts_result.get('accounts', {}).get('data', [])
        
        for account in accounts:
            account_id = account['id']
            
            # Get transactions for this account
            transactions_result = self.get_account_transactions(
                user_id, account_id, from_date, to_date
            )
            
            if transactions_result.get('success'):
                for transaction in transactions_result.get('transactions', {}).get('data', []):
                    transaction_data = {
                        'basiq_transaction_id': transaction['id'],
                        'account_id': account_id,
                        'amount': float(transaction['amount']),
                        'description': transaction['description'],
                        'date': transaction['postDate'],
                        'merchant': transaction.get('merchant', {}).get('businessName'),
                        'category': transaction.get('class', {}).get('title'),
                        'status': transaction['status'],
                        'processed_at': datetime.now().isoformat()
                    }
                    all_transactions.append(transaction_data)
                    
                    # Save to database and attempt receipt matching
                    if hasattr(self, 'save_transaction_to_db'):
                        self.save_transaction_to_db(user_id, transaction_data)
                    
                    # Try to match with receipts
                    self.match_transaction_with_receipts(user_id, transaction_data)
        
        logger.info(f"✅ Imported {len(all_transactions)} transactions for user {user_id}")
        return all_transactions
    
    # Receipt Matching Methods
    
    def calculate_match_score(self, transaction: Dict, receipt: Dict) -> float:
        """
        Calculate similarity score between a transaction and receipt.
        
        Args:
            transaction: Transaction data
            receipt: Receipt data
            
        Returns:
            float: Similarity score (0.0 to 1.0)
        """
        score = 0.0
        weight_total = 0.0
        
        # Amount matching (40% weight)
        amount_weight = 0.4
        transaction_amount = abs(float(transaction.get('amount', 0)))
        receipt_amount = float(receipt.get('total_amount', 0))
        
        if receipt_amount > 0:
            amount_diff = abs(transaction_amount - receipt_amount)
            amount_score = max(0, 1 - (amount_diff / max(transaction_amount, receipt_amount)))
            score += amount_score * amount_weight
            weight_total += amount_weight
        
        # Date matching (30% weight)
        date_weight = 0.3
        try:
            transaction_date = datetime.strptime(transaction.get('date', ''), '%Y-%m-%d').date()
            receipt_date = datetime.strptime(receipt.get('date', ''), '%Y-%m-%d').date()
            
            date_diff = abs((transaction_date - receipt_date).days)
            if date_diff <= 3:  # Within 3 days
                date_score = max(0, 1 - (date_diff / 3))
                score += date_score * date_weight
                weight_total += date_weight
        except:
            pass
        
        # Merchant/description matching (30% weight)
        merchant_weight = 0.3
        transaction_desc = transaction.get('description', '').lower()
        transaction_merchant = transaction.get('merchant', '').lower()
        receipt_merchant = receipt.get('merchant_name', '').lower()
        
        if receipt_merchant and (transaction_merchant or transaction_desc):
            # Use fuzzy matching for merchant names
            desc_score = fuzz.partial_ratio(transaction_desc, receipt_merchant) / 100
            merchant_score = 0
            if transaction_merchant:
                merchant_score = fuzz.ratio(transaction_merchant, receipt_merchant) / 100
            
            best_merchant_score = max(desc_score, merchant_score)
            score += best_merchant_score * merchant_weight
            weight_total += merchant_weight
        
        # Return normalized score
        return score / weight_total if weight_total > 0 else 0.0
    
    def match_transaction_with_receipts(self, user_id: str, transaction: Dict) -> bool:
        """
        Attempt to match a transaction with existing receipts.
        
        Args:
            user_id: User ID
            transaction: Transaction data
            
        Returns:
            bool: True if match found and linked
        """
        try:
            # This would require database integration
            # For now, return a placeholder implementation
            
            amount = abs(float(transaction.get('amount', 0)))
            transaction_date = datetime.strptime(transaction.get('date', ''), '%Y-%m-%d').date()
            
            # In a real implementation, you would:
            # 1. Query receipts from database within amount and date range
            # 2. Calculate match scores for each potential receipt
            # 3. Link the best match if score > threshold
            
            logger.info(f"🔍 Attempting to match transaction {transaction.get('basiq_transaction_id')} "
                       f"(${amount} on {transaction_date})")
            
            # Placeholder for actual database matching logic
            return False
            
        except Exception as e:
            logger.error(f"❌ Error matching transaction with receipts: {str(e)}")
            return False
    
    # Connection Management
    
    def refresh_connection(self, user_id: str, connection_id: str) -> Dict:
        """
        Refresh a connection to update account and transaction data.
        
        Args:
            user_id: BASIQ user ID
            connection_id: Connection ID to refresh
            
        Returns:
            dict: Refresh job information
        """
        url = f"{self.base_url}/users/{user_id}/connections/{connection_id}/refresh"
        headers = self._get_headers()
        
        try:
            response = requests.post(url, headers=headers)
            response.raise_for_status()
            
            job = response.json()
            logger.info(f"✅ Refreshed connection {connection_id} for user {user_id}")
            
            return {
                'success': True,
                'job': job
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to refresh connection {connection_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_connection(self, user_id: str, connection_id: str) -> Dict:
        """
        Delete a bank connection.
        
        Args:
            user_id: BASIQ user ID
            connection_id: Connection ID to delete
            
        Returns:
            dict: Deletion result
        """
        url = f"{self.base_url}/users/{user_id}/connections/{connection_id}"
        headers = self._get_headers()
        
        try:
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
            
            logger.info(f"✅ Deleted connection {connection_id} for user {user_id}")
            
            return {
                'success': True,
                'message': 'Connection deleted successfully'
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to delete connection {connection_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Environment Management
    
    def switch_environment(self, new_environment: str) -> Dict:
        """
        Switch between development and production environments.
        
        Args:
            new_environment: 'development' or 'production'
            
        Returns:
            dict: Switch operation result
        """
        if new_environment not in ['development', 'production']:
            return {
                'success': False,
                'error': 'Invalid environment. Must be "development" or "production"'
            }
        
        try:
            # Update app config if available
            if self.app:
                self.app.config['BASIQ_ENVIRONMENT'] = new_environment
            
            # Update environment variable
            os.environ['BASIQ_ENVIRONMENT'] = new_environment
            
            # Clear cached token to force refresh with new environment
            self.access_token = None
            self.token_expires = None
            
            logger.info(f"✅ Switched BASIQ environment to {new_environment}")
            
            return {
                'success': True,
                'environment': new_environment,
                'api_endpoint': self.base_url,
                'message': f'Switched to {new_environment} environment'
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to switch environment: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_environment_status(self) -> Dict:
        """
        Get current environment status and configuration.
        
        Returns:
            dict: Environment status information
        """
        return {
            'current_environment': self.environment,
            'api_endpoint': self.base_url,
            'api_key_configured': bool(self.api_key),
            'api_key_preview': self.api_key[:10] + '...' if self.api_key else None,
            'token_cached': bool(self.access_token),
            'token_expires': self.token_expires.isoformat() if self.token_expires else None
        }
    
    # ==================== SUBACCOUNT MANAGEMENT METHODS ====================
    
    def check_subaccount_support(self, institution_id: str) -> Dict:
        """
        Check if an institution supports subaccount creation.
        
        Args:
            institution_id: Institution ID to check
            
        Returns:
            dict: Support information
        """
        try:
            # For now, no Australian banks support subaccount creation via API
            # This is a placeholder for future bank API integration
            
            # Get institution details
            institutions = self.get_supported_institutions()
            institution = next((inst for inst in institutions if inst['id'] == institution_id), None)
            
            if not institution:
                return {
                    'supported': False,
                    'features': [],
                    'error': 'Institution not found'
                }
            
            # Currently, all institutions are treated as virtual subaccount only
            return {
                'supported': False,
                'features': [],
                'institution_name': institution.get('name', 'Unknown'),
                'virtual_subaccount_available': True,
                'real_subaccount_available': False,
                'reason': 'Bank API subaccount creation not yet supported by Australian banks'
            }
            
        except Exception as e:
            logger.error(f"❌ Error checking subaccount support for {institution_id}: {str(e)}")
            return {
                'supported': False,
                'features': [],
                'error': str(e)
            }
    
    def create_subaccount(self, user_id: str, account_id: str, subaccount_data: Dict) -> Dict:
        """
        Create a subaccount (placeholder for future implementation).
        
        Args:
            user_id: BASIQ user ID
            account_id: Parent account ID
            subaccount_data: Subaccount configuration
            
        Returns:
            dict: Creation result (currently always virtual)
        """
        try:
            # This is a placeholder for future bank API integration
            # For now, all subaccounts are virtual and managed by TAAXDOG
            
            logger.info(f"🏦 Virtual subaccount creation requested for account {account_id}")
            
            return {
                'success': False,
                'is_virtual': True,
                'reason': 'Bank subaccount creation not supported. Using virtual subaccount tracking.',
                'virtual_subaccount_id': None,  # Will be generated by subaccount_manager
                'bank_subaccount_id': None,
                'institution_support': self.check_subaccount_support(account_id)
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating subaccount: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'is_virtual': True
            }
    
    def get_subaccount_balance(self, user_id: str, subaccount_id: str) -> Dict:
        """
        Get balance for a real bank subaccount (placeholder).
        
        Args:
            user_id: BASIQ user ID
            subaccount_id: Bank subaccount ID
            
        Returns:
            dict: Balance information
        """
        try:
            # Placeholder for future bank subaccount balance retrieval
            logger.info(f"🏦 Bank subaccount balance check requested for {subaccount_id}")
            
            return {
                'success': False,
                'reason': 'Bank subaccount balance retrieval not yet implemented',
                'virtual_only': True
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting subaccount balance: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def sync_subaccount_transactions(self, user_id: str, subaccount_id: str) -> Dict:
        """
        Sync transactions for a real bank subaccount (placeholder).
        
        Args:
            user_id: BASIQ user ID
            subaccount_id: Bank subaccount ID
            
        Returns:
            dict: Sync result
        """
        try:
            # Placeholder for future bank subaccount transaction sync
            logger.info(f"🏦 Subaccount transaction sync requested for {subaccount_id}")
            
            return {
                'success': False,
                'reason': 'Bank subaccount transaction sync not yet implemented',
                'virtual_only': True,
                'transactions': []
            }
            
        except Exception as e:
            logger.error(f"❌ Error syncing subaccount transactions: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def transfer_to_subaccount(self, user_id: str, from_account_id: str, 
                              to_subaccount_id: str, amount: float, description: str = None) -> Dict:
        """
        Transfer funds to a subaccount (placeholder for future implementation).
        
        Args:
            user_id: BASIQ user ID
            from_account_id: Source account ID
            to_subaccount_id: Target subaccount ID
            amount: Transfer amount
            description: Transfer description
            
        Returns:
            dict: Transfer result
        """
        try:
            # This would require bank API support for transfers
            # For now, all transfers are handled virtually by TAAXDOG
            
            logger.info(f"🏦 Bank transfer requested: ${amount} from {from_account_id} to subaccount {to_subaccount_id}")
            
            return {
                'success': False,
                'reason': 'Bank-initiated transfers not yet supported. Use virtual transfers.',
                'virtual_transfer_recommended': True,
                'amount': amount,
                'description': description or f'Transfer to subaccount {to_subaccount_id}'
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing bank transfer: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def close_subaccount(self, user_id: str, subaccount_id: str, reason: str = None) -> Dict:
        """
        Close a bank subaccount (placeholder for future implementation).
        
        Args:
            user_id: BASIQ user ID
            subaccount_id: Bank subaccount ID to close
            reason: Closure reason
            
        Returns:
            dict: Closure result
        """
        try:
            # Placeholder for future bank subaccount closure
            logger.info(f"🏦 Bank subaccount closure requested for {subaccount_id}")
            
            return {
                'success': False,
                'reason': 'Bank subaccount closure not yet implemented',
                'virtual_only': True,
                'closure_reason': reason
            }
            
        except Exception as e:
            logger.error(f"❌ Error closing subaccount: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_institution_subaccount_features(self, institution_id: str) -> Dict:
        """
        Get available subaccount features for an institution.
        
        Args:
            institution_id: Institution ID
            
        Returns:
            dict: Available features
        """
        try:
            support_info = self.check_subaccount_support(institution_id)
            
            # Define what features would be available when bank APIs support subaccounts
            potential_features = {
                'real_time_balance': False,
                'automatic_transfers': False,
                'interest_calculation': False,
                'transaction_categorization': False,
                'spending_limits': False,
                'notifications': False,
                'virtual_subaccounts': True  # Always available through TAAXDOG
            }
            
            return {
                'institution_id': institution_id,
                'institution_name': support_info.get('institution_name', 'Unknown'),
                'supported_features': potential_features,
                'real_subaccount_supported': support_info.get('real_subaccount_available', False),
                'virtual_subaccount_supported': support_info.get('virtual_subaccount_available', True),
                'notes': 'Virtual subaccounts are fully supported through TAAXDOG platform'
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting institution features for {institution_id}: {str(e)}")
            return {
                'institution_id': institution_id,
                'supported_features': {'virtual_subaccounts': True},
                'error': str(e)
            }


# Global client instance
basiq_client = BasiqClient()

def init_basiq_client(app):
    """
    Initialize BASIQ client with Flask app.
    
    Args:
        app: Flask application instance
    """
    basiq_client.init_app(app)
    return basiq_client 