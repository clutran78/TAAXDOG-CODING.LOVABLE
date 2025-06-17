"""
Database models for the TAAXDOG application.

This module defines the data models used in the application, which will be stored in Firebase Firestore.
Since Firestore is a NoSQL database, these models serve as a reference for the expected structure
of the documents in the database.
"""

class User:
    """
    User model representing a registered user in the system.
    """
    def __init__(self, user_id, email, name=None, phone=None, created_at=None):
        self.user_id = user_id  # Firebase Auth UID
        self.email = email
        self.name = name
        self.phone = phone
        self.created_at = created_at
    
    def to_dict(self):
        """Convert the User object to a dictionary for Firestore storage."""
        return {
            'user_id': self.user_id,
            'email': self.email,
            'name': self.name,
            'phone': self.phone,
            'created_at': self.created_at
        }
    
    @staticmethod
    def from_dict(data):
        """Create a User object from a Firestore document."""
        return User(
            user_id=data.get('user_id'),
            email=data.get('email'),
            name=data.get('name'),
            phone=data.get('phone'),
            created_at=data.get('created_at')
        )


class BankAccount:
    """
    Bank account model representing a user's connected bank account via Basiq API.
    """
    def __init__(self, account_id, user_id, institution, account_name, account_number, 
                 bsb=None, balance=None, available_funds=None, account_type=None, 
                 connection_id=None, last_updated=None):
        self.account_id = account_id  # Basiq account ID
        self.user_id = user_id  # Firebase Auth UID
        self.institution = institution  # Bank name
        self.account_name = account_name
        self.account_number = account_number
        self.bsb = bsb  # Australian BSB number
        self.balance = balance
        self.available_funds = available_funds
        self.account_type = account_type  # e.g., savings, checking
        self.connection_id = connection_id  # Basiq connection ID
        self.last_updated = last_updated
    
    def to_dict(self):
        """Convert the BankAccount object to a dictionary for Firestore storage."""
        return {
            'account_id': self.account_id,
            'user_id': self.user_id,
            'institution': self.institution,
            'account_name': self.account_name,
            'account_number': self.account_number,
            'bsb': self.bsb,
            'balance': self.balance,
            'available_funds': self.available_funds,
            'account_type': self.account_type,
            'connection_id': self.connection_id,
            'last_updated': self.last_updated
        }
    
    @staticmethod
    def from_dict(data):
        """Create a BankAccount object from a Firestore document."""
        return BankAccount(
            account_id=data.get('account_id'),
            user_id=data.get('user_id'),
            institution=data.get('institution'),
            account_name=data.get('account_name'),
            account_number=data.get('account_number'),
            bsb=data.get('bsb'),
            balance=data.get('balance'),
            available_funds=data.get('available_funds'),
            account_type=data.get('account_type'),
            connection_id=data.get('connection_id'),
            last_updated=data.get('last_updated')
        )


class Transaction:
    """
    Transaction model representing a bank transaction from Basiq API.
    """
    def __init__(self, transaction_id, account_id, user_id, amount, description, 
                 date, category=None, merchant=None, receipt_id=None, 
                 tax_deductible=None, notes=None):
        self.transaction_id = transaction_id  # Basiq transaction ID
        self.account_id = account_id  # Basiq account ID
        self.user_id = user_id  # Firebase Auth UID
        self.amount = amount
        self.description = description
        self.date = date
        self.category = category
        self.merchant = merchant
        self.receipt_id = receipt_id  # ID of associated receipt, if any
        self.tax_deductible = tax_deductible  # Boolean or percentage
        self.notes = notes
    
    def to_dict(self):
        """Convert the Transaction object to a dictionary for Firestore storage."""
        return {
            'transaction_id': self.transaction_id,
            'account_id': self.account_id,
            'user_id': self.user_id,
            'amount': self.amount,
            'description': self.description,
            'date': self.date,
            'category': self.category,
            'merchant': self.merchant,
            'receipt_id': self.receipt_id,
            'tax_deductible': self.tax_deductible,
            'notes': self.notes
        }
    
    @staticmethod
    def from_dict(data):
        """Create a Transaction object from a Firestore document."""
        return Transaction(
            transaction_id=data.get('transaction_id'),
            account_id=data.get('account_id'),
            user_id=data.get('user_id'),
            amount=data.get('amount'),
            description=data.get('description'),
            date=data.get('date'),
            category=data.get('category'),
            merchant=data.get('merchant'),
            receipt_id=data.get('receipt_id'),
            tax_deductible=data.get('tax_deductible'),
            notes=data.get('notes')
        )


class Receipt:
    """
    Receipt model representing a scanned receipt via Gemini 2.0 Flash API.
    """
    def __init__(self, receipt_id, user_id, merchant, total_amount, date, 
                 items=None, tax_amount=None, image_url=None, transaction_id=None):
        self.receipt_id = receipt_id
        self.user_id = user_id  # Firebase Auth UID
        self.merchant = merchant
        self.total_amount = total_amount
        self.date = date
        self.items = items or []  # List of items on the receipt
        self.tax_amount = tax_amount
        self.image_url = image_url  # URL to the stored receipt image
        self.transaction_id = transaction_id  # ID of associated transaction, if any
    
    def to_dict(self):
        """Convert the Receipt object to a dictionary for Firestore storage."""
        return {
            'receipt_id': self.receipt_id,
            'user_id': self.user_id,
            'merchant': self.merchant,
            'total_amount': self.total_amount,
            'date': self.date,
            'items': self.items,
            'tax_amount': self.tax_amount,
            'image_url': self.image_url,
            'transaction_id': self.transaction_id
        }
    
    @staticmethod
    def from_dict(data):
        """Create a Receipt object from a Firestore document."""
        return Receipt(
            receipt_id=data.get('receipt_id'),
            user_id=data.get('user_id'),
            merchant=data.get('merchant'),
            total_amount=data.get('total_amount'),
            date=data.get('date'),
            items=data.get('items'),
            tax_amount=data.get('tax_amount'),
            image_url=data.get('image_url'),
            transaction_id=data.get('transaction_id')
        ) 