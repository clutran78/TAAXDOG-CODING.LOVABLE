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


class Budget:
    """
    Budget model representing a user's budget plan and predictions.
    
    This model stores budget predictions, spending limits, and target savings
    generated by the AI budget prediction system.
    """
    def __init__(self, budget_id, user_id, name, created_at, updated_at,
                 monthly_budget=None, target_savings=None, monthly_income=None,
                 predictions=None, category_limits=None, confidence_score=None,
                 analysis_period=None, prediction_period=None, status='active',
                 notes=None):
        self.budget_id = budget_id  # Unique budget identifier
        self.user_id = user_id  # Firebase Auth UID
        self.name = name  # Budget plan name (e.g., "January 2025 Budget")
        self.created_at = created_at  # When budget was created
        self.updated_at = updated_at  # Last update timestamp
        self.monthly_budget = monthly_budget  # Total monthly budget amount
        self.target_savings = target_savings  # Monthly savings target
        self.monthly_income = monthly_income  # User's monthly income
        self.predictions = predictions or {}  # AI predictions by month
        self.category_limits = category_limits or {}  # Spending limits by category
        self.confidence_score = confidence_score  # AI prediction confidence (0-1)
        self.analysis_period = analysis_period  # Period used for analysis
        self.prediction_period = prediction_period  # Prediction timeframe
        self.status = status  # active, archived, draft
        self.notes = notes  # User notes about the budget
    
    def to_dict(self):
        """Convert the Budget object to a dictionary for Firestore storage."""
        return {
            'budget_id': self.budget_id,
            'user_id': self.user_id,
            'name': self.name,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'monthly_budget': self.monthly_budget,
            'target_savings': self.target_savings,
            'monthly_income': self.monthly_income,
            'predictions': self.predictions,
            'category_limits': self.category_limits,
            'confidence_score': self.confidence_score,
            'analysis_period': self.analysis_period,
            'prediction_period': self.prediction_period,
            'status': self.status,
            'notes': self.notes
        }
    
    @staticmethod
    def from_dict(data):
        """Create a Budget object from a Firestore document."""
        return Budget(
            budget_id=data.get('budget_id'),
            user_id=data.get('user_id'),
            name=data.get('name'),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            monthly_budget=data.get('monthly_budget'),
            target_savings=data.get('target_savings'),
            monthly_income=data.get('monthly_income'),
            predictions=data.get('predictions'),
            category_limits=data.get('category_limits'),
            confidence_score=data.get('confidence_score'),
            analysis_period=data.get('analysis_period'),
            prediction_period=data.get('prediction_period'),
            status=data.get('status', 'active'),
            notes=data.get('notes')
        )


class BudgetTracking:
    """
    Budget tracking model to monitor actual spending vs budget predictions.
    
    This model tracks how well users are sticking to their budget and
    provides data for improving future predictions.
    """
    def __init__(self, tracking_id, budget_id, user_id, month, year,
                 predicted_amount, actual_amount, category=None, 
                 variance=None, created_at=None):
        self.tracking_id = tracking_id  # Unique tracking record ID
        self.budget_id = budget_id  # Associated budget ID
        self.user_id = user_id  # Firebase Auth UID
        self.month = month  # Month being tracked (1-12)
        self.year = year  # Year being tracked
        self.predicted_amount = predicted_amount  # AI predicted amount
        self.actual_amount = actual_amount  # Actual spending amount
        self.category = category  # Spending category (optional)
        self.variance = variance  # Difference between predicted and actual
        self.created_at = created_at  # When tracking record was created
    
    def to_dict(self):
        """Convert the BudgetTracking object to a dictionary for Firestore storage."""
        return {
            'tracking_id': self.tracking_id,
            'budget_id': self.budget_id,
            'user_id': self.user_id,
            'month': self.month,
            'year': self.year,
            'predicted_amount': self.predicted_amount,
            'actual_amount': self.actual_amount,
            'category': self.category,
            'variance': self.variance,
            'created_at': self.created_at
        }
    
    @staticmethod
    def from_dict(data):
        """Create a BudgetTracking object from a Firestore document."""
        return BudgetTracking(
            tracking_id=data.get('tracking_id'),
            budget_id=data.get('budget_id'),
            user_id=data.get('user_id'),
            month=data.get('month'),
            year=data.get('year'),
            predicted_amount=data.get('predicted_amount'),
            actual_amount=data.get('actual_amount'),
            category=data.get('category'),
            variance=data.get('variance'),
            created_at=data.get('created_at')
        )


class FinancialInsight:
    """
    Financial insight model representing AI-generated insights and recommendations.
    
    This model stores comprehensive financial analysis including:
    - Spending pattern insights
    - Tax deduction recommendations  
    - Personalized financial goals
    - Budget recommendations
    """
    
    def __init__(self, insight_id, user_id, insight_type, data, confidence_score=None,
                 title=None, description=None, recommendations=None, created_at=None,
                 updated_at=None, status='active', priority='medium'):
        self.insight_id = insight_id
        self.user_id = user_id  # Firebase Auth UID
        self.insight_type = insight_type  # 'spending_pattern', 'tax_deduction', 'goal', 'budget'
        self.data = data  # JSON data containing the insight details
        self.confidence_score = confidence_score  # Confidence level (0-1)
        self.title = title  # Human-readable title
        self.description = description  # Detailed description
        self.recommendations = recommendations  # List of actionable recommendations
        self.created_at = created_at
        self.updated_at = updated_at
        self.status = status  # 'active', 'archived', 'dismissed'
        self.priority = priority  # 'high', 'medium', 'low'
    
    def to_dict(self):
        """Convert the FinancialInsight object to a dictionary for Firestore storage."""
        return {
            'insight_id': self.insight_id,
            'user_id': self.user_id,
            'insight_type': self.insight_type,
            'data': self.data,
            'confidence_score': self.confidence_score,
            'title': self.title,
            'description': self.description,
            'recommendations': self.recommendations,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'status': self.status,
            'priority': self.priority
        }
    
    @staticmethod
    def from_dict(data):
        """Create a FinancialInsight object from a Firestore document."""
        return FinancialInsight(
            insight_id=data.get('insight_id'),
            user_id=data.get('user_id'),
            insight_type=data.get('insight_type'),
            data=data.get('data'),
            confidence_score=data.get('confidence_score'),
            title=data.get('title'),
            description=data.get('description'),
            recommendations=data.get('recommendations'),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            status=data.get('status', 'active'),
            priority=data.get('priority', 'medium')
        ) 