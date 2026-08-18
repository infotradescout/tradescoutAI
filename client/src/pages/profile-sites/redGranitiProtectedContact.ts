import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";

export type ProtectedCallResult = {
  phone: string;
  tel: string;
};

export async function revealJwStoneProtectedCall(): Promise<ProtectedCallResult> {
  const response = await fetch(
    `/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-contact/reveal`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorityGate: "profile_direct_connect",
        decision: "call",
      }),
    }
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok || typeof json?.tel !== "string") {
    throw new Error("Calling is unavailable right now. Start a request instead.");
  }
  return {
    phone: String(json.phone || ""),
    tel: json.tel,
  };
}

export async function startJwStoneProtectedCall(): Promise<ProtectedCallResult> {
  const result = await revealJwStoneProtectedCall();
  window.location.href = result.tel;
  return result;
}
