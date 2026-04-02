// client/src/scout/scoutIntegrationDemo.ts
/**
 * Demo: How to use the tool layer in Scout responses
 *
 * This shows the pattern for wiring tools into Scout's conversation flow.
 * Copy this pattern when adding new tool-backed responses.
 */

import {
  searchContractors,
  searchMarketplace,
  type ContractorResult,
  type MarketplaceResult,
} from "../agent/tools/scoutTools";
import type { ScoutAction, ScoutCluster, ScoutMessage, ScoutToolResult } from "./state";

/**
 * Example: When Scout detects "find contractors" intent
 */
export async function handleFindContractorsIntent(
  userMessage: string,
  context: { userId?: string; state?: string; county?: string }
): Promise<{ message: ScoutMessage; actions: ScoutAction[] }> {
  // Extract params from user message (in real code, use NLP or server parsing)
  const trade = extractTrade(userMessage); // e.g., "plumber"
  const urgency = userMessage.toLowerCase().includes("urgent") ? "available" : "any";

  // Call the tool with retries + telemetry
  const result = await searchContractors(
    {
      trade,
      state: context.state,
      county: context.county,
      availability: urgency as any,
      limit: 5,
      sort: "rating",
    },
    { userId: context.userId, intent: "find_contractors" }
  );

  // Build the message based on tool result
  if (!result.success) {
    return {
      message: {
        id: `m_${Date.now()}`,
        role: "assistant",
        content: `I ran into an issue searching for ${trade}s: ${result.error?.message || "unknown error"}. Please try again or refine your search.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "contractor_search",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      actions: [],
    };
  }

  const contractors: ContractorResult[] = Array.isArray(result.data) ? result.data : [];

  // Build clusters for each contractor
  const clusters: ScoutCluster[] = contractors.slice(0, 3).map((c: ContractorResult) => ({
    id: `contractor-${c.id}`,
    title: c.name,
    kind: "pros" as const,
    body: `${c.trade} • Trust (CVS): ${(c as any).cvsScore ?? (c as any).cvs ?? (c as any).rating ?? "pending"} • ${(c as any).recommendationCount ?? (c as any).recommendationsCount ?? (c as any).reviewCount ?? 0} recs • ${c.location}`,
    primaryAction: {
      type: "NAVIGATE",
      label: "View profile",
      to: c.profileUrl,
    },
    actions: [
      {
        type: "ASK_SCOUT",
        label: "Tell me more",
        prompt: `Tell me more about ${c.name}`,
      },
      {
        type: "OPEN_FLOATING_NOTE",
        label: "Save to notes",
        payload: { noteId: "quick" },
      },
    ],
  }));

  const message: ScoutMessage = {
    id: `m_${Date.now()}`,
    role: "assistant",
    content: `I found ${contractors.length} ${trade}${contractors.length !== 1 ? "s" : ""} near you. Here are the top-rated pros:`,
    timestamp: new Date().toISOString(),
    clusters,
    navTarget: "/contractors",
    toolResult: {
      tool: "contractor_search",
      success: true,
      data: contractors,
      durationMs: result.telemetry.durationMs,
    },
    memoryDelta: {
      lastViewedTrade: trade,
      lastIntent: "find_contractors",
    },
  };

  const actions: ScoutAction[] = [
    {
      type: "NAVIGATE",
      label: "Browse all contractors",
      to: "/contractors",
    },
  ];

  return { message, actions };
}

/**
 * Example: When Scout detects "search marketplace" intent
 */
export async function handleMarketplaceSearchIntent(
  userMessage: string,
  context: { userId?: string; state?: string }
): Promise<{ message: ScoutMessage; actions: ScoutAction[] }> {
  const query = extractSearchQuery(userMessage);
  const category = extractCategory(userMessage);

  const result = await searchMarketplace(
    {
      query,
      category,
      location: context.state,
      sortBy: "recent",
      limit: 5,
    },
    { userId: context.userId, intent: "marketplace_search" }
  );

  if (!result.success) {
    return {
      message: {
        id: `m_${Date.now()}`,
        role: "assistant",
        content: `I couldn't search the marketplace right now: ${result.error?.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "marketplace_search",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      actions: [],
    };
  }

  const listings: MarketplaceResult[] = Array.isArray(result.data) ? result.data : [];

  const clusters: ScoutCluster[] = listings.slice(0, 3).map((listing) => ({
    id: `listing-${listing.id}`,
    title: listing.title,
    kind: "marketplace" as const,
    body: `$${listing.price} • ${listing.condition} • ${listing.location}\n${listing.description.slice(0, 100)}...`,
    primaryAction: {
      type: "NAVIGATE",
      label: "View listing",
      to: listing.listingUrl,
    },
  }));

  const message: ScoutMessage = {
    id: `m_${Date.now()}`,
    role: "assistant",
    content: `I found ${listings.length} listings matching "${query}". Here's what's available:`,
    timestamp: new Date().toISOString(),
    clusters,
    navTarget: "/exchange",
    toolResult: {
      tool: "marketplace_search",
      success: true,
      data: listings,
      durationMs: result.telemetry.durationMs,
    },
    memoryDelta: {
      lastIntent: "marketplace_search",
    },
  };

  const actions: ScoutAction[] = [
    {
      type: "NAVIGATE",
      label: "Browse marketplace",
      to: "/exchange",
    },
  ];

  return { message, actions };
}

/**
 * Example: When Scout creates a note
 */
export async function handleCreateNoteIntent(
  content: string,
  context: { userId?: string }
): Promise<{ message: ScoutMessage; actions: ScoutAction[] }> {
  const result = await createNote(
    {
      content,
      type: "quick",
      title: "Scout Note",
    },
    { userId: context.userId, intent: "create_note" }
  );

  if (!result.success) {
    return {
      message: {
        id: `m_${Date.now()}`,
        role: "assistant",
        content: `I couldn't save that note: ${result.error?.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        toolResult: {
          tool: "create_note",
          success: false,
          error: result.error?.message,
          durationMs: result.telemetry.durationMs,
        },
      },
      actions: [],
    };
  }

  const note = result.data!;

  const message: ScoutMessage = {
    id: `m_${Date.now()}`,
    role: "assistant",
    content: `I saved that to your notes: "${note.title}".`,
    timestamp: new Date().toISOString(),
    navTarget: note.noteUrl,
    toolResult: {
      tool: "create_note",
      success: true,
      data: note,
      durationMs: result.telemetry.durationMs,
    },
  };

  const actions: ScoutAction[] = [
    {
      type: "NAVIGATE",
      label: "Open notes",
      to: "/notes",
    },
  ];

  return { message, actions };
}

// Helper utilities (in real code, these would use NLP or server parsing)
function extractTrade(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("plumber")) return "plumber";
  if (lower.includes("electrician")) return "electrician";
  if (lower.includes("hvac")) return "hvac";
  if (lower.includes("roofer") || lower.includes("roofing")) return "roofer";
  return "contractor";
}

function extractSearchQuery(message: string): string {
  // In real code, parse the query properly
  const match = message.match(/find|search|looking for (.+)/i);
  return match ? match[1].trim() : message;
}

function extractCategory(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("furniture")) return "furniture";
  if (lower.includes("tools")) return "tools";
  if (lower.includes("vehicle") || lower.includes("car")) return "vehicles";
  return undefined;
}
import { createNote } from "@/agent/tools/scoutMutations";
