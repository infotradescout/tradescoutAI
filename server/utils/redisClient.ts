import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;
let loggedRedisUnavailable = false;

function redisUrl(): string {
  return String(process.env.REDIS_URL || "").trim();
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl());
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      try {
        if (!redisClient) {
          redisClient = createClient({
            url: redisUrl(),
            socket: {
              reconnectStrategy: (retries: number) => Math.min(5000, retries * 100),
            },
          });

          redisClient.on("error", (error) => {
            console.warn("[redis] client error", error);
          });
        }

        if (!redisClient.isOpen) {
          await redisClient.connect();
        }

        loggedRedisUnavailable = false;
        return redisClient;
      } catch (error) {
        if (!loggedRedisUnavailable) {
          loggedRedisUnavailable = true;
          console.warn("[redis] unavailable; continuing with local fallbacks", error);
        }
        return null;
      } finally {
        redisConnectPromise = null;
      }
    })();
  }

  return redisConnectPromise;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch {
    try {
      await redisClient.disconnect();
    } catch {
      // Best effort; shutdown path must not crash.
    }
  } finally {
    redisClient = null;
  }
}
