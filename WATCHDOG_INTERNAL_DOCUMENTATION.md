# Scout Watchdog Service - Internal Documentation

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: February 22, 2026

## 1. Overview

The Scout Watchdog Service transforms Scout into an **Autonomous Platform Guardian**. It continuously monitors the TradeScout platform for system health, detects anomalies, and proactively suggests self-healing fixes. This ensures platform stability, performance, and provides early warnings for potential issues.

**Base URL**: `/api/scout-watchdog`

## 2. Core Concepts

### 2.1. System Health Monitoring

The Watchdog collects and analyzes various metrics across the TradeScout ecosystem:

| Metric Category | Examples |
| :--- | :--- |
| **Server Metrics** | CPU usage, memory usage, disk I/O, network traffic |
| **API Performance** | Average response times, error rates (5xx, 4xx), requests per minute, throughput |
| **Database Health** | Connection pool utilization, query performance, replication lag, deadlocks |
| **Feature Health** | Health score, error rate, and response times for individual features (e.g., Car Sales, Real Estate, Accounting) |

### 2.2. Anomaly Detection

The Watchdog employs intelligent algorithms to detect deviations from normal operating patterns. Detected anomalies are categorized by severity and include a description of the issue and the affected component.

| Anomaly Type | Severity | Description Example |
| :--- | :--- | :--- |
| `high_error_rate` | `critical` | API error rate has spiked to 5%, indicating a major issue. |
| `slow_response_time` | `high` | Average API response time is 800ms, significantly degrading user experience. |
| `high_memory_usage` | `high` | Server memory usage is at 90%, risking application crashes. |
| `db_connection_pool_saturation` | `critical` | Database connection pool is 95% saturated, causing connection timeouts. |
| `feature_down` | `critical` | The 'Mortgage Calculator' feature is completely unresponsive. |

### 2.3. Self-Healing Engine

Upon detecting an anomaly, the Self-Healing Engine analyzes the error pattern, performs root cause analysis, and generates suggested fixes. These fixes can range from configuration changes to code modifications or administrative actions.

| Fix Type | Description Example | Affected Components |
| :--- | :--- | :--- |
| `code_change` | Implement pagination for large data loads | `server/services/scoutDataFactory.ts` |
| `configuration` | Increase database connection pool size | `.env` file |
| `database_migration` | Add index to frequently queried columns | `migrations/add_index.sql` |
| `cache_clear` | Clear in-memory cache to free up memory | `server/services/cacheService.ts` |
| `restart` | Restart application to clear memory leaks | Application server |

## 3. Endpoints

### 3.1. Get Latest Health Report

Retrieves a comprehensive report of the current system health.

- **Endpoint**: `GET /health`
- **Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "report_id": "report_1677000000000",
    "timestamp": 1677000000000,
    "overall_health_score": 95,
    "server_metrics": [ { ... } ],
    "api_metrics": [ { ... } ],
    "database_metrics": [ { ... } ],
    "feature_health": [ { ... } ],
    "anomalies_detected": [ { ... } ]
  }
}
```

### 3.2. Get Health History

Retrieves a history of past system health reports.

- **Endpoint**: `GET /history?limit=10`
- **Query Parameters**: `limit` (optional, default 100)

### 3.3. Get Critical Alerts

Retrieves a list of critical alerts detected by the Watchdog.

- **Endpoint**: `GET /alerts`

### 3.4. Get Watchdog Statistics

Retrieves statistics about the Watchdog service.

- **Endpoint**: `GET /statistics`

### 3.5. Analyze Error

Manually submit an error for analysis and receive suggested fixes.

- **Endpoint**: `POST /analyze-error`
- **Request Body**:
```json
{
  "error_type": "DatabaseError",
  "error_message": "Connection pool exhausted",
  "affected_endpoints": ["/api/scout-enhanced-v5/message-v5"]
}
```
- **Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "error_pattern": { ... },
    "root_cause_analysis": { ... },
    "suggested_fix": { ... }
  }
}
```

### 3.6. Get Error Patterns

Retrieves all detected error patterns.

- **Endpoint**: `GET /error-patterns`

### 3.7. Get Suggested Fixes

Retrieves a list of all suggested fixes.

- **Endpoint**: `GET /suggested-fixes?limit=10`
- **Query Parameters**: `limit` (optional, default 50)

### 3.8. Get Critical Fixes

Retrieves a list of critical fixes requiring immediate admin action.

- **Endpoint**: `GET /critical-fixes`

### 3.9. Get Self-Healing Statistics

Retrieves statistics about the Self-Healing Engine.

- **Endpoint**: `GET /self-healing-stats`

## 4. Integration with Admin Mission Control & Outbound Dispatcher (SOD)

The Scout Watchdog Service is tightly integrated with your existing infrastructure:

- **Admin Mission Control**: The Watchdog provides a dedicated API (`/api/scout-watchdog`) for your admin dashboards to visualize system health, review anomalies, and manage suggested fixes.
- **Outbound Dispatcher (SOD)**: Critical anomalies and suggested fixes requiring admin action are automatically queued and dispatched via the SOD to configured channels (e.g., Slack, email alerts). This ensures that administrators are immediately notified of severe issues.

## 5. Environment Variables

No specific environment variables are required for the core Watchdog functionality. However, the integration with SOD will leverage SOD's environment variables for dispatching alerts.

## 6. Security Considerations

- **Access Control**: Access to the `/api/scout-watchdog` endpoints should be restricted to authorized administrators or internal monitoring systems.
- **Sensitive Data**: Ensure that error messages and logs do not expose sensitive user data in alerts or reports.
- **Fix Execution**: The Self-Healing Engine *suggests* fixes; it does not automatically *apply* them. Manual review and approval by an administrator are always required for critical changes.

## 7. Verification

To verify the Scout Watchdog Service functionality:

1.  Start your TradeScout application.
2.  Access the `/api/scout-watchdog/health` endpoint to retrieve a system health report.
3.  (Optional) Simulate an error by manually calling `/api/scout-watchdog/analyze-error` with a critical error message.
4.  Check the `/api/scout-watchdog/alerts` and `/api/scout-watchdog/suggested-fixes` endpoints to see detected issues and proposed solutions.
5.  If SOD is configured, verify that critical alerts are dispatched to your configured channels (e.g., Slack, email).
