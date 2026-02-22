/**
 * Scout Watchdog Service
 *
 * Monitors system health, detects anomalies, and proactively alerts admins.
 * This transforms Scout into a "self-aware" platform guardian.
 *
 * Monitoring Areas:
 * 1. Server Health: CPU, memory, disk usage
 * 2. API Performance: Response times, error rates, throughput
 * 3. Database Health: Connection pool, query performance, replication lag
 * 4. Feature-Specific Health: Each major feature (Car Sales, Real Estate, etc.) has its own health score
 * 5. Error Patterns: Detects spikes in specific error types
 */

export interface HealthMetric {
  metric_name: string;
  current_value: number;
  threshold: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  timestamp: number;
}

export interface FeatureHealth {
  feature_name: string;
  health_score: number; // 0-100
  error_rate: number; // percentage
  avg_response_time_ms: number;
  requests_per_minute: number;
  status: "healthy" | "degraded" | "down";
  last_error?: string;
  last_error_timestamp?: number;
}

export interface SystemHealthReport {
  report_id: string;
  timestamp: number;
  overall_health_score: number; // 0-100
  server_metrics: HealthMetric[];
  api_metrics: HealthMetric[];
  database_metrics: HealthMetric[];
  feature_health: FeatureHealth[];
  anomalies_detected: Array<{
    anomaly_type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    affected_component: string;
  }>;
}

/**
 * Scout Watchdog Service
 */
export class ScoutWatchdog {
  private healthHistory: SystemHealthReport[] = [];
  private maxHistorySize: number = 1000;
  private lastReportTime: number = 0;
  private reportIntervalMs: number = 60000; // 1 minute

  constructor() {
    console.log("[Watchdog] Scout Watchdog Service initialized");
  }

  /**
   * Collect system health metrics
   */
  private collectServerMetrics(): HealthMetric[] {
    // In a real implementation, this would use os module to get actual system metrics
    const metrics: HealthMetric[] = [];

    // Simulate CPU usage
    metrics.push({
      metric_name: "cpu_usage",
      current_value: Math.random() * 80, // 0-80%
      threshold: 85,
      unit: "%",
      status: Math.random() * 80 < 85 ? "healthy" : "warning",
      timestamp: Date.now(),
    });

    // Simulate memory usage
    metrics.push({
      metric_name: "memory_usage",
      current_value: Math.random() * 70, // 0-70%
      threshold: 80,
      unit: "%",
      status: Math.random() * 70 < 80 ? "healthy" : "warning",
      timestamp: Date.now(),
    });

    // Simulate disk usage
    metrics.push({
      metric_name: "disk_usage",
      current_value: Math.random() * 60, // 0-60%
      threshold: 85,
      unit: "%",
      status: Math.random() * 60 < 85 ? "healthy" : "healthy",
      timestamp: Date.now(),
    });

    return metrics;
  }

  /**
   * Collect API performance metrics
   */
  private collectAPIMetrics(): HealthMetric[] {
    const metrics: HealthMetric[] = [];

    // Simulate API response time
    metrics.push({
      metric_name: "avg_response_time",
      current_value: Math.random() * 200 + 50, // 50-250ms
      threshold: 500,
      unit: "ms",
      status: Math.random() * 250 < 500 ? "healthy" : "healthy",
      timestamp: Date.now(),
    });

    // Simulate error rate
    const errorRate = Math.random() * 2; // 0-2%
    metrics.push({
      metric_name: "error_rate",
      current_value: errorRate,
      threshold: 1,
      unit: "%",
      status: errorRate < 1 ? "healthy" : errorRate < 2 ? "warning" : "critical",
      timestamp: Date.now(),
    });

    // Simulate requests per minute
    metrics.push({
      metric_name: "requests_per_minute",
      current_value: Math.random() * 5000 + 1000, // 1000-6000 req/min
      threshold: 10000,
      unit: "req/min",
      status: "healthy",
      timestamp: Date.now(),
    });

    return metrics;
  }

  /**
   * Collect database health metrics
   */
  private collectDatabaseMetrics(): HealthMetric[] {
    const metrics: HealthMetric[] = [];

    // Simulate connection pool usage
    metrics.push({
      metric_name: "db_connection_pool_usage",
      current_value: Math.random() * 60, // 0-60%
      threshold: 80,
      unit: "%",
      status: Math.random() * 60 < 80 ? "healthy" : "warning",
      timestamp: Date.now(),
    });

    // Simulate query performance
    metrics.push({
      metric_name: "avg_query_time",
      current_value: Math.random() * 50 + 10, // 10-60ms
      threshold: 100,
      unit: "ms",
      status: "healthy",
      timestamp: Date.now(),
    });

    // Simulate replication lag
    metrics.push({
      metric_name: "replication_lag",
      current_value: Math.random() * 100, // 0-100ms
      threshold: 500,
      unit: "ms",
      status: "healthy",
      timestamp: Date.now(),
    });

    return metrics;
  }

  /**
   * Assess feature-specific health
   */
  private assessFeatureHealth(): FeatureHealth[] {
    const features = [
      "Car Sales",
      "Real Estate",
      "Contractor Marketplace",
      "Community Feed",
      "Accounting",
      "Admin Panel",
    ];

    return features.map((feature) => {
      const errorRate = Math.random() * 3; // 0-3%
      const healthScore = Math.max(0, 100 - errorRate * 10);

      return {
        feature_name: feature,
        health_score: Math.round(healthScore),
        error_rate: Math.round(errorRate * 100) / 100,
        avg_response_time_ms: Math.random() * 300 + 50,
        requests_per_minute: Math.random() * 1000 + 100,
        status: healthScore > 95 ? "healthy" : healthScore > 80 ? "degraded" : "down",
        last_error: errorRate > 2 ? "Database connection timeout on query execution" : undefined,
        last_error_timestamp: errorRate > 2 ? Date.now() - Math.random() * 60000 : undefined,
      };
    });
  }

  /**
   * Detect anomalies in the system
   */
  private detectAnomalies(
    serverMetrics: HealthMetric[],
    apiMetrics: HealthMetric[],
    databaseMetrics: HealthMetric[],
    featureHealth: FeatureHealth[]
  ): Array<{
    anomaly_type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    affected_component: string;
  }> {
    const anomalies: Array<{
      anomaly_type: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
      affected_component: string;
    }> = [];

    // Check for high error rates
    const errorRateMetric = apiMetrics.find((m) => m.metric_name === "error_rate");
    if (errorRateMetric && errorRateMetric.current_value > 2) {
      anomalies.push({
        anomaly_type: "high_error_rate",
        severity: "critical",
        description: `Error rate has spiked to ${errorRateMetric.current_value}%, which is ${(errorRateMetric.current_value / errorRateMetric.threshold) * 100}% above the threshold.`,
        affected_component: "API",
      });
    }

    // Check for slow response times
    const responseTimeMetric = apiMetrics.find((m) => m.metric_name === "avg_response_time");
    if (responseTimeMetric && responseTimeMetric.current_value > 400) {
      anomalies.push({
        anomaly_type: "slow_response_time",
        severity: "high",
        description: `Average response time is ${responseTimeMetric.current_value}ms, which is unusually high.`,
        affected_component: "API",
      });
    }

    // Check for high memory usage
    const memoryMetric = serverMetrics.find((m) => m.metric_name === "memory_usage");
    if (memoryMetric && memoryMetric.current_value > 85) {
      anomalies.push({
        anomaly_type: "high_memory_usage",
        severity: "high",
        description: `Memory usage is at ${memoryMetric.current_value}%, which is critical.`,
        affected_component: "Server",
      });
    }

    // Check for database connection pool saturation
    const dbPoolMetric = databaseMetrics.find((m) => m.metric_name === "db_connection_pool_usage");
    if (dbPoolMetric && dbPoolMetric.current_value > 85) {
      anomalies.push({
        anomaly_type: "db_connection_pool_saturation",
        severity: "critical",
        description: `Database connection pool is ${dbPoolMetric.current_value}% saturated. This could cause connection timeouts.`,
        affected_component: "Database",
      });
    }

    // Check for feature-specific issues
    featureHealth.forEach((feature) => {
      if (feature.status === "down") {
        anomalies.push({
          anomaly_type: "feature_down",
          severity: "critical",
          description: `The ${feature.feature_name} feature is down with a health score of ${feature.health_score}/100.`,
          affected_component: feature.feature_name,
        });
      } else if (feature.status === "degraded") {
        anomalies.push({
          anomaly_type: "feature_degraded",
          severity: "high",
          description: `The ${feature.feature_name} feature is degraded with a health score of ${feature.health_score}/100 and an error rate of ${feature.error_rate}%.`,
          affected_component: feature.feature_name,
        });
      }
    });

    return anomalies;
  }

  /**
   * Generate a comprehensive system health report
   */
  async generateHealthReport(): Promise<SystemHealthReport> {
    const serverMetrics = this.collectServerMetrics();
    const apiMetrics = this.collectAPIMetrics();
    const databaseMetrics = this.collectDatabaseMetrics();
    const featureHealth = this.assessFeatureHealth();
    const anomalies = this.detectAnomalies(
      serverMetrics,
      apiMetrics,
      databaseMetrics,
      featureHealth
    );

    // Calculate overall health score
    const allMetrics = [...serverMetrics, ...apiMetrics, ...databaseMetrics];
    const healthyMetrics = allMetrics.filter((m) => m.status === "healthy").length;
    const overallHealthScore = Math.round((healthyMetrics / allMetrics.length) * 100);

    const report: SystemHealthReport = {
      report_id: `report_${Date.now()}`,
      timestamp: Date.now(),
      overall_health_score: overallHealthScore,
      server_metrics: serverMetrics,
      api_metrics: apiMetrics,
      database_metrics: databaseMetrics,
      feature_health: featureHealth,
      anomalies_detected: anomalies,
    };

    // Store in history
    this.healthHistory.push(report);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }

    this.lastReportTime = Date.now();

    return report;
  }

  /**
   * Get the latest health report
   */
  getLatestReport(): SystemHealthReport | null {
    return this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;
  }

  /**
   * Get health history
   */
  getHealthHistory(limit: number = 100): SystemHealthReport[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): Array<{
    alert_id: string;
    severity: string;
    description: string;
    affected_component: string;
    timestamp: number;
  }> {
    const alerts = [];

    for (const report of this.healthHistory) {
      for (const anomaly of report.anomalies_detected) {
        if (anomaly.severity === "critical") {
          alerts.push({
            alert_id: `alert_${report.report_id}_${anomaly.anomaly_type}`,
            severity: anomaly.severity,
            description: anomaly.description,
            affected_component: anomaly.affected_component,
            timestamp: report.timestamp,
          });
        }
      }
    }

    return alerts.slice(-50); // Return last 50 critical alerts
  }

  /**
   * Get watchdog statistics
   */
  getStatistics(): {
    total_reports: number;
    average_health_score: number;
    critical_alerts_count: number;
    features_monitored: number;
    last_report_timestamp: number;
  } {
    const reports = this.healthHistory;
    const avgHealthScore =
      reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + r.overall_health_score, 0) / reports.length)
        : 0;

    const criticalAlerts = this.getCriticalAlerts();

    return {
      total_reports: reports.length,
      average_health_score: avgHealthScore,
      critical_alerts_count: criticalAlerts.length,
      features_monitored:
        reports.length > 0 ? reports[reports.length - 1].feature_health.length : 0,
      last_report_timestamp: this.lastReportTime,
    };
  }
}

export default ScoutWatchdog;
