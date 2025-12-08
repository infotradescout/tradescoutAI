import axios from "axios";

/**
 * Minimal MealScout client for TradeScout controllers.
 * Uses a single action endpoint with bearer token auth.
 */
export async function mealscoutAction(action: string, params: Record<string, any> = {}) {
  if (!process.env.MEALSCOUT_API_TOKEN) {
    throw new Error("MEALSCOUT_API_TOKEN is not configured");
  }

  const res = await axios.post(
    "https://mealscout.yourdomain.com/api/actions",
    { action, params },
    {
      headers: {
        Authorization: `Bearer ${process.env.MEALSCOUT_API_TOKEN}`,
      },
      timeout: 15_000,
    }
  );

  return res.data;
}
