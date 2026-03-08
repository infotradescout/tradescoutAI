import { describe, it, expect } from "vitest";
import {
  deriveDeterministicIntent,
  maybeHandleDeterministicIntent,
} from "../services/scoutDeterministicIntent";

describe("scoutDeterministicIntent", () => {
  describe("deriveDeterministicIntent", () => {
    it("detects send invoice intents", () => {
      expect(deriveDeterministicIntent("Can you send the invoice for this job?")).toBe(
        "send_invoice"
      );
      expect(deriveDeterministicIntent("invoice ready, please send")).toBe("send_invoice");
    });

    it("detects mark invoice paid intents", () => {
      expect(deriveDeterministicIntent("Mark this invoice paid")).toBe("mark_invoice_paid");
      expect(deriveDeterministicIntent("payment received, mark it paid")).toBe("mark_invoice_paid");
    });

    it("detects contract intents", () => {
      expect(deriveDeterministicIntent("Send the contract for this project")).toBe("send_contract");
      expect(deriveDeterministicIntent("I need to sign the contract")).toBe("sign_contract");
    });

    it("detects open jobs workspace intents", () => {
      expect(deriveDeterministicIntent("Open my jobs workspace")).toBe("open_deal_room");
      expect(deriveDeterministicIntent("open the project tracker")).toBe("open_deal_room");
    });

    it("returns null when no deterministic intent matches", () => {
      expect(deriveDeterministicIntent("How's the weather?")).toBeNull();
    });
  });

  describe("maybeHandleDeterministicIntent", () => {
    const baseContext = {
      stage: "INVOICE",
      blockingReason: null,
      allowedActions: ["OPEN_DEAL_ROOM", "SEND_INVOICE", "MARK_INVOICE_PAID"],
      confidence: "high",
      requiresLLM: true,
    };

    it("returns null when there is no current job id", () => {
      const result = maybeHandleDeterministicIntent({
        message: "Send the invoice",
        resolvedContext: baseContext,
        currentJobId: null,
      });
      expect(result).toBeNull();
    });

    it("returns null when action is not allowed in context", () => {
      const result = maybeHandleDeterministicIntent({
        message: "Send the contract",
        resolvedContext: {
          ...baseContext,
          stage: "CONTRACT",
          allowedActions: ["OPEN_DEAL_ROOM"],
        },
        currentJobId: "job-123",
      });
      expect(result).toBeNull();
    });

    it("returns deterministic navigation + metadata when allowed", () => {
      const result = maybeHandleDeterministicIntent({
        message: "Please send the invoice for this job",
        resolvedContext: baseContext,
        currentJobId: "job-123",
      });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.intent).toBe("send_invoice");
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("NAVIGATE");
      expect(result.actions[0].path).toBe("/finances/jobs?jobId=job-123");
      expect(result.actions[0].payload).toEqual({
        jobId: "job-123",
        intent: "send_invoice",
      });
      expect(result.metadata.intent).toBe("send_invoice");
      expect(result.metadata.resolvedContext.requiresLLM).toBe(false);
    });
  });
});
