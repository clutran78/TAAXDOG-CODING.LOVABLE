# BASIQ API Integration with Environment Switching

This document details the comprehensive BASIQ API integration implemented in TAAXDOG with development and production environment switching capabilities.

## Overview

The BASIQ integration provides:
- **Environment Switching**: Seamless switching between development and production environments
- **Bank Account Linking**: Connect multiple bank accounts via Australian financial institutions
- **Transaction Import**: Automatic transaction synchronization and processing
- **Receipt Matching**: AI-powered matching of receipts with bank transactions
- **Background Sync**: Automated periodic transaction synchronization
- **Admin Management**: Comprehensive admin panel for environment management

## Architecture

### Core Components

1. **BasiqClient** (`src/integrations/basiq_client.py`)
   - Comprehensive API client with environment awareness
   - Automatic token management and refresh
   - Transaction processing and receipt matching
   - Error handling and retry logic

2. **BasiqConfig** (`backend/config/basiq_config.py`)
   - Environment configuration management
   - Validation and switching capabilities
   - Flask app integration

3. **BasiqSyncScheduler** (`backend/tasks/basiq_sync.py`)
   - Background task scheduling
   - Automatic transaction synchronization
   - Error recovery and logging

4. **Admin Routes** (`backend/routes/admin_routes.py`)
   - Environment switching endpoints
   - Configuration management
   - Testing and monitoring tools

## Environment Configuration

### Environment Variables

```bash
# Environment Selection
BASIQ_ENVIRONMENT=development  # or 'production'

# Development Environment
BASIQ_API_KEY_DEV=your_development_api_key
BASIQ_BASE_URL_DEV=https://au-api.basiq.io

# Production Environment
BASIQ_API_KEY_PROD=your_production_api_key
BASIQ_BASE_URL_PROD=https://au-api.basiq.io

# Configuration Parameters
BASIQ_TIMEOUT=30
BASIQ_RETRY_ATTEMPTS=3
BASIQ_SYNC_INTERVAL_HOURS=6
BASIQ_TRANSACTION_DAYS_BACK=30
BASIQ_MATCH_THRESHOLD=0.7
BASIQ_MATCH_DATE_RANGE_DAYS=3
BASIQ_MATCH_AMOUNT_TOLERANCE=5.0
```

### Environment Switching

#### Via Environment Variable
```bash
# Change environment and restart app
export BASIQ_ENVIRONMENT=production
```

#### Via Admin API
```bash
# Switch to production environment
curl -X POST http://localhost:5000/api/admin/basiq/environment/switch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"environment": "production"}'
```

#### Via Admin Dashboard
Access the admin panel to switch environments through the web interface.

## API Usage

### User Management

#### Create BASIQ User
```python
from src.integrations.basiq_client import basiq_client

user_data = {
    'email': 'user@example.com',
    'mobile': '+61412345678',
    'firstName': 'John',
    'lastName': 'Doe'
}

result = basiq_client.create_basiq_user(user_data)
if result['success']:
    basiq_user_id = result['user']['id']
```

#### Get User Information
```python
result = basiq_client.get_user(basiq_user_id)
if result['success']:
    user_info = result['user']
```

### Institution and Connection Management

#### Get Supported Institutions
```python
institutions = basiq_client.get_supported_institutions()
# Returns list of Australian financial institutions
```

#### Initiate Bank Connection
```python
result = basiq_client.initiate_bank_connection(user_id, institution_id)
if result['success']:
    connection_id = result['connection_id']
    status = result['status']
```

#### Get User Connections
```python
result = basiq_client.get_user_connections(user_id)
if result['success']:
    connections = result['connections']['data']
```

### Account and Transaction Management

#### Sync User Accounts
```python
accounts = basiq_client.sync_user_accounts(user_id)
# Returns formatted account information
```

#### Import Transactions
```python
transactions = basiq_client.import_transactions(user_id, days_back=30)
# Returns processed transaction data with receipt matching
```

#### Get User Transactions
```python
result = basiq_client.get_user_transactions(user_id, filter_str="account.id.eq('account-id')")
if result['success']:
    transactions = result['transactions']['data']
```

### Receipt Matching

#### Manual Receipt Matching
```python
# Calculate match score between transaction and receipt
score = basiq_client.calculate_match_score(transaction, receipt)

# Attempt to match transaction with receipts
matched = basiq_client.match_transaction_with_receipts(user_id, transaction)
```

## Admin API Endpoints

### Environment Management

#### Get Environment Status
```
GET /api/admin/basiq/environment/status
```

Response:
```json
{
  "success": true,
  "status": {
    "current_environment": "development",
    "api_endpoint": "https://au-api.basiq.io",
    "api_key_configured": true,
    "configuration_valid": true,
    "token_cached": true,
    "last_checked": "2025-01-08T10:30:00Z"
  }
}
```

#### Switch Environment
```
POST /api/admin/basiq/environment/switch
Content-Type: application/json

{
  "environment": "production"
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully switched to production environment",
  "environment": "production",
  "previous_environment": "development",
  "api_endpoint": "https://au-api.basiq.io"
}
```

#### Validate Configuration
```
GET /api/admin/basiq/environment/validate
```

#### Test Connection
```
POST /api/admin/basiq/test-connection
```

### Configuration Management

#### Get Current Configuration
```
GET /api/admin/basiq/config
```

#### Get Supported Institutions
```
GET /api/admin/basiq/institutions
```

### Sync Management

#### Trigger Manual Sync
```
POST /api/admin/basiq/sync/trigger
```

#### Get Sync Logs
```
GET /api/admin/basiq/logs
```

## Background Sync Scheduler

### Features

- **Automatic Scheduling**: Configurable sync intervals (default: 6 hours)
- **Error Recovery**: Retry logic and error logging
- **Performance Monitoring**: Sync statistics and timing
- **User Management**: Bulk user synchronization

### Configuration

```python
from backend.tasks.basiq_sync import get_basiq_scheduler

scheduler = get_basiq_scheduler()

# Get scheduler status
status = scheduler.get_status()

# Manual sync for specific user
result = scheduler.manual_sync(user_id="firebase_user_id")

# Manual sync for all users
result = scheduler.manual_sync()
```

### Monitoring

The scheduler provides comprehensive statistics:

```json
{
  "running": true,
  "environment": "development",
  "statistics": {
    "last_sync": "2025-01-08T10:00:00Z",
    "successful_syncs": 45,
    "failed_syncs": 2,
    "users_synced": 150,
    "transactions_imported": 2340,
    "errors": []
  },
  "next_sync": "2025-01-08T16:00:00Z"
}
```

## Integration with Existing BASIQ Code

The new implementation maintains backward compatibility with existing BASIQ code:

```python
# Legacy functions still work
from backend.basiq_api import get_basiq_token, create_basiq_user, get_user_transactions

# New enhanced client
from src.integrations.basiq_client import basiq_client

# Enhanced client provides additional functionality
basiq_client.switch_environment('production')
basiq_client.import_transactions(user_id, days_back=30)
```

## Error Handling

### Common Error Scenarios

1. **Invalid API Key**: Check environment configuration
2. **Network Issues**: Automatic retry with exponential backoff
3. **Rate Limiting**: Built-in rate limiting and queue management
4. **Token Expiration**: Automatic token refresh

### Error Logging

All BASIQ operations are logged with structured logging:

```
2025-01-08 10:30:00 - basiq_client - INFO - ✅ BASIQ token acquired for development environment
2025-01-08 10:30:05 - basiq_client - INFO - ✅ Retrieved 23 Australian institutions
2025-01-08 10:30:10 - basiq_client - ERROR - ❌ Failed to get BASIQ user user123: User not found
```

## Testing

### Unit Tests
```bash
pytest tests/unit/test_basiq_integration.py
```

### Integration Tests
```bash
pytest tests/integration/test_basiq_api.py
```

### Manual Testing

1. **Environment Switching**:
   - Switch between environments via admin API
   - Verify API keys and endpoints change correctly
   - Test token acquisition in both environments

2. **Transaction Sync**:
   - Connect test bank account
   - Verify transactions are imported
   - Check receipt matching functionality

3. **Background Sync**:
   - Monitor scheduler status
   - Trigger manual sync
   - Verify error handling

## Security Considerations

1. **API Key Management**:
   - Separate keys for development and production
   - Environment-based key selection
   - Secure key storage

2. **Admin Access**:
   - Authentication required for admin endpoints
   - Rate limiting on sensitive operations
   - Audit logging for environment switches

3. **Data Privacy**:
   - Encrypted transaction data
   - Secure token management
   - GDPR compliance for user data

## Performance Optimization

1. **Token Caching**: Automatic token refresh with buffer time
2. **Rate Limiting**: Built-in rate limiting to avoid API limits
3. **Batch Processing**: Efficient bulk operations
4. **Background Tasks**: Non-blocking transaction sync

## Monitoring and Metrics

### Key Metrics

- **Sync Success Rate**: Percentage of successful syncs
- **Transaction Volume**: Number of transactions processed
- **API Response Times**: BASIQ API performance
- **Error Rates**: Types and frequency of errors

### Health Checks

```
GET /api/health/basiq
```

Returns:
```json
{
  "status": "healthy",
  "environment": "development",
  "api_reachable": true,
  "token_valid": true,
  "last_sync": "2025-01-08T10:00:00Z",
  "scheduler_running": true
}
```

## Troubleshooting

### Common Issues

1. **Environment Switch Failed**:
   - Check API key configuration
   - Verify network connectivity
   - Review error logs

2. **Transaction Sync Issues**:
   - Verify user has BASIQ connection
   - Check account permissions
   - Review BASIQ API status

3. **Receipt Matching Problems**:
   - Adjust matching threshold
   - Check date range settings
   - Verify receipt data quality

### Debug Mode

Enable debug logging for detailed troubleshooting:

```python
import logging
logging.getLogger('basiq_client').setLevel(logging.DEBUG)
```

## Future Enhancements

1. **Real-time Webhooks**: BASIQ webhook integration for instant updates
2. **Advanced Matching**: Machine learning for improved receipt matching
3. **Multi-currency Support**: Support for international transactions
4. **Bank-specific Features**: Institution-specific functionality
5. **Performance Analytics**: Detailed performance monitoring and optimization

## Support

For issues with BASIQ integration:

1. Check the logs for error details
2. Verify environment configuration
3. Test API connectivity
4. Review BASIQ API documentation
5. Contact support with request ID and error details 