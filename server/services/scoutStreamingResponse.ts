/**
 * Scout Streaming Response Handler
 *
 * Enables real-time streaming of Scout responses for faster perceived performance.
 * Users see answers appearing in real-time instead of waiting for the full response.
 *
 * Supports:
 * - Server-Sent Events (SSE) for browser streaming
 * - Chunked transfer encoding for HTTP streaming
 * - Progress indicators (thinking, searching, synthesizing)
 */

import { Response } from "express";

export interface StreamChunk {
  type: "thinking" | "searching" | "synthesizing" | "content" | "source" | "warning" | "complete" | "error";
  content?: string;
  source?: string;
  timestamp?: string;
}

/**
 * Send a stream chunk as Server-Sent Event (SSE)
 */
export function sendStreamChunk(res: Response, chunk: StreamChunk): void {
  const data = JSON.stringify(chunk);
  res.write(`data: ${data}\n\n`);
}

/**
 * Initialize streaming response with SSE headers
 */
export function initializeStreamingResponse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

/**
 * Send a thinking indicator (shows Scout is processing)
 */
export function sendThinkingIndicator(res: Response, message: string = "Scout is thinking..."): void {
  sendStreamChunk(res, {
    type: "thinking",
    content: message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a search indicator (shows Scout is searching)
 */
export function sendSearchingIndicator(res: Response, query: string): void {
  sendStreamChunk(res, {
    type: "searching",
    content: `Searching for: ${query}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a synthesis indicator (shows Scout is combining sources)
 */
export function sendSynthesizingIndicator(res: Response, sources: string[]): void {
  sendStreamChunk(res, {
    type: "synthesizing",
    content: `Synthesizing from ${sources.length} sources...`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Stream content chunks (the actual answer)
 */
export function streamContent(res: Response, content: string, chunkSize: number = 50): void {
  // Split content into chunks and stream them
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.substring(i, i + chunkSize);
    sendStreamChunk(res, {
      type: "content",
      content: chunk,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Stream source information
 */
export function streamSource(res: Response, source: string, confidence: "high" | "medium" | "low"): void {
  sendStreamChunk(res, {
    type: "source",
    source,
    content: confidence,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Stream a warning or disclaimer
 */
export function streamWarning(res: Response, warning: string): void {
  sendStreamChunk(res, {
    type: "warning",
    content: warning,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Signal completion of stream
 */
export function completeStream(res: Response, metadata?: any): void {
  sendStreamChunk(res, {
    type: "complete",
    content: "Response complete",
    timestamp: new Date().toISOString(),
  });

  if (metadata) {
    res.write(`data: ${JSON.stringify({ type: "metadata", ...metadata })}\n\n`);
  }

  res.end();
}

/**
 * Send an error through the stream
 */
export function streamError(res: Response, error: string, code?: string): void {
  sendStreamChunk(res, {
    type: "error",
    content: error,
    timestamp: new Date().toISOString(),
  });

  res.end();
}

/**
 * Build a full streaming response with all components
 */
export async function buildStreamingScoutResponse(
  res: Response,
  options: {
    query: string;
    sources: string[];
    sourceBreakdown: { knowledge?: boolean; local?: boolean; webSearch?: boolean };
    llmResponse: string;
    disclaimers: string[];
    warnings?: string[];
    provider: string;
  }
): Promise<void> {
  initializeStreamingResponse(res);

  try {
    // 1. Show thinking indicator
    sendThinkingIndicator(res, "Scout is analyzing your question...");

    // 2. Show search indicator if web search is enabled
    if (options.sourceBreakdown.webSearch) {
      sendSearchingIndicator(res, options.query);
    }

    // 3. Show synthesis indicator
    sendSynthesizingIndicator(res, options.sources);

    // 4. Stream the main content
    streamContent(res, options.llmResponse, 100);

    // 5. Stream source information
    for (const source of options.sources) {
      streamSource(res, source, "high");
    }

    // 6. Stream disclaimers
    for (const disclaimer of options.disclaimers) {
      streamWarning(res, disclaimer);
    }

    // 7. Stream warnings if any
    if (options.warnings) {
      for (const warning of options.warnings) {
        streamWarning(res, warning);
      }
    }

    // 8. Complete the stream
    completeStream(res, {
      provider: options.provider,
      scoutVersion: "2.0",
      streamedAt: new Date().toISOString(),
    });
  } catch (error) {
    streamError(res, (error as Error).message);
  }
}
