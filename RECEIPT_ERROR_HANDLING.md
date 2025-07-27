# Enhanced Receipt Processing Error Handling & Logging

## Overview

This document describes the comprehensive error handling and logging system
implemented for the TAAXDOG receipt processing pipeline. The system provides
robust error recovery, detailed logging, and user-friendly error messages
throughout the receipt processing workflow.

## Features

### 🛡️ Comprehensive Error Handling

- **Image validation** with detailed format and size checks
- **API retry logic** with exponential backoff
- **Rate limiting protection** with automatic retry delays
- **Network timeout handling** with configurable timeouts
- **Data validation** with business rule checks
- **Graceful degradation** when non-critical features fail

### 📊 Detailed Logging

- **Structured logging** with JSON format for easy parsing
- **Performance metrics** tracking processing times
- **Step-by-step tracking** of each processing stage
- **Separate log files** for different components
- **Log rotation** to prevent disk space issues

### 👤 User-Friendly Messages

- **Context-aware error messages** based on error type
- **Actionable feedback** telling users how to fix issues
- **Progress indicators** during processing
- **Quality scores** for extracted data

## Implementation Details

### Error Categories

The system categorizes errors into specific types for better handling:

1. **Configuration Errors** - API keys, environment setup
2. **Validation Errors** - File format, size, content validation
3. **Network Errors** - Connection issues, timeouts
4. **Rate Limit Errors** - API quota exceeded
5. **Authentication Errors** - Invalid API credentials
6. **Service Errors** - External service unavailable
7. **Data Errors** - Invalid or incomplete extracted data

### Processing Pipeline

```
Image Upload → Validation → OCR Processing → Data Validation → Storage
     ↓             ↓            ↓               ↓             ↓
   Logging    Logging     Retry Logic    Quality Check   Success Log
```

### Logging Levels

- **INFO**: Normal operation, processing steps
- **WARNING**: Recoverable issues, quality concerns
- **ERROR**: Processing failures, critical issues
- **DEBUG**: Detailed diagnostic information (development only)

## Configuration

### Environment Variables

```bash
# Required
GOOGLE_API_KEY=your_gemini_api_key
UPLOAD_FOLDER=./uploads

# Optional
FLASK_ENV=development  # Affects log levels
MAX_RETRIES=3         # API retry attempts
LOG_LEVEL=INFO        # Minimum log level
```

### Processing Limits

```python
# File constraints
MAX_FILE_SIZE = 10MB
MIN_DIMENSIONS = 50x50 pixels
MAX_DIMENSIONS = 4096x4096 pixels

# API constraints
RETRY_ATTEMPTS = 3
RATE_LIMIT_DELAY = 60 seconds
NETWORK_TIMEOUT = 30 seconds
```

## API Error Responses

### Structured Error Format

```json
{
  "success": false,
  "error": "User-friendly error message",
  "error_type": "validation|network|rate_limit|auth|service|generic",
  "details": "Technical details for debugging",
  "processing_metadata": {
    "processing_time_ms": 1500,
    "attempts_made": 2,
    "image_size": 2048576,
    "error_category": "validation"
  }
}
```

### Success Response Format

```json
{
  "success": true,
  "receipt_id": "1735062738.123456",
  "data": {
    "merchant_name": "Example Store",
    "total_amount": 25.99,
    "date": "2024-01-15"
    // ... additional extracted data
  },
  "processing_summary": {
    "total_time_ms": 3200,
    "extraction_confidence": 0.85,
    "data_quality_score": 0.92,
    "validation_warnings": [],
    "upload_method": "file_upload"
  }
}
```

## Error Handling Examples

### 1. File Validation Errors

```python
# Image too small
{
  "success": false,
  "error": "Image is too small (30x40). Minimum size is 50x50.",
  "error_type": "validation"
}

# File too large
{
  "success": false,
  "error": "File is too large (15.2MB). Maximum size is 10MB.",
  "error_type": "validation"
}

# Invalid format
{
  "success": false,
  "error": "Unsupported file format '.txt'. Supported formats: .jpg, .png, .gif",
  "error_type": "validation"
}
```

### 2. API Rate Limiting

```python
{
  "success": false,
  "error": "Service is busy. Please wait a moment and try again.",
  "error_type": "rate_limit",
  "processing_metadata": {
    "retry_after_seconds": 60,
    "attempts_made": 3
  }
}
```

### 3. Data Validation Errors

```python
{
  "success": false,
  "error": "Extracted data validation failed: Missing required fields: Merchant name, Total amount",
  "error_type": "validation",
  "details": "Receipt image may be unclear or damaged"
}
```

## Logging Examples

### Receipt Processing Log

```
2024-01-15 10:30:15,123 - receipt_processor - INFO - upload_receipt:385 - Receipt Processing [receipt_upload] START
2024-01-15 10:30:15,145 - receipt_processor - INFO - upload_receipt:420 - Receipt Processing [file_upload] SUCCESS
2024-01-15 10:30:15,167 - receipt_processor - INFO - validate_image_file:89 - Receipt Processing [image_validation] SUCCESS
2024-01-15 10:30:16,234 - receipt_processor - INFO - upload_receipt:487 - Receipt Processing [gemini_extraction] SUCCESS
2024-01-15 10:30:16,256 - receipt_processor - INFO - upload_receipt:501 - Receipt Processing [data_validation] SUCCESS
2024-01-15 10:30:16,289 - receipt_processor - INFO - upload_receipt:578 - Receipt Processing [firebase_storage] SUCCESS
2024-01-15 10:30:16,291 - receipt_processor - INFO - upload_receipt:586 - Receipt Processing [receipt_upload] SUCCESS
```

### Performance Metrics Log

```json
{
  "timestamp": "2024-01-15T10:30:16.291",
  "metric": "receipt_processing_time",
  "value": 3168,
  "user_id": "user123",
  "processing_metadata": {
    "extraction_confidence": 0.85,
    "data_quality_score": 0.92,
    "image_size": 2048576,
    "upload_method": "file_upload"
  }
}
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Processing Success Rate** - % of receipts processed successfully
2. **Average Processing Time** - Time from upload to completion
3. **Error Rate by Type** - Breakdown of error categories
4. **API Response Times** - Gemini API performance
5. **Quality Scores** - Average confidence and quality metrics

### Alert Thresholds

- Success rate < 95% (warning)
- Success rate < 90% (critical)
- Average processing time > 10 seconds (warning)
- Error rate > 10% (warning)

## Testing

### Running Error Handling Tests

```bash
# Run comprehensive test suite
python test_receipt_error_handling.py

# Check system health
python -c "from backend.receipt_processor_config import validate_processing_health; print(validate_processing_health())"
```

### Test Coverage

The test suite covers:

- ✅ Image validation (size, format, corruption)
- ✅ Data validation (required fields, business rules)
- ✅ Error message generation
- ✅ Logging configuration
- ✅ Retry logic
- ✅ API error handling
- ✅ System health checks

## Troubleshooting

### Common Issues

#### 1. High Error Rate

```bash
# Check logs for patterns
tail -f backend/logs/receipt_errors.log

# Review processing configuration
python -c "from backend.receipt_processor_config import validate_processing_health; print(validate_processing_health())"
```

#### 2. Slow Processing

```bash
# Check performance metrics
tail -f backend/logs/performance.log

# Monitor API response times
grep "gemini_request" backend/logs/receipt_processing.log | tail -20
```

#### 3. API Issues

```bash
# Check API connectivity
curl -H "Authorization: Bearer $GOOGLE_API_KEY" https://generativelanguage.googleapis.com/v1beta/models

# Review API error patterns
grep "rate_limit\|auth_error" backend/logs/gemini_api.log
```

### Log File Locations

```
backend/logs/
├── receipt_processing.log    # Main processing logs
├── receipt_errors.log       # Error-only logs
├── gemini_api.log          # Gemini API specific logs
└── performance.log         # Performance metrics (JSON)
```

## Best Practices

### For Developers

1. **Always log processing steps** using `log_processing_step()`
2. **Use structured error responses** with appropriate error types
3. **Implement proper cleanup** in finally blocks
4. **Test error scenarios** regularly
5. **Monitor performance metrics** in production

### For Operations

1. **Set up log rotation** to prevent disk space issues
2. **Monitor key metrics** and set up alerts
3. **Regular health checks** using `validate_processing_health()`
4. **Backup log files** for historical analysis
5. **Review error patterns** weekly to identify issues

## Future Enhancements

- [ ] Integration with external monitoring services (DataDog, New Relic)
- [ ] Real-time error alerting via email/Slack
- [ ] Machine learning-based error prediction
- [ ] Automated performance optimization
- [ ] Enhanced user feedback with suggestions

---

For additional support or questions about the error handling system, please
refer to the main project documentation or contact the development team.
