# TAAXDOG Production-Ready Features

## Comprehensive Reliability, Monitoring & Error Handling

This document outlines all production-ready features implemented in TAAXDOG to
ensure reliable, maintainable, and monitorable operation in production
environments.

---

## 🚀 **Overview**

TAAXDOG now includes enterprise-grade production features:

✅ **Structured Logging** with correlation IDs for debugging  
✅ **Retry Logic** with exponential backoff for API failures  
✅ **User-Friendly Error Messages** with recovery options  
✅ **Health Monitoring** endpoints for system status  
✅ **Graceful Degradation** when external services fail

---

## 📊 **1. Structured Logging**

### Features

- **Correlation IDs** for tracking requests across services
- **Contextual logging** with user IDs and request metadata
- **JSON-formatted logs** for easy parsing and analysis
- **Performance metrics** tracking for all operations

### Usage Example

```python
from utils.production_utils import logger, set_request_context

# Set context for request tracking
set_request_context(user_id="user123", request_id="req456")

# Log with automatic correlation ID
logger.info("Processing receipt", receipt_id="rec789", confidence=0.95)
```

### Log Output

```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "request_id": "req456",
  "message": "Processing receipt",
  "receipt_id": "rec789",
  "confidence": 0.95
}
```

---

## 🔄 **2. Retry Logic with Exponential Backoff**

### Features

- **Configurable retry attempts** (default: 3)
- **Exponential backoff** with jitter
- **Custom exception handling**
- **Automatic logging** of retry attempts

### Implementation

```python
from utils.production_utils import retry_with_backoff

@retry_with_backoff(max_attempts=3, base_delay=1.0, exceptions=(requests.RequestException,))
def call_external_api():
    response = requests.get("https://api.example.com/data")
    return response.json()
```

### Retry Schedule

- **Attempt 1**: Immediate
- **Attempt 2**: 1 second delay
- **Attempt 3**: 2 second delay
- **Attempt 4**: 4 second delay (if configured)

---

## 🚨 **3. User-Friendly Error Handling**

### Error Contexts

Each error provides:

- **User-friendly message** (what went wrong)
- **Recovery options** (what the user can do)
- **Retry information** (whether retry is possible)
- **Estimated fix time** (when service might recover)

### Error Categories

#### Gemini API Error

```json
{
  "error_code": "GEMINI_API_ERROR",
  "user_message": "Receipt processing is temporarily unavailable. Please try again in a few minutes.",
  "recovery_options": [
    "Try uploading the receipt again",
    "Check your internet connection",
    "Contact support if the issue persists"
  ],
  "retry_possible": true,
  "estimated_fix_time": "2-5 minutes"
}
```

#### Banking API Error

```json
{
  "error_code": "BASIQ_API_ERROR",
  "user_message": "Banking data is temporarily unavailable. Your transactions will sync automatically once the connection is restored.",
  "recovery_options": [
    "Banking data will sync automatically",
    "Upload receipts manually in the meantime",
    "Check account connections in settings"
  ],
  "retry_possible": true,
  "estimated_fix_time": "5-10 minutes"
}
```

#### ABN Verification Error

```json
{
  "error_code": "ABR_API_ERROR",
  "user_message": "ABN verification is temporarily unavailable. Basic validation will be used instead.",
  "recovery_options": [
    "ABN format validation will still work",
    "Detailed verification will retry automatically",
    "You can continue using the application normally"
  ],
  "retry_possible": true,
  "estimated_fix_time": "10-15 minutes"
}
```

---

## 🏥 **4. Health Monitoring Endpoints**

### Available Endpoints

#### Basic Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:45.123456",
  "service": "TAAXDOG",
  "version": "1.0.0"
}
```

#### Detailed Health Check

```http
GET /api/health/detailed
```

**Response:**

```json
{
  "overall_status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123456",
  "services": {
    "gemini_api": {
      "service_name": "gemini_api",
      "status": "healthy",
      "response_time_ms": 245.3,
      "last_check": "2024-01-15T10:30:45.123456",
      "error_message": null
    },
    "firebase": {
      "service_name": "firebase",
      "status": "healthy",
      "response_time_ms": 89.7,
      "last_check": "2024-01-15T10:30:45.123456",
      "error_message": null
    },
    "basiq_api": {
      "service_name": "basiq_api",
      "status": "degraded",
      "response_time_ms": 5234.1,
      "last_check": "2024-01-15T10:30:45.123456",
      "error_message": null
    },
    "abr_api": {
      "service_name": "abr_api",
      "status": "healthy",
      "response_time_ms": 456.8,
      "last_check": "2024-01-15T10:30:45.123456",
      "error_message": null
    }
  },
  "summary": {
    "total_services": 4,
    "healthy": 3,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

#### Individual Service Health

```http
GET /api/health/services/gemini_api
GET /api/health/services/firebase
GET /api/health/services/basiq_api
GET /api/health/services/abr_api
```

#### Database Health Check

```http
GET /api/health/database
```

#### Performance Metrics

```http
GET /api/health/metrics
```

#### Kubernetes-Style Checks

```http
GET /api/health/readiness  # Ready to handle traffic
GET /api/health/liveness   # Application is alive
```

### Health Status Codes

- **200**: Healthy
- **206**: Degraded (partial functionality)
- **503**: Unhealthy (service unavailable)

---

## 🛡️ **5. Graceful Degradation**

### When External Services Fail

#### Gemini API Failure → Fallback Receipt Processing

```python
# Automatic fallback when Gemini is unavailable
fallback_data = {
    'success': True,
    'fallback_mode': True,
    'message': 'Receipt processed using basic extraction (Gemini API unavailable)',
    'extracted_data': {
        'merchant_name': 'Unknown Merchant',
        'total_amount': 0.0,
        'date': '2024-01-15',
        'category': 'PERSONAL',
        'confidence': 0.3,
        'requires_manual_review': True,
        'processing_method': 'fallback'
    }
}
```

#### ABR API Failure → Basic ABN Validation

```python
# Local checksum validation when ABR API is down
{
    'abn': '53004085616',
    'is_valid': True,
    'entity_name': 'Unknown Entity (API unavailable)',
    'entity_type': 'Other',
    'status': 'Format valid',
    'gst_registered': False,
    'fallback_mode': True,
    'note': 'Enhanced verification unavailable - using basic validation only'
}
```

#### Enhanced Categorization Failure → Rule-Based Fallback

```python
# Simple keyword-based categorization
{
    'category': 'D1',  # Motor vehicle expenses
    'confidence': 0.6,
    'deductibility': 1.0,
    'reasoning': 'Fallback categorization based on keyword matching',
    'requires_verification': True,
    'fallback_mode': True
}
```

---

## 📈 **6. Performance Monitoring**

### Automatic Performance Tracking

```python
from utils.production_utils import measure_performance

@measure_performance
def process_receipt(receipt_data):
    # Function automatically tracked for performance
    return processed_data
```

### Performance Logs

```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Performance metric for process_receipt",
  "function": "process_receipt",
  "duration_ms": 1247.3,
  "success": true
}
```

---

## 🔧 **7. Configuration & Setup**

### Environment Variables

```bash
# Production Settings
FLASK_ENV=production
LOG_LEVEL=INFO
HEALTH_CHECK_INTERVAL=300  # 5 minutes

# API Keys (keep secure)
GOOGLE_API_KEY=your_gemini_api_key
BASIQ_API_KEY=your_basiq_api_key
ABR_API_KEY=your_abr_api_key  # Optional for enhanced ABN verification

# Retry Configuration
MAX_RETRY_ATTEMPTS=3
RETRY_BASE_DELAY=1.0
RETRY_MAX_DELAY=60.0

# Health Check Thresholds
HEALTHY_RESPONSE_TIME_MS=1000
DEGRADED_RESPONSE_TIME_MS=5000
```

### Docker Health Checks

```dockerfile
# Add to Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1
```

### Kubernetes Configuration

```yaml
# kubernetes-deployment.yaml
spec:
  containers:
    - name: taaxdog
      image: taaxdog:latest
      ports:
        - containerPort: 8080

      # Liveness probe
      livenessProbe:
        httpGet:
          path: /api/health/liveness
          port: 8080
        initialDelaySeconds: 60
        periodSeconds: 30
        timeoutSeconds: 10

      # Readiness probe
      readinessProbe:
        httpGet:
          path: /api/health/readiness
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
```

---

## 🎯 **8. Testing Production Features**

### Test Health Endpoints

```bash
# Basic health check
curl http://localhost:8080/api/health

# Detailed health with all services
curl http://localhost:8080/api/health/detailed

# Check specific service
curl http://localhost:8080/api/health/services/gemini_api

# Database connectivity
curl http://localhost:8080/api/health/database

# Performance metrics
curl http://localhost:8080/api/health/metrics
```

### Test Error Handling

```bash
# Trigger Gemini fallback (when API key is invalid)
curl -X POST http://localhost:8080/api/receipts/upload \
  -H "Content-Type: multipart/form-data" \
  -F "receipt=@test_receipt.jpg"

# Test ABN verification fallback
curl -X POST http://localhost:8080/api/receipts/verify-abn \
  -H "Content-Type: application/json" \
  -d '{"abn": "53004085616"}'
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Create load test config
artillery run load-test.yml

# Test health endpoints under load
artillery quick --count 100 --num 5 http://localhost:8080/api/health
```

---

## 📊 **9. Monitoring & Alerting**

### Metrics to Monitor

1. **Response Times**
   - Health check response times
   - API endpoint performance
   - Database query performance

2. **Error Rates**
   - HTTP 5xx errors
   - Failed API calls to external services
   - Receipt processing failures

3. **Service Availability**
   - Gemini API uptime
   - Firebase connectivity
   - Basiq API health
   - ABR API availability

4. **Resource Usage**
   - Memory consumption
   - CPU utilization
   - Disk space (for logs and uploads)

### Sample Alerts

```yaml
# alerts.yml
alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    duration: 5m
    action: notify_team

  - name: slow_response_time
    condition: avg_response_time > 2000ms
    duration: 2m
    action: scale_up

  - name: external_api_down
    condition: service_health == "unhealthy"
    duration: 1m
    action: enable_fallback_mode
```

---

## 🔍 **10. Debugging Guide**

### Using Correlation IDs

```bash
# Search logs by correlation ID
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/taaxdog/app.log

# Filter by user ID
grep '"user_id": "user123"' /var/log/taaxdog/app.log
```

### Common Issues & Solutions

#### High Response Times

1. Check service health: `GET /api/health/detailed`
2. Review performance metrics: `GET /api/health/metrics`
3. Look for degraded services in logs
4. Consider scaling resources

#### External API Failures

1. Verify API keys in environment
2. Check network connectivity
3. Review API rate limits
4. Confirm fallback mechanisms are working

#### Database Issues

1. Check database health: `GET /api/health/database`
2. Review Firebase connection logs
3. Verify Firebase credentials
4. Monitor database response times

---

## 📋 **11. Maintenance Checklist**

### Daily

- [ ] Check overall system health (`/api/health/detailed`)
- [ ] Review error logs for patterns
- [ ] Monitor response times

### Weekly

- [ ] Analyze performance metrics trends
- [ ] Review retry failure rates
- [ ] Test fallback mechanisms
- [ ] Check disk space for logs

### Monthly

- [ ] Update API keys if needed
- [ ] Review and update error messages
- [ ] Test disaster recovery procedures
- [ ] Optimize performance based on metrics

---

## 🚀 **Production Deployment Checklist**

### Pre-Deployment

- [ ] All environment variables configured
- [ ] API keys are valid and secure
- [ ] Health check endpoints respond correctly
- [ ] Error handling tested with invalid inputs
- [ ] Retry logic tested with service failures
- [ ] Fallback mechanisms validated

### Post-Deployment

- [ ] Health checks are green
- [ ] Monitoring alerts configured
- [ ] Performance baselines established
- [ ] Error rates within acceptable limits
- [ ] External service integrations working
- [ ] Logs are being generated correctly

---

## 🎉 **Summary**

TAAXDOG is now production-ready with:

✅ **Enterprise-grade reliability** through retry logic and graceful
degradation  
✅ **Comprehensive monitoring** with health checks and performance metrics  
✅ **User-friendly error handling** with clear recovery guidance  
✅ **Structured logging** for easy debugging and troubleshooting  
✅ **Automated fallback systems** ensuring continuous service availability

The application can now handle production traffic with confidence, providing
users with a reliable experience even when external services experience issues.

---

**Need Help?** Check the [troubleshooting guide](#-10-debugging-guide) or
contact the development team with correlation IDs from error responses for
faster debugging.
