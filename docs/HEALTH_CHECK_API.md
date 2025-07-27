# Health Check API Documentation

The TAAXDOG application provides comprehensive health check endpoints to monitor system health, database connectivity, and external API availability.

## Endpoints

### 1. Basic Health Check
**Endpoint:** `GET /api/health`  
**Rate Limited:** Yes  
**Authentication:** Not required  
**Response Code:** 
- `200` - System is healthy
- `503` - System is unhealthy or degraded

**Response Format:**
```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "pass | fail",
      "responseTime": 45,
      "details": {...}
    },
    "redis": {
      "status": "pass | fail",
      "responseTime": 12,
      "details": {...}
    },
    "memory": {
      "status": "pass | fail",
      "usage": {...},
      "threshold": 0.9
    },
    "uptime": {
      "status": "pass | fail",
      "seconds": 3600
    },
    "basiq": {
      "status": "pass | fail",
      "responseTime": 200,
      "details": {...}
    },
    "ai": {
      "status": "pass | fail",
      "responseTime": 500,
      "details": {...}
    },
    "stripe": {
      "status": "pass | fail",
      "responseTime": 150,
      "details": {...}
    },
    "sendgrid": {
      "status": "pass | fail",
      "responseTime": 100,
      "details": {...}
    }
  }
}
```

### 2. Health Check Summary
**Endpoint:** `GET /api/health/summary`  
**Rate Limited:** Yes  
**Authentication:** Not required  
**Description:** Provides a lightweight summary of system health

**Response Format:**
```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "total": 8,
    "passing": 7,
    "failing": 1
  },
  "services": {
    "database": "pass",
    "redis": "pass",
    "memory": "pass",
    "uptime": "pass",
    "basiq": "fail",
    "ai": "pass",
    "stripe": "pass",
    "sendgrid": "pass"
  }
}
```

### 3. External Services Health Check
**Endpoint:** `GET /api/health/external-services`  
**Rate Limited:** Yes  
**Authentication:** Not required  
**Description:** Monitors only external service dependencies

**Response Format:**
```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "services": {
    "database": {...},
    "redis": {...},
    "basiq": {...},
    "ai": {...},
    "stripe": {...},
    "sendgrid": {...}
  },
  "summary": {
    "total": 6,
    "healthy": 5,
    "unhealthy": 1
  }
}
```

### 4. Detailed Health Check
**Endpoint:** `GET /api/health/detailed`  
**Rate Limited:** No  
**Authentication:** Required in production (Bearer token)  
**Description:** Provides comprehensive health information including metrics

**Headers Required (Production):**
```
Authorization: Bearer {HEALTH_CHECK_TOKEN}
```

**Response Format:**
```json
{
  "health": {
    // Full health check response
  },
  "metrics": {
    "totalQueries": 1000,
    "slowQueries": 5,
    "averageResponseTime": 45.2,
    "connectionPoolStats": {
      "total": 10,
      "idle": 5,
      "waiting": 0
    }
  },
  "configuration": {
    // Safe configuration values
  }
}
```

### 5. Liveness Check
**Endpoint:** `GET /api/health/liveness`  
**Description:** Kubernetes liveness probe endpoint

### 6. Readiness Check
**Endpoint:** `GET /api/health/readiness`  
**Description:** Kubernetes readiness probe endpoint

## Health Status Definitions

- **healthy**: All checks are passing
- **degraded**: One or more checks are failing, but core services are operational
- **unhealthy**: Multiple critical services are failing or the system is non-operational

## Service-Specific Checks

### Database (PostgreSQL)
- Connection availability
- Query execution test
- Response time measurement
- Connection pool statistics

### Redis Cache
- Connection status
- Basic read/write operation test
- Response time measurement

### BASIQ (Banking API)
- API key validation
- API endpoint availability
- Response time measurement
- Environment detection (sandbox/production)

### AI Services
- Provider availability (Anthropic/OpenRouter/Gemini)
- Simple prompt test
- Response time measurement
- Token usage tracking

### Stripe (Payment Processing)
- API key validation
- API endpoint availability
- Response time measurement
- Mode detection (test/live)

### SendGrid (Email Service)
- API key validation
- Verified sender check
- API endpoint availability
- Response time measurement

## Usage Examples

### Basic Health Check
```bash
curl https://taxreturnpro.com.au/api/health
```

### Summary Check
```bash
curl https://taxreturnpro.com.au/api/health/summary
```

### External Services Check
```bash
curl https://taxreturnpro.com.au/api/health/external-services
```

### Detailed Check (Production)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://taxreturnpro.com.au/api/health/detailed
```

## Monitoring Integration

These endpoints are designed to integrate with:
- Uptime monitoring services (Pingdom, UptimeRobot)
- APM tools (New Relic, Datadog)
- Kubernetes health probes
- Custom monitoring dashboards

## Response Time Thresholds

- Database: < 5000ms
- Redis: < 1000ms
- External APIs: < 10000ms
- Overall health check: < 15000ms

## Rate Limiting

Most health check endpoints are rate-limited to prevent abuse:
- Public endpoints: 10 requests per minute per IP
- Authenticated endpoints: No rate limiting

## Error Handling

If a health check fails catastrophically, the endpoint will return:
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "error": "Health check failed",
  "message": "Specific error message"
}
```

## Environment Variables

Required for external service checks:
- `BASIQ_API_KEY`: BASIQ API authentication
- `STRIPE_SECRET_KEY`: Stripe API authentication
- `SENDGRID_API_KEY`: SendGrid API authentication
- `ANTHROPIC_API_KEY`: AI service authentication
- `HEALTH_CHECK_TOKEN`: Token for detailed health check (production)

## Best Practices

1. Monitor the `/api/health/summary` endpoint for quick status checks
2. Use `/api/health/external-services` to identify third-party API issues
3. Set up alerts for `degraded` or `unhealthy` status
4. Monitor response times to identify performance degradation
5. Use the detailed endpoint for debugging and deep diagnostics
6. Implement retry logic for transient failures
7. Consider service-specific timeouts based on criticality