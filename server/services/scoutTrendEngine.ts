import { pool } from "../db";
import { LisaStoredFinding } from "../../shared/lisa";

interface HistoricalDataPoint {
  value: number;
  timestamp: Date;
}

export async function getHistoricalScoutData(
  scoutType: string,
  countyFips?: string,
  trade?: string,
  limit: number = 30 // Default to last 30 data points
): Promise<HistoricalDataPoint[]> {
  let query = `
    SELECT value_numeric, created_at
    FROM scout_lisa_findings
    WHERE scout_type = $1
      AND value_numeric IS NOT NULL
  `;
  const params: (string | number)[] = [scoutType];
  let paramIndex = 2;

  if (countyFips) {
    query += ` AND county_fips = $${paramIndex++}`;
    params.push(countyFips);
  }
  if (trade) {
    query += ` AND trade = $${paramIndex++}`;
    params.push(trade);
  }

  query += `
    ORDER BY created_at DESC
    LIMIT $${paramIndex++}
  `;
  params.push(limit);

  const result = await pool.query(query, params);

  return result.rows.map((row) => ({
    value: parseFloat(row.value_numeric),
    timestamp: new Date(row.created_at),
  }));
}

export interface TrendAnalysisResult {
  trendDirection: "up" | "down" | "stable";
  trendMagnitude: number; // e.g., percentage change
  dataPointsUsed: number;
}

export function analyzeTrend(data: HistoricalDataPoint[]): TrendAnalysisResult {
  if (data.length < 2) {
    return {
      trendDirection: "stable",
      trendMagnitude: 0,
      dataPointsUsed: data.length,
    };
  }

  // Sort data by timestamp in ascending order for trend calculation
  const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const latestValue = sortedData[sortedData.length - 1].value;
  const oldestValue = sortedData[0].value;

  if (oldestValue === 0) {
    // Avoid division by zero, consider it stable if no change from zero
    return {
      trendDirection: latestValue > 0 ? "up" : "stable",
      trendMagnitude: latestValue > 0 ? Infinity : 0, // Or a very large number
      dataPointsUsed: sortedData.length,
    };
  }

  const percentageChange = ((latestValue - oldestValue) / oldestValue) * 100;

  let trendDirection: "up" | "down" | "stable" = "stable";
  if (percentageChange > 0.5) { // Threshold for 'up' trend
    trendDirection = "up";
  } else if (percentageChange < -0.5) { // Threshold for 'down' trend
    trendDirection = "down";
  }

  return {
    trendDirection,
    trendMagnitude: parseFloat(percentageChange.toFixed(2)),
    dataPointsUsed: sortedData.length,
  };
}

/**
 * Orchestrates trend analysis for a new scout finding.
 * Retrieves historical data, calculates trend, and returns trend metadata.
 */
export async function getScoutTrendMetadata(
  scoutType: string,
  countyFips?: string,
  trade?: string
): Promise<{
  valueNumeric?: number;
  valueText?: string;
  trendDirection?: "up" | "down" | "stable";
  trendMagnitude?: number;
}> {
  const historicalData = await getHistoricalScoutData(scoutType, countyFips, trade);
  const trend = analyzeTrend(historicalData);

  // For now, we'll just return the trend. The actual valueNumeric/valueText will come from the current finding.
  return {
    trendDirection: trend.trendDirection,
    trendMagnitude: trend.trendMagnitude,
  };
}
