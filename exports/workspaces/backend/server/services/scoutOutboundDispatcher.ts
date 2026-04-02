/**
 * Scout Outbound Dispatcher (SOD)
 *
 * Proactively pushes Scout's intelligence, alerts, and data to external systems.
 * This transforms Scout from a "Data Factory" into an "Intelligence Broadcaster."
 *
 * Supported Dispatch Channels:
 * 1. Webhooks: Real-time HTTP pushes to registered endpoints
 * 2. Slack: Direct messages and channel posts
 * 3. Discord: Server messages and notifications
 * 4. Email: Alert notifications to stakeholders
 * 5. External CRM: Data sync to business tools
 */

import crypto from "crypto";

/**
 * Scout Outbound Event Types
 */
export type ScoutEventType =
  | "marketplace_trend"
  | "contractor_alert"
  | "community_insight"
  | "opportunity_detected"
  | "risk_detected"
  | "data_sync_required"
  | "vetting_complete"
  | "market_analysis_ready";

/**
 * Scout Outbound Event
 */
export interface ScoutOutboundEvent {
  event_id: string;
  event_type: ScoutEventType;
  priority: "critical" | "high" | "medium" | "low";
  timestamp: number;
  source: "marketplace" | "contractor" | "community" | "analysis";
  payload: Record<string, any>;
  metadata: {
    project_id?: string;
    user_id?: string;
    region?: string;
    tags: string[];
  };
}

/**
 * Dispatch Configuration for a Channel
 */
export interface DispatchConfig {
  channel_type: "webhook" | "slack" | "discord" | "email" | "crm";
  enabled: boolean;
  endpoint: string;
  api_key?: string;
  event_filters: {
    event_types: ScoutEventType[];
    min_priority: "critical" | "high" | "medium" | "low";
    tags?: string[];
  };
  retry_policy: {
    max_retries: number;
    backoff_ms: number;
  };
}

/**
 * Dispatch Result
 */
export interface DispatchResult {
  dispatch_id: string;
  channel_type: string;
  endpoint: string;
  success: boolean;
  status_code?: number;
  error?: string;
  retry_count: number;
  timestamp: number;
  response_time_ms: number;
}

/**
 * Scout Outbound Dispatcher Service
 */
export class ScoutOutboundDispatcher {
  private dispatchConfigs: Map<string, DispatchConfig> = new Map();
  private eventQueue: ScoutOutboundEvent[] = [];
  private dispatchHistory: DispatchResult[] = [];
  private maxHistorySize: number = 10000;

  constructor() {
    this.loadDispatchConfigs();
  }

  /**
   * Load dispatch configurations from environment or database
   */
  private loadDispatchConfigs(): void {
    // In a real implementation, this would load from a database
    // For now, we'll initialize with empty configs
    console.log("[SOD] Dispatch configurations loaded");
  }

  /**
   * Register a new dispatch channel
   */
  registerDispatchChannel(config: DispatchConfig): {
    success: boolean;
    channel_id?: string;
    error?: string;
  } {
    try {
      const channelId = `${config.channel_type}_${crypto.randomBytes(8).toString("hex")}`;

      if (!config.endpoint) {
        return {
          success: false,
          error: "Endpoint is required for dispatch configuration",
        };
      }

      this.dispatchConfigs.set(channelId, config);

      return {
        success: true,
        channel_id: channelId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to register dispatch channel",
      };
    }
  }

  /**
   * Unregister a dispatch channel
   */
  unregisterDispatchChannel(channelId: string): {
    success: boolean;
    error?: string;
  } {
    try {
      if (!this.dispatchConfigs.has(channelId)) {
        return {
          success: false,
          error: `Channel ${channelId} not found`,
        };
      }

      this.dispatchConfigs.delete(channelId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to unregister dispatch channel",
      };
    }
  }

  /**
   * Queue an outbound event for dispatch
   */
  queueEvent(event: Omit<ScoutOutboundEvent, "event_id" | "timestamp">): {
    success: boolean;
    event_id?: string;
    error?: string;
  } {
    try {
      const eventId = `evt_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

      const fullEvent: ScoutOutboundEvent = {
        ...event,
        event_id: eventId,
        timestamp: Date.now(),
      };

      this.eventQueue.push(fullEvent);

      // Immediately dispatch to matching channels
      this.dispatchEvent(fullEvent);

      return {
        success: true,
        event_id: eventId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue event",
      };
    }
  }

  /**
   * Dispatch an event to all matching channels
   */
  private async dispatchEvent(event: ScoutOutboundEvent): Promise<void> {
    for (const [channelId, config] of this.dispatchConfigs) {
      // Check if channel is enabled
      if (!config.enabled) {
        continue;
      }

      // Check if event matches filters
      if (!this.matchesEventFilters(event, config.event_filters)) {
        continue;
      }

      // Dispatch to channel
      this.dispatchToChannel(channelId, config, event);
    }
  }

  /**
   * Check if event matches dispatch filters
   */
  private matchesEventFilters(
    event: ScoutOutboundEvent,
    filters: DispatchConfig["event_filters"]
  ): boolean {
    // Check event type
    if (!filters.event_types.includes(event.event_type)) {
      return false;
    }

    // Check priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[event.priority] > priorityOrder[filters.min_priority]) {
      return false;
    }

    // Check tags
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some((tag) => event.metadata.tags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Dispatch event to a specific channel
   */
  private async dispatchToChannel(
    channelId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<void> {
    const dispatchId = `disp_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const startTime = Date.now();

    try {
      let result: DispatchResult;

      switch (config.channel_type) {
        case "webhook":
          result = await this.dispatchWebhook(dispatchId, config, event);
          break;
        case "slack":
          result = await this.dispatchSlack(dispatchId, config, event);
          break;
        case "discord":
          result = await this.dispatchDiscord(dispatchId, config, event);
          break;
        case "email":
          result = await this.dispatchEmail(dispatchId, config, event);
          break;
        case "crm":
          result = await this.dispatchCRM(dispatchId, config, event);
          break;
        default:
          result = {
            dispatch_id: dispatchId,
            channel_type: config.channel_type,
            endpoint: config.endpoint,
            success: false,
            error: `Unknown channel type: ${config.channel_type}`,
            retry_count: 0,
            timestamp: Date.now(),
            response_time_ms: Date.now() - startTime,
          };
      }

      // Store dispatch result
      this.storeDispatchResult(result);

      // Log dispatch
      console.log(
        `[SOD] Event ${event.event_id} dispatched to ${config.channel_type}: ${result.success ? "SUCCESS" : "FAILED"}`
      );
    } catch (error) {
      console.error(`[SOD] Dispatch error for channel ${channelId}:`, error);
    }
  }

  /**
   * Dispatch to webhook endpoint
   */
  private async dispatchWebhook(
    dispatchId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would make an actual HTTP request
      // For now, we'll simulate it
      const response = await this.simulateHttpRequest(config.endpoint, event);

      return {
        dispatch_id: dispatchId,
        channel_type: "webhook",
        endpoint: config.endpoint,
        success: response.ok,
        status_code: response.status,
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        dispatch_id: dispatchId,
        channel_type: "webhook",
        endpoint: config.endpoint,
        success: false,
        error: error instanceof Error ? error.message : "Webhook dispatch failed",
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispatch to Slack
   */
  private async dispatchSlack(
    dispatchId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // Format message for Slack
      const slackMessage = {
        text: `Scout Alert: ${event.event_type}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${event.event_type}* (${event.priority})`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: JSON.stringify(event.payload, null, 2),
            },
          },
        ],
      };

      // In a real implementation, this would call the Slack API
      // For now, we'll simulate it
      const response = await this.simulateHttpRequest(config.endpoint, slackMessage);

      return {
        dispatch_id: dispatchId,
        channel_type: "slack",
        endpoint: config.endpoint,
        success: response.ok,
        status_code: response.status,
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        dispatch_id: dispatchId,
        channel_type: "slack",
        endpoint: config.endpoint,
        success: false,
        error: error instanceof Error ? error.message : "Slack dispatch failed",
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispatch to Discord
   */
  private async dispatchDiscord(
    dispatchId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // Format message for Discord
      const discordMessage = {
        embeds: [
          {
            title: `Scout: ${event.event_type}`,
            description: JSON.stringify(event.payload, null, 2),
            color: event.priority === "critical" ? 15158332 : 3447003, // Red for critical, blue for others
            timestamp: new Date(event.timestamp).toISOString(),
          },
        ],
      };

      // In a real implementation, this would call the Discord API
      // For now, we'll simulate it
      const response = await this.simulateHttpRequest(config.endpoint, discordMessage);

      return {
        dispatch_id: dispatchId,
        channel_type: "discord",
        endpoint: config.endpoint,
        success: response.ok,
        status_code: response.status,
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        dispatch_id: dispatchId,
        channel_type: "discord",
        endpoint: config.endpoint,
        success: false,
        error: error instanceof Error ? error.message : "Discord dispatch failed",
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispatch to Email
   */
  private async dispatchEmail(
    dispatchId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would send an email via SMTP or email service
      // For now, we'll simulate it
      const emailPayload = {
        to: config.endpoint,
        subject: `Scout Alert: ${event.event_type}`,
        body: JSON.stringify(event.payload, null, 2),
      };

      const response = await this.simulateHttpRequest("email-service", emailPayload);

      return {
        dispatch_id: dispatchId,
        channel_type: "email",
        endpoint: config.endpoint,
        success: response.ok,
        status_code: response.status,
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        dispatch_id: dispatchId,
        channel_type: "email",
        endpoint: config.endpoint,
        success: false,
        error: error instanceof Error ? error.message : "Email dispatch failed",
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Dispatch to external CRM
   */
  private async dispatchCRM(
    dispatchId: string,
    config: DispatchConfig,
    event: ScoutOutboundEvent
  ): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would sync data to a CRM like Salesforce, HubSpot, etc.
      // For now, we'll simulate it
      const crmPayload = {
        event_type: event.event_type,
        data: event.payload,
        timestamp: event.timestamp,
      };

      const response = await this.simulateHttpRequest(config.endpoint, crmPayload);

      return {
        dispatch_id: dispatchId,
        channel_type: "crm",
        endpoint: config.endpoint,
        success: response.ok,
        status_code: response.status,
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        dispatch_id: dispatchId,
        channel_type: "crm",
        endpoint: config.endpoint,
        success: false,
        error: error instanceof Error ? error.message : "CRM dispatch failed",
        retry_count: 0,
        timestamp: Date.now(),
        response_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Simulate HTTP request (for testing)
   */
  private async simulateHttpRequest(
    endpoint: string,
    payload: any
  ): Promise<{ ok: boolean; status: number }> {
    // In a real implementation, this would make actual HTTP requests
    // For now, we'll simulate a successful response
    return {
      ok: true,
      status: 200,
    };
  }

  /**
   * Store dispatch result in history
   */
  private storeDispatchResult(result: DispatchResult): void {
    this.dispatchHistory.push(result);

    // Keep history size manageable
    if (this.dispatchHistory.length > this.maxHistorySize) {
      this.dispatchHistory = this.dispatchHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get dispatch history
   */
  getDispatchHistory(limit: number = 100): DispatchResult[] {
    return this.dispatchHistory.slice(-limit);
  }

  /**
   * Get registered dispatch channels
   */
  getDispatchChannels(): Array<{
    channel_id: string;
    channel_type: string;
    endpoint: string;
    enabled: boolean;
  }> {
    const channels = [];

    for (const [channelId, config] of this.dispatchConfigs) {
      channels.push({
        channel_id: channelId,
        channel_type: config.channel_type,
        endpoint: config.endpoint,
        enabled: config.enabled,
      });
    }

    return channels;
  }

  /**
   * Get dispatcher statistics
   */
  getStatistics(): {
    total_channels: number;
    enabled_channels: number;
    queued_events: number;
    dispatch_history_size: number;
    success_rate: number;
  } {
    const enabledChannels = Array.from(this.dispatchConfigs.values()).filter(
      (c) => c.enabled
    ).length;

    const successfulDispatches = this.dispatchHistory.filter((d) => d.success).length;
    const successRate =
      this.dispatchHistory.length > 0
        ? (successfulDispatches / this.dispatchHistory.length) * 100
        : 0;

    return {
      total_channels: this.dispatchConfigs.size,
      enabled_channels: enabledChannels,
      queued_events: this.eventQueue.length,
      dispatch_history_size: this.dispatchHistory.length,
      success_rate: Math.round(successRate * 100) / 100,
    };
  }
}

export default ScoutOutboundDispatcher;
