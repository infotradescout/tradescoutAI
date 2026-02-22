# Scout Outbound Dispatcher (SOD) - Internal Documentation

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: February 21, 2026

## 1. Overview

The Scout Outbound Dispatcher (SOD) transforms Scout into an **"Intelligence Broadcaster"**, enabling it to proactively push real-time intelligence, alerts, and data to various internal and external systems. This moves Scout beyond reactive responses to proactive engagement, ensuring critical insights reach the right stakeholders immediately.

**Base URL**: `/api/scout-outbound-dispatcher`

## 2. Core Concepts

### 2.1. Scout Outbound Events

These are the structured data packets that Scout dispatches. Each event has a `type`, `priority`, `source`, and a `payload` containing the actual intelligence.

| Field | Type | Description |
| :--- | :--- | :--- |
| `event_id` | `string` | Unique identifier for the event. |
| `event_type` | `ScoutEventType` | Categorization of the event (e.g., `marketplace_trend`, `contractor_alert`). |
| `priority` | `"critical" \| "high" \| "medium" \| "low"` | The urgency of the event. |
| `timestamp` | `number` | Unix timestamp when the event was generated. |
| `source` | `"marketplace" \| "contractor" \| "community" \| "analysis"` | Origin of the event within TradeScout. |
| `payload` | `Record<string, any>` | The actual data or intelligence being dispatched. |
| `metadata` | `object` | Additional contextual information (e.g., `project_id`, `user_id`, `tags`). |

### 2.2. Dispatch Channels

SOD supports various channels for dispatching events:

| Channel Type | Description | Typical Endpoint Example |
| :--- | :--- | :--- |
| `webhook` | Generic HTTP POST to any URL. Ideal for custom integrations. | `https://your-internal-service.com/webhook` |
| `slack` | Posts messages to Slack channels or direct messages. | `https://hooks.slack.com/services/...` |
| `discord` | Posts messages to Discord servers. | `https://discord.com/api/webhooks/...` |
| `email` | Sends email alerts to specified recipients. | `recipient@example.com` |
| `crm` | Syncs data or triggers actions in external CRM systems. | `https://your-crm-api.com/data-sync` |

### 2.3. Dispatch Configuration

Each dispatch channel is configured with filters to ensure only relevant events are sent.

| Field | Type | Description |
| :--- | :--- | :--- |
| `channel_type` | `string` | Type of the dispatch channel. |
| `enabled` | `boolean` | Whether the channel is active. |
| `endpoint` | `string` | The URL or recipient for the channel. |
| `api_key` | `string?` | Optional API key for authentication with the endpoint. |
| `event_filters` | `object` | Defines which events to dispatch. |
| `event_filters.event_types` | `ScoutEventType[]` | Array of event types to listen for. |
| `event_filters.min_priority` | `"critical" \| "high" \| "medium" \| "low"` | Minimum priority level for events to be dispatched. |
| `event_filters.tags` | `string[]?` | Optional array of tags; event must have at least one matching tag. |
| `retry_policy` | `object` | Defines how to handle failed dispatches. |
| `retry_policy.max_retries` | `number` | Maximum number of retry attempts. |
| `retry_policy.backoff_ms` | `number` | Initial backoff delay in milliseconds. |

## 3. Endpoints

### 3.1. Register Channel

Registers a new outbound dispatch channel.

- **Endpoint**: `POST /register-channel`
- **Request Body**: `DispatchConfig` object (excluding `channel_id` and `enabled`)
- **Success Response (201)**:
```json
{
  "success": true,
  "channel_id": "webhook_a1b2c3d4",
  "message": "Dispatch channel registered: webhook"
}
```

### 3.2. Unregister Channel

Removes an existing dispatch channel.

- **Endpoint**: `DELETE /unregister-channel/:channelId`
- **Success Response (200)**:
```json
{
  "success": true,
  "message": "Dispatch channel unregistered: webhook_a1b2c3d4"
}
```

### 3.3. List Channels

Retrieves a list of all registered dispatch channels.

- **Endpoint**: `GET /channels`
- **Success Response (200)**:
```json
{
  "success": true,
  "channels_count": 1,
  "channels": [
    {
      "channel_id": "webhook_a1b2c3d4",
      "channel_type": "webhook",
      "endpoint": "https://your-internal-service.com/webhook",
      "enabled": true
    }
  ]
}
```

### 3.4. Queue Event

Queues an event for dispatch to all matching channels. This is the primary method for Scout to push intelligence.

- **Endpoint**: `POST /queue-event`
- **Request Body**: `ScoutOutboundEvent` object (excluding `event_id` and `timestamp`)
- **Success Response (201)**:
```json
{
  "success": true,
  "event_id": "evt_1677000000000_e5f6g7h8",
  "message": "Event queued for dispatch"
}
```

### 3.5. Get History

Retrieves a history of recent dispatch attempts.

- **Endpoint**: `GET /history?limit=10`
- **Query Parameters**: `limit` (optional, default 100)
- **Success Response (200)**:
```json
{
  "success": true,
  "dispatches_count": 1,
  "dispatches": [
    {
      "dispatch_id": "disp_1677000000000_i9j0k1l2",
      "channel_type": "webhook",
      "endpoint": "https://your-internal-service.com/webhook",
      "success": true,
      "status_code": 200,
      "retry_count": 0,
      "timestamp": 1677000000000,
      "response_time_ms": 45
    }
  ]
}
```

### 3.6. Get Statistics

Retrieves statistics about the SOD, including channel counts and dispatch success rates.

- **Endpoint**: `GET /statistics`
- **Success Response (200)**:
```json
{
  "success": true,
  "statistics": {
    "total_channels": 1,
    "enabled_channels": 1,
    "queued_events": 0,
    "dispatch_history_size": 1,
    "success_rate": 100
  }
}
```

### 3.7. Test Dispatch

Queues a test event to verify a channel configuration.

- **Endpoint**: `POST /test-dispatch`
- **Request Body**:
```json
{
  "channel_type": "webhook",
  "endpoint": "https://your-test-webhook.com"
}
```
- **Success Response (200)**:
```json
{
  "success": true,
  "event_id": "evt_1677000000000_m3n4o5p6",
  "message": "Test event queued for dispatch to webhook"
}
```

## 4. Integration with Scout Agent Council

The `ScoutProactiveAlerts` service (integrated with the Agent Council) automatically generates and queues events with the SOD. This means that as Scout detects marketplace trends, contractor risks, or community insights, these are automatically broadcast to configured channels.

## 5. Environment Variables

While the SOD itself doesn't require specific environment variables for its core functionality, individual dispatch channels (e.g., Slack, Discord) may require API keys or tokens to be configured in your environment for successful operation.

## 6. Security Considerations

- **Endpoint Security**: Ensure that any webhook endpoints you register are secure and can handle incoming POST requests safely.
- **API Keys**: Store API keys for external services securely (e.g., in environment variables or a secrets manager).
- **Event Filtering**: Configure event filters carefully to prevent sensitive information from being dispatched to inappropriate channels.

## 7. Verification

To verify the SOD functionality:

1.  Start your TradeScout application.
2.  Register a test webhook channel using the `POST /register-channel` endpoint (e.g., to a [Webhook.site](https://webhook.site) URL).
3.  Queue a test event using the `POST /queue-event` endpoint or trigger a proactive alert via Scout.
4.  Check the webhook.site to confirm receipt of the event.
5.  Review the `/history` and `/statistics` endpoints to monitor dispatch activity.
