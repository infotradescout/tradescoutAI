/**
 * Example: How to use Scout tools in ScoutOS
 * 
 * This shows the before/after of integrating the tool layer.
 */

import { searchContractors, createNote, createProject } from "@/agent/tools/scoutTools";
import type { ScoutMessage, ScoutCluster } from "./state";

/* ======================== BEFORE (old pattern) ======================== */

// Old: ad-hoc fetch with no retries, timeouts, or telemetry
async function oldSearchContractors_EXAMPLE(trade: string, state: string) {
  try {
    const res = await fetch(`/api/contractors/search?trade=${trade}&state=${state}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch (err) {
    console.error("Contractor search failed:", err);
    return [];
  }
}

/* ======================== AFTER (new tool pattern) ======================== */

/**
 * Example: Convert a user request into a tool call and render results.
 * 
 * @param userMessage - The user's request (e.g., "Find HVAC contractors in Texas")
 * @param userId - Current user ID for context
 * @returns A ScoutMessage with tool results and actions
 */
export async function handleContractorSearchWithTools(
  userMessage: string,
  userId?: string
): Promise<{ message: ScoutMessage; clusters: ScoutCluster[] }> {
  // Parse user intent (in production, use LLM to extract params)
  const lowerMsg = userMessage.toLowerCase();
  const trade = lowerMsg.includes("hvac")
    ? "hvac"
    : lowerMsg.includes("plumber")
    ? "plumber"
    : lowerMsg.includes("electrician")
    ? "electrician"
    : undefined;

  const state = lowerMsg.includes("texas") || lowerMsg.includes("tx")
    ? "TX"
    : lowerMsg.includes("california") || lowerMsg.includes("ca")
    ? "CA"
    : undefined;

  // Run the tool with retries, timeouts, telemetry
  const result = await searchContractors(
    { trade, state, limit: 5, sort: "rating" },
    { userId, intent: "search_contractors" }
  );

  if (!result.success) {
    // Tool failed after retries
    return {
      message: {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: `I ran into an issue searching for contractors: ${result.error?.message || "Unknown error"}. Please try again.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "contractor_search",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      clusters: [],
    };
  }

  // Tool succeeded
  const contractors: any[] = Array.isArray(result.data) ? result.data : [];

  if (contractors.length === 0) {
    return {
      message: {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: trade && state
          ? `No ${trade} contractors found in ${state} right now. Try expanding your search or checking back later.`
          : "No contractors found matching your criteria.",
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "contractor_search",
          success: true,
          data: [],
          durationMs: result.telemetry.durationMs,
        },
      },
      clusters: [],
    };
  }

  // Build a cluster with contractor results
  const cluster: ScoutCluster = {
    id: `contractors-${Date.now()}`,
    title: trade ? `Top ${trade.toUpperCase()} contractors` : "Top contractors",
    kind: "pros",
    body: `Found ${contractors.length} professionals near you.`,
    items: contractors.map((c: any) => ({
      id: c.id,
      label: `${c.name} · ${c.rating}⭐ (${c.reviewCount} reviews)`,
      description: c.location,
    })),
    actions: contractors.slice(0, 3).map((c: any) => ({
      type: "NAVIGATE",
      label: `View ${c.name}`,
      to: c.profileUrl,
    })),
  };

  return {
    message: {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: `Here are ${contractors.length} ${trade || "local"} professionals I found:`,
      timestamp: new Date().toISOString(),
      navTarget: "/contractors",
      toolResult: {
        tool: "contractor_search",
        success: true,
        data: contractors,
        durationMs: result.telemetry.durationMs,
      },
      memoryDelta: {
        lastViewedTrade: trade,
        lastIntent: "search_contractors",
      },
    },
    clusters: [cluster],
  };
}

/**
 * Example: Create a note from a user request.
 */
export async function handleCreateNoteWithTools(
  content: string,
  userId?: string,
  jobId?: string
): Promise<{ message: ScoutMessage; clusters: ScoutCluster[] }> {
  const result = await createNote(
    { content, type: "quick", relatedJobId: jobId },
    { userId, intent: "create_note", jobId }
  );

  if (!result.success) {
    return {
      message: {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: `Failed to create note: ${result.error?.message || "Unknown error"}.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "create_note",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      clusters: [],
    };
  }

  const note: any = result.data;

  return {
    message: {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: `I've saved that to your notes.`,
      timestamp: new Date().toISOString(),
      navTarget: note?.noteUrl,
      toolResult: {
        tool: "create_note",
        success: true,
        data: note,
        durationMs: result.telemetry.durationMs,
      },
    },
    clusters: [
      {
        id: `note-${Date.now()}`,
        title: "Note saved",
        kind: "generic",
        body: note?.content?.slice(0, 100),
        primaryAction: {
          type: "NAVIGATE",
          label: "Open Notes",
          to: note?.noteUrl || "/notes",
        },
      },
    ],
  };
}

/**
 * Example: Create a project from a user request.
 */
export async function handleCreateProjectWithTools(
  title: string,
  description: string,
  userId?: string
): Promise<{ message: ScoutMessage; clusters: ScoutCluster[] }> {
  const result = await createProject(
    { title, description, priority: "medium" },
    { userId, intent: "create_project" }
  );

  if (!result.success) {
    return {
      message: {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: `Failed to create project: ${result.error?.message || "Unknown error"}.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "create_project",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      clusters: [],
    };
  }

  const project: any = result.data;

  return {
    message: {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: `I've created a trackable project for you: "${project?.title}".`,
      timestamp: new Date().toISOString(),
      navTarget: project?.projectUrl,
      toolResult: {
        tool: "create_project",
        success: true,
        data: project,
        durationMs: result.telemetry.durationMs,
      },
      memoryDelta: {
        lastJobId: project?.id,
        lastIntent: "create_project",
      },
    },
    clusters: [
      {
        id: `project-${Date.now()}`,
        title: project?.title || "New project",
        kind: "projects",
        body: project?.description?.slice(0, 150),
        primaryAction: {
          type: "NAVIGATE",
          label: "Open Deal Room",
          to: project?.projectUrl || "/projects",
          payload: { jobId: project?.id },
        },
      },
    ],
  };
}
