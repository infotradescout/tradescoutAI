const apiBaseEnv = (import.meta as any).env?.VITE_SCOUT_API_BASE;

const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
};

const apiBase =
  apiBaseEnv ||
  (!isLocalHost() ? "https://www.thetradescout.com/api" : "/api");

const scoutEndpoint = `${apiBase.replace(/\/$/, "")}/scout`;

export type ScoutServerResponse = {
  message: string;
  suggestedActions?: string[];
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
};

export async function sendToScout(args: {
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}): Promise<ScoutServerResponse> {
  const res = await fetch(scoutEndpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: args.message,
      history: args.history,
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}
