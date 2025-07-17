"""
Integration Tests for Database Operations
=======================================

Tests receipt storage, retrieval, transaction matching, and PostgreSQL/Prisma integration.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List

from prisma import Prisma
from prisma.models import User, ReceiptStatus
from backend.routes.receipt_routes import match_receipt_with_transaction


@pytest.fixture
async def prisma_client():
    """Create a test Prisma client"""
    prisma = Prisma()
    await prisma.connect()
    yield prisma
    await prisma.disconnect()


@pytest.fixture
async def test_user(prisma_client: Prisma):
    """Create a test user for receipts"""
    user = await prisma_client.user.create(
        data={
            'email': 'test@example.com',
            'name': 'Test User',
            'role': 'USER',
            'taxResidency': 'RESIDENT'
        }
    )
    yield user
    # Cleanup
    await prisma_client.user.delete(where={'id': user.id})


@pytest.mark.asyncio
class TestDatabaseIntegration:
    """Test database integration functionality with Prisma"""
    
    async def setup_method(self, method):
        """Set up test database environment"""
        self.test_receipt_id = "test_receipt_456"
        
        # Sample receipt data for Prisma
        self.sample_receipt_data = {
            'merchant': 'OFFICEWORKS',
            'totalAmount': Decimal('118.50'),
            'gstAmount': Decimal('10.77'),
            'date': datetime(2024, 1, 15),
            'taxCategory': 'D5',
            'aiProcessed': True,
            'aiConfidence': Decimal('0.90'),
            'aiProvider': 'gemini',
            'aiModel': 'gemini-2.0-flash-enhanced',
            'processingStatus': ReceiptStatus.PROCESSED,
            'items': {
                'merchant_name': 'OFFICEWORKS',
                'total_amount': 118.50,
                'gst_amount': 10.77,
                'suggested_tax_category': 'D5',
                'confidence_score': 0.9
            }
        }
        
        # Sample transaction data
        self.sample_transactions = [
            {
                'id': 'txn_001',
                'account_id': 'acc_123',
                'amount': '-118.50',
                'description': 'EFTPOS OFFICEWORKS MELBOURNE',
                'postDate': '2024-01-15T14:30:00Z',
                'category': 'shopping'
            }
        ]
    
    async def test_receipt_storage(self, prisma_client: Prisma, test_user: User):
        """Test receipt data insertion into database"""
        # Create receipt data with user relationship
        receipt_data = {
            **self.sample_receipt_data,
            'userId': test_user.id
        }
        
        # Store receipt using Prisma
        created_receipt = await prisma_client.receipt.create(
            data=receipt_data
        )
        
        # Verify receipt was created correctly
        assert created_receipt.merchant == 'OFFICEWORKS'
        assert created_receipt.totalAmount == Decimal('118.50')
        assert created_receipt.gstAmount == Decimal('10.77')
        assert created_receipt.userId == test_user.id
        assert created_receipt.processingStatus == ReceiptStatus.PROCESSED
        
        # Cleanup
        await prisma_client.receipt.delete(where={'id': created_receipt.id})
    
    async def test_receipt_retrieval(self, prisma_client: Prisma, test_user: User):
        """Test receipt data retrieval from database"""
        # First create a receipt
        receipt_data = {
            **self.sample_receipt_data,
            'userId': test_user.id
        }
        created_receipt = await prisma_client.receipt.create(
            data=receipt_data
        )
        
        # Retrieve the receipt
        retrieved_receipt = await prisma_client.receipt.find_first(
            where={'id': created_receipt.id}
        )
        
        # Verify retrieval
        assert retrieved_receipt is not None
        assert retrieved_receipt.id == created_receipt.id
        assert retrieved_receipt.merchant == 'OFFICEWORKS'
        assert retrieved_receipt.totalAmount == Decimal('118.50')
        assert retrieved_receipt.gstAmount == Decimal('10.77')
        
        # Cleanup
        await prisma_client.receipt.delete(where={'id': created_receipt.id})
    
    async def test_receipt_update_operations(self, prisma_client: Prisma, test_user: User):
        """Test receipt update operations"""
        # First create a receipt
        receipt_data = {
            **self.sample_receipt_data,
            'userId': test_user.id
        }
        created_receipt = await prisma_client.receipt.create(
            data=receipt_data
        )
        
        # Update data
        update_data = {
            'taxCategory': 'D6',
            'processingStatus': ReceiptStatus.MANUAL_REVIEW,
            'matchedTransactionId': 'txn_123',
            'matchConfidence': Decimal('0.95')
        }
        
        # Update the receipt
        updated_receipt = await prisma_client.receipt.update(
            where={'id': created_receipt.id},
            data=update_data
        )
        
        # Verify update
        assert updated_receipt.taxCategory == 'D6'
        assert updated_receipt.processingStatus == ReceiptStatus.MANUAL_REVIEW
        assert updated_receipt.matchedTransactionId == 'txn_123'
        assert updated_receipt.matchConfidence == Decimal('0.95')
        
        # Cleanup
        await prisma_client.receipt.delete(where={'id': created_receipt.id})
    
    async def test_receipt_deletion(self, prisma_client: Prisma, test_user: User):
        """Test receipt deletion and cleanup"""
        # First create a receipt
        receipt_data = {
            **self.sample_receipt_data,
            'userId': test_user.id
        }
        created_receipt = await prisma_client.receipt.create(
            data=receipt_data
        )
        
        # Delete the receipt
        await prisma_client.receipt.delete(
            where={'id': created_receipt.id}
        )
        
        # Verify deletion
        deleted_receipt = await prisma_client.receipt.find_first(
            where={'id': created_receipt.id}
        )
        assert deleted_receipt is None
    
    async def test_user_receipts_query(self, prisma_client: Prisma, test_user: User):
        """Test querying receipts by user"""
        # Create multiple receipts for the user
        receipts_created = []
        for i in range(3):
            receipt_data = {
                'userId': test_user.id,
                'merchant': f'Merchant {i}',
                'totalAmount': Decimal(f'{50.00 + i * 10}'),
                'date': datetime(2024, 1, 15 + i),
                'processingStatus': ReceiptStatus.PROCESSED
            }
            receipt = await prisma_client.receipt.create(data=receipt_data)
            receipts_created.append(receipt)
        
        # Query receipts by user
        user_receipts = await prisma_client.receipt.find_many(
            where={'userId': test_user.id},
            order_by={'createdAt': 'desc'}
        )
        
        # Verify query results
        assert len(user_receipts) == 3
        assert all(receipt.userId == test_user.id for receipt in user_receipts)
        
        # Cleanup
        for receipt in receipts_created:
            await prisma_client.receipt.delete(where={'id': receipt.id})
    
    async def test_receipt_pagination(self, prisma_client: Prisma, test_user: User):
        """Test paginated receipt queries"""
        # Create 15 receipts for pagination testing
        receipts_created = []
        for i in range(15):
            receipt_data = {
                'userId': test_user.id,
                'merchant': f'Merchant {i}',
                'totalAmount': Decimal('50.00'),
                'date': datetime(2024, 1, 1) + timedelta(days=i),
                'processingStatus': ReceiptStatus.PROCESSED
            }
            receipt = await prisma_client.receipt.create(data=receipt_data)
            receipts_created.append(receipt)
        
        # Test pagination - first page
        page_size = 10
        first_page = await prisma_client.receipt.find_many(
            where={'userId': test_user.id},
            order_by={'createdAt': 'desc'},
            take=page_size
        )
        
        # Test pagination - second page
        second_page = await prisma_client.receipt.find_many(
            where={'userId': test_user.id},
            order_by={'createdAt': 'desc'},
            skip=page_size,
            take=page_size
        )
        
        # Verify pagination
        assert len(first_page) == 10
        assert len(second_page) == 5  # Remaining receipts
        
        # Verify no overlap between pages
        first_page_ids = {r.id for r in first_page}
        second_page_ids = {r.id for r in second_page}
        assert len(first_page_ids.intersection(second_page_ids)) == 0
        
        # Cleanup
        for receipt in receipts_created:
            await prisma_client.receipt.delete(where={'id': receipt.id})


@pytest.mark.asyncio
class TestTransactionMatching:
    """Test receipt-transaction matching algorithms"""
    
    async def setup_method(self, method):
        """Set up test data for transaction matching"""
        self.receipt_data = {
            'merchant': 'OFFICEWORKS',
            'amount': 118.50,
            'date': '2024-01-15',
            'extracted_data': {
                'merchant_name': 'OFFICEWORKS',
                'total_amount': 118.50,
                'date': '2024-01-15'
            }
        }
        
        self.transactions = [
            {
                'id': 'txn_exact_match',
                'amount': '-118.50',
                'description': 'EFTPOS OFFICEWORKS MELBOURNE',
                'postDate': '2024-01-15T14:30:00Z'
            },
            {
                'id': 'txn_close_match',
                'amount': '-118.45',  # Slight difference
                'description': 'OFFICEWORKS',
                'postDate': '2024-01-15T15:00:00Z'
            },
            {
                'id': 'txn_no_match',
                'amount': '-67.80',
                'description': 'SHELL FUEL',
                'postDate': '2024-01-14T08:30:00Z'
            }
        ]
    
    async def test_exact_amount_matching(self):
        """Test matching with exact amount"""
        match_result = match_receipt_with_transaction(
            self.receipt_data, 
            self.transactions
        )
        
        assert match_result is not None
        assert match_result['transaction_id'] == 'txn_exact_match'
        assert match_result['confidence'] > 0.9
    
    async def test_approximate_amount_matching(self):
        """Test matching with approximate amounts (small differences)"""
        # Test with receipt amount slightly different from transaction
        receipt_with_rounding = self.receipt_data.copy()
        receipt_with_rounding['amount'] = 118.45
        
        match_result = match_receipt_with_transaction(
            receipt_with_rounding,
            self.transactions
        )
        
        # Should match the close amount transaction
        assert match_result is not None
        assert match_result['confidence'] > 0.7
    
    async def test_merchant_name_matching(self):
        """Test matching based on merchant name patterns"""
        # Transaction with partial merchant name
        transactions_partial = [
            {
                'id': 'txn_partial_name',
                'amount': '-118.50',
                'description': 'OFFICEWRKS MLBRN',  # Abbreviated
                'postDate': '2024-01-15T14:30:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            transactions_partial
        )
        
        # Should still match based on partial name similarity
        assert match_result is not None
        assert match_result['confidence'] > 0.6
    
    async def test_date_range_matching(self):
        """Test matching within reasonable date ranges"""
        # Transaction one day after receipt
        transactions_date_diff = [
            {
                'id': 'txn_next_day',
                'amount': '-118.50',
                'description': 'OFFICEWORKS',
                'postDate': '2024-01-16T10:00:00Z'  # Next day
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            transactions_date_diff
        )
        
        # Should match within reasonable date range
        assert match_result is not None
        assert match_result['confidence'] > 0.5
    
    async def test_no_matching_transaction(self):
        """Test behavior when no matching transaction exists"""
        non_matching_transactions = [
            {
                'id': 'txn_different',
                'amount': '-50.00',
                'description': 'DIFFERENT STORE',
                'postDate': '2024-01-10T12:00:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            non_matching_transactions
        )
        
        # Should return None or low confidence match
        assert match_result is None or match_result['confidence'] < 0.3
    
    async def test_multiple_potential_matches(self):
        """Test handling of multiple potential matches"""
        duplicate_transactions = [
            {
                'id': 'txn_duplicate_1',
                'amount': '-118.50',
                'description': 'OFFICEWORKS STORE 1',
                'postDate': '2024-01-15T14:00:00Z'
            },
            {
                'id': 'txn_duplicate_2',
                'amount': '-118.50',
                'description': 'OFFICEWORKS STORE 2',
                'postDate': '2024-01-15T14:30:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            duplicate_transactions
        )
        
        # Should pick the best match (closest time or best description match)
        assert match_result is not None
        assert match_result['transaction_id'] in ['txn_duplicate_1', 'txn_duplicate_2']


@pytest.mark.asyncio
class TestDataConsistency:
    """Test data consistency and integrity"""
    
    async def test_concurrent_receipt_updates(self, prisma_client: Prisma, test_user: User):
        """Test handling of concurrent receipt updates"""
        # Create a receipt
        receipt = await prisma_client.receipt.create(
            data={
                'userId': test_user.id,
                'merchant': 'Test Merchant',
                'totalAmount': Decimal('100.00'),
                'date': datetime(2024, 1, 15),
                'processingStatus': ReceiptStatus.PROCESSED
            }
        )
        
        # Simulate concurrent updates using transactions
        async def update_category():
            async with prisma_client.tx() as tx:
                await tx.receipt.update(
                    where={'id': receipt.id},
                    data={'taxCategory': 'D5'}
                )
        
        async def update_transaction():
            async with prisma_client.tx() as tx:
                await tx.receipt.update(
                    where={'id': receipt.id},
                    data={
                        'matchedTransactionId': 'txn_123',
                        'matchConfidence': Decimal('0.95')
                    }
                )
        
        # Run updates concurrently
        await asyncio.gather(update_category(), update_transaction())
        
        # Verify both updates were applied
        updated_receipt = await prisma_client.receipt.find_first(
            where={'id': receipt.id}
        )
        assert updated_receipt.taxCategory == 'D5'
        assert updated_receipt.matchedTransactionId == 'txn_123'
        
        # Cleanup
        await prisma_client.receipt.delete(where={'id': receipt.id})
    
    async def test_data_validation_on_storage(self, prisma_client: Prisma):
        """Test data validation before storage"""
        # Test invalid receipt data scenarios
        
        # Test 1: Missing required fields
        with pytest.raises(Exception) as exc_info:
            await prisma_client.receipt.create(
                data={
                    # Missing userId - should fail
                    'merchant': 'Test',
                    'totalAmount': Decimal('50.00'),
                    'date': datetime(2024, 1, 15)
                }
            )
        assert 'userId' in str(exc_info.value).lower()
        
        # Test 2: Invalid data types
        with pytest.raises(Exception) as exc_info:
            await prisma_client.receipt.create(
                data={
                    'userId': 'test_user',
                    'merchant': 'Test',
                    'totalAmount': 'invalid_amount',  # Should be Decimal
                    'date': datetime(2024, 1, 15)
                }
            )
        
        # Test 3: Custom validation for business rules
        def validate_receipt_data(data):
            errors = []
            if not data.get('userId'):
                errors.append('userId is required')
            if data.get('totalAmount', 0) <= 0:
                errors.append('totalAmount must be positive')
            if data.get('gstAmount', 0) > data.get('totalAmount', 0):
                errors.append('gstAmount cannot exceed totalAmount')
            return errors
        
        # Test custom validation
        invalid_data = {
            'userId': None,
            'totalAmount': Decimal('-50.00'),
            'gstAmount': Decimal('100.00')
        }
        
        validation_errors = validate_receipt_data(invalid_data)
        assert len(validation_errors) > 0
        assert 'userId is required' in validation_errors
        assert 'totalAmount must be positive' in validation_errors
    
    async def test_receipt_model_serialization(self, prisma_client: Prisma, test_user: User):
        """Test Receipt model serialization/deserialization"""
        # Create Receipt using Prisma
        receipt_data = {
            'userId': test_user.id,
            'merchant': 'OFFICEWORKS',
            'totalAmount': Decimal('118.50'),
            'gstAmount': Decimal('10.77'),
            'date': datetime(2024, 1, 15),
            'items': [
                {'name': 'Paper', 'price': 15.95},
                {'name': 'Pens', 'price': 12.50}
            ],
            'processingStatus': ReceiptStatus.PROCESSED
        }
        
        receipt = await prisma_client.receipt.create(data=receipt_data)
        
        # Test model fields
        assert receipt.merchant == 'OFFICEWORKS'
        assert receipt.totalAmount == Decimal('118.50')
        assert receipt.gstAmount == Decimal('10.77')
        assert isinstance(receipt.items, list)
        assert len(receipt.items) == 2
        
        # Test JSON serialization of items field
        assert receipt.items[0]['name'] == 'Paper'
        assert receipt.items[0]['price'] == 15.95
        
        # Cleanup
        await prisma_client.receipt.delete(where={'id': receipt.id})


@pytest.mark.asyncio
class TestPrismaConnectivity:
    """Test Firebase connection and error handling"""
    
    async def test_prisma_connection_success(self, prisma_client: Prisma):
        """Test successful Prisma connection"""
        # Test basic connection
        try:
            # Simple query to test connection
            user_count = await prisma_client.user.count()
            assert isinstance(user_count, int)
            assert user_count >= 0
        except Exception as e:
            pytest.fail(f"Prisma connection failed: {e}")
    
    async def test_prisma_connection_failure(self):
        """Test Prisma connection failure handling"""
        # Create a client with invalid connection string
        invalid_prisma = Prisma()
        
        # Mock connection failure
        with pytest.raises(Exception) as exc_info:
            # This would fail if database is unreachable
            invalid_prisma._client_generator = Mock(side_effect=Exception("Connection failed"))
            await invalid_prisma.connect()
        
        assert "Connection failed" in str(exc_info.value)
    
    async def test_prisma_permission_errors(self, prisma_client: Prisma):
        """Test handling of Prisma permission errors"""
        # Test unauthorized access scenario
        # In a real scenario, this would test with different user permissions
        
        # Mock a permission error by trying to access non-existent relation
        with pytest.raises(Exception) as exc_info:
            # This simulates accessing data without proper permissions
            await prisma_client.receipt.find_first(
                where={'userId': 'unauthorized_user_id'},
                include={'nonexistent_relation': True}  # This will cause an error
            )
        
        # The error should indicate the issue
        assert 'nonexistent_relation' in str(exc_info.value).lower() or 'unknown' in str(exc_info.value).lower()
    
    async def test_offline_mode_handling(self):
        """Test behavior when database is offline"""
        # Test handling of network/database unavailability
        
        # Mock offline scenario
        offline_prisma = Prisma()
        offline_prisma._client = Mock()
        offline_prisma._client.receipt.find_many = AsyncMock(
            side_effect=Exception("Network unavailable")
        )
        
        # Should handle offline errors gracefully
        with pytest.raises(Exception) as exc_info:
            await offline_prisma._client.receipt.find_many()
        
        assert "network unavailable" in str(exc_info.value).lower()


if __name__ == '__main__':
    pytest.main([__file__, '-v']) 