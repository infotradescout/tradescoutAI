import { createRequire as createVertexRequire } from "node:module";

const vertexRequire = createVertexRequire(import.meta.url);

let cachedModel: any | null = null;

function getVertexModel() {
  if (cachedModel) return cachedModel;

  const project = String(process.env.GOOGLE_PROJECT_ID || "").trim();
  const location = String(process.env.GOOGLE_VERTEX_LOCATION || "").trim();

  // Allow Render secrets mount by default without requiring env wiring.
  const credentialsPath =
    String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim() || "/etc/secrets/gcp-sa.json";
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }

  if (!project || !location) {
    throw new Error(
      "Vertex AI is not configured: GOOGLE_PROJECT_ID and GOOGLE_VERTEX_LOCATION are required."
    );
  }

  // Lazy-load to avoid hard failing local dev/test when deps aren't installed yet.
  // Render/CI will have the dependency installed from package-lock/package.json.
  const { VertexAI } = vertexRequire("@google-cloud/vertexai") as any;

  const vertex = new VertexAI({ project, location });
  cachedModel = vertex.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  return cachedModel;
}

function extractText(result: any): string {
  const response = result?.response ?? result;

  // Newer SDKs often provide a convenience helper.
  if (typeof response?.text === "function") {
    const t = response.text();
    if (typeof t === "string" && t.trim()) return t.trim();
  }

  const candidates = response?.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    for (const c of candidates) {
      const parts = c?.content?.parts;
      if (!Array.isArray(parts)) continue;
      const buf: string[] = [];
      for (const p of parts) {
        if (typeof p?.text === "string" && p.text.trim()) buf.push(p.text);
      }
      if (buf.length) return buf.join("\n").trim();
    }
  }

  return "";
}

export async function generateAIResponse(prompt: string): Promise<string> {
  try {
    const model = getVertexModel();

    const req = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    const result = await model.generateContent(req as any);
    const text = extractText(result);

    if (text) return text;
    return "Scout is thinking. Please try again in a moment.";
  } catch (err) {
    console.error("[VertexAI] generateAIResponse failed:", err);
    return "Scout is thinking. Please try again in a moment.";
  }
}
