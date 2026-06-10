import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const DECISION_CONTACT_GATE_STATES = [
  "contact_hidden",
  "provider_requested_contact",
  "requester_approved",
  "contact_released",
  "denied",
  "closed",
] as const;

export type DecisionContactGateState = (typeof DECISION_CONTACT_GATE_STATES)[number];

export type DecisionContactGateViewerRole = "requester" | "provider" | "staff" | "admin";

export type DecisionContactGateNextActor =
  | "requester"
  | "provider"
  | "staff"
  | "admin"
  | "platform"
  | "none";

export type ReleasedContactPayload = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type DecisionContactGateAction = {
  label: string;
  description?: string;
};

export type DecisionContactGatePanelProps = {
  contactState: DecisionContactGateState | (string & {});
  viewerRole: DecisionContactGateViewerRole;
  nextActor?: DecisionContactGateNextActor;
  nextRequiredAction?: string;
  safeSummary: string;
  releasedContact?: ReleasedContactPayload | null;
  actions?: DecisionContactGateAction[];
  className?: string;
};

type ResolvedContactState = {
  label: string;
  variant: "secondary" | "success" | "warning" | "error" | "outline";
  canRenderReleasedContact: boolean;
  defaultWhatVisible: string;
  defaultNext: string;
};

const STATE_LABELS: Record<DecisionContactGateState, ResolvedContactState> = {
  contact_hidden: {
    label: "Contact hidden",
    variant: "secondary",
    canRenderReleasedContact: false,
    defaultWhatVisible: "Request details are visible, but private contact details stay locked.",
    defaultNext: "Wait for a valid contact request or continue review.",
  },
  provider_requested_contact: {
    label: "Provider requested contact",
    variant: "warning",
    canRenderReleasedContact: false,
    defaultWhatVisible: "The request can be reviewed, but requester contact remains private.",
    defaultNext: "The requester must approve or deny the contact request.",
  },
  requester_approved: {
    label: "Requester approved contact",
    variant: "warning",
    canRenderReleasedContact: false,
    defaultWhatVisible: "Approval is recorded, but raw contact is still gated until release.",
    defaultNext: "Release contact only through the approved platform path.",
  },
  contact_released: {
    label: "Contact released",
    variant: "success",
    canRenderReleasedContact: true,
    defaultWhatVisible: "Approved contact details may be shown to authorized viewers.",
    defaultNext: "Coordinate through the released contact path.",
  },
  denied: {
    label: "Contact denied",
    variant: "error",
    canRenderReleasedContact: false,
    defaultWhatVisible: "Contact was denied. Private contact details remain hidden.",
    defaultNext: "No contact action is available unless the request is reopened through policy.",
  },
  closed: {
    label: "Closed",
    variant: "outline",
    canRenderReleasedContact: false,
    defaultWhatVisible: "This contact workflow is closed. Private contact details remain hidden.",
    defaultNext: "No contact action is available in the closed state.",
  },
};

function isKnownContactState(value: string): value is DecisionContactGateState {
  return (DECISION_CONTACT_GATE_STATES as readonly string[]).includes(value);
}

function resolveContactState(contactState: string): ResolvedContactState {
  if (isKnownContactState(contactState)) return STATE_LABELS[contactState];
  return {
    label: "Contact gated",
    variant: "secondary",
    canRenderReleasedContact: false,
    defaultWhatVisible: "Contact state is unavailable. Private contact details stay locked.",
    defaultNext: "Review the request state before taking contact action.",
  };
}

function formatActor(actor: DecisionContactGateNextActor | undefined): string {
  if (!actor || actor === "none") return "No one";
  if (actor === "staff") return "Staff";
  if (actor === "admin") return "Admin";
  if (actor === "platform") return "TradeScout";
  return actor.charAt(0).toUpperCase() + actor.slice(1);
}

function hasReleasedContact(payload: ReleasedContactPayload | null | undefined): boolean {
  if (!payload) return false;
  return Boolean(
    payload.name || payload.email || payload.phone || payload.address || payload.notes
  );
}

export function DecisionContactGatePanel({
  contactState,
  viewerRole,
  nextActor,
  nextRequiredAction,
  safeSummary,
  releasedContact,
  actions = [],
  className,
}: DecisionContactGatePanelProps) {
  const resolved = resolveContactState(contactState);
  const canShowReleasedContact =
    resolved.canRenderReleasedContact && hasReleasedContact(releasedContact);

  return (
    <section
      aria-label="Contact gate status"
      className={cn(
        "rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 text-[color:var(--text-primary)] shadow-[var(--surface-card-shadow)]",
        className
      )}
      data-contact-state={contactState}
      data-viewer-role={viewerRole}
      data-testid="decision-contact-gate-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[color:var(--theme-accent-primary)]"
            />
            <h2 className="text-sm font-semibold leading-tight">Contact gate</h2>
            <Badge variant={resolved.variant} data-testid="decision-contact-gate-state">
              {resolved.label}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
            {safeSummary}
          </p>
        </div>
        <div className="rounded-md border border-[color:var(--border-subtle)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
          Viewer:{" "}
          <span className="font-semibold text-[color:var(--text-primary)]">{viewerRole}</span>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
            Visible now
          </dt>
          <dd className="mt-1 leading-relaxed">{resolved.defaultWhatVisible}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
            Happens next
          </dt>
          <dd className="mt-1 leading-relaxed">{nextRequiredAction || resolved.defaultNext}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
            Must act next
          </dt>
          <dd className="mt-1 leading-relaxed">{formatActor(nextActor)}</dd>
        </div>
      </dl>

      <div
        aria-live="polite"
        className="mt-4 rounded-md border border-[color:var(--border-subtle)] bg-black/10 p-3 text-sm"
        data-testid="decision-contact-gate-contact-visibility"
      >
        {canShowReleasedContact ? (
          <div>
            <p className="font-semibold">Released contact</p>
            <ul className="mt-2 space-y-1 text-[color:var(--text-secondary)]">
              {releasedContact?.name ? <li>Name: {releasedContact.name}</li> : null}
              {releasedContact?.email ? <li>Email: {releasedContact.email}</li> : null}
              {releasedContact?.phone ? <li>Phone: {releasedContact.phone}</li> : null}
              {releasedContact?.address ? <li>Address: {releasedContact.address}</li> : null}
              {releasedContact?.notes ? <li>Notes: {releasedContact.notes}</li> : null}
            </ul>
          </div>
        ) : (
          <p>Private requester contact is hidden until contact is released.</p>
        )}
      </div>

      {actions.length > 0 ? (
        <div
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          aria-label="Available actions"
        >
          {actions.map((action) => (
            <div
              key={action.label}
              className="rounded-md border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
            >
              <span className="font-semibold">{action.label}</span>
              {action.description ? (
                <span className="block text-xs text-[color:var(--text-secondary)]">
                  {action.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default DecisionContactGatePanel;
