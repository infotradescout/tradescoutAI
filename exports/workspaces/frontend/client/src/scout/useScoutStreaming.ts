/**
 * useScoutStreaming - React hook for streaming Scout responses
 *
 * Enables real-time streaming of Scout responses using Server-Sent Events (SSE).
 * Falls back to regular fetch if streaming is not available.
 */

import { useState, useCallback } from "react";

export interface StreamChunk {
  type: "thinking" | "searching" | "synthesizing" | "complete" | "error";
  content?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ScoutStreamingOptions {
  enableStreaming?: boolean;
  onProgress?: (stage: string) => void;
  onChunk?: (chunk: Partial<StreamChunk>) => void;
  onComplete?: (response: any) => void;
  onError?: (error: string) => void;
}

export function useScoutStreaming() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("idle");

  const sendMessage = useCallback(
    async (payload: any, options: ScoutStreamingOptions = {}): Promise<any> => {
      const { enableStreaming = true, onProgress, onChunk, onComplete, onError } = options;

      setIsLoading(true);
      setError(null);
      setProgress("connecting");

      try {
        // Determine if we should use streaming
        const useStream =
          enableStreaming && typeof EventSource !== "undefined" && typeof fetch !== "undefined";

        if (useStream) {
          return await streamingFetch(payload, {
            onProgress: (stage) => {
              setProgress(stage);
              onProgress?.(stage);
            },
            onChunk,
            onComplete,
            onError: (err) => {
              setError(err);
              onError?.(err);
            },
          });
        } else {
          // Fallback to regular fetch
          return await regularFetch(payload, {
            onProgress: (stage) => {
              setProgress(stage);
              onProgress?.(stage);
            },
            onComplete,
            onError: (err) => {
              setError(err);
              onError?.(err);
            },
          });
        }
      } finally {
        setIsLoading(false);
        setProgress("idle");
      }
    },
    []
  );

  return {
    sendMessage,
    isLoading,
    error,
    progress,
  };
}

/**
 * Stream a Scout request using Server-Sent Events
 */
async function streamingFetch(
  payload: any,
  handlers: {
    onProgress?: (stage: string) => void;
    onChunk?: (chunk: Partial<StreamChunk>) => void;
    onComplete?: (response: any) => void;
    onError?: (error: string) => void;
  }
): Promise<any> {
  const { onProgress, onChunk, onComplete, onError } = handlers;

  try {
    onProgress?.("thinking");

    const response = await fetch("/api/scout?stream=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-stream": "true",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResponse: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));

            // Update progress
            if (chunk.type === "thinking") {
              onProgress?.("thinking");
            } else if (chunk.type === "searching") {
              onProgress?.("searching");
            } else if (chunk.type === "synthesizing") {
              onProgress?.("synthesizing");
            }

            // Send chunk to handler
            onChunk?.(chunk);

            // Extract final response
            if (chunk.type === "complete" && chunk.content) {
              try {
                finalResponse = JSON.parse(chunk.content);
              } catch (e) {
                finalResponse = chunk.content;
              }
            }
          } catch (e) {
            console.warn("Failed to parse SSE chunk:", e);
          }
        }
      }
    }

    onProgress?.("complete");
    onComplete?.(finalResponse);
    return finalResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onError?.(errorMessage);
    throw error;
  }
}

/**
 * Fallback: Regular fetch without streaming
 */
async function regularFetch(
  payload: any,
  handlers: {
    onProgress?: (stage: string) => void;
    onComplete?: (response: any) => void;
    onError?: (error: string) => void;
  }
): Promise<any> {
  const { onProgress, onComplete, onError } = handlers;

  try {
    onProgress?.("thinking");

    const response = await fetch("/api/scout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    onProgress?.("synthesizing");
    const data = await response.json();

    onProgress?.("complete");
    onComplete?.(data);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onError?.(errorMessage);
    throw error;
  }
}
