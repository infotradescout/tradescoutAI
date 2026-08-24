import { useEffect, useMemo, useState } from "react";
import { Banknote, Link2, PackageCheck, ShieldCheck } from "lucide-react";
import type { BidRockHandoffActionCapability, BidRockHandoffType } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BidRockOrderWorkspace, BidRockProviderHandoffWorkspace } from "./bidrockClient";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: BidRockOrderWorkspace | BidRockProviderHandoffWorkspace | null;
  loading: boolean;
  busy: boolean;
  onPaymentReady: (orderId: string) => Promise<void>;
  onCancel: (orderId: string) => Promise<void>;
  onLink: (args: {
    orderId: string;
    canonicalMarketplaceTransactionId?: string;
    canonicalProcurementOrderId?: string;
  }) => Promise<void>;
  onSettle: (orderId: string) => Promise<void>;
  onComplete: (orderId: string) => Promise<void>;
  onHandoff: (args: {
    orderId: string;
    handoffType: BidRockHandoffType;
    status: "pending" | "in_progress" | "completed";
    providerName?: string;
    reference?: string;
    evidence?: Readonly<Record<string, unknown>>;
  }) => Promise<void>;
};

const handoffLabels: Readonly<Record<BidRockHandoffType, string>> = {
  freight: "Freight",
  custody: "Custody",
  fabrication: "Fabrication",
  installation_homeid: "Installation / HomeID",
};

export function BidRockOrderSheet({
  open,
  onOpenChange,
  workspace,
  loading,
  busy,
  onPaymentReady,
  onCancel,
  onLink,
  onSettle,
  onComplete,
  onHandoff,
}: Props) {
  const [transactionId, setTransactionId] = useState("");
  const [procurementId, setProcurementId] = useState("");
  const [handoffType, setHandoffType] = useState<BidRockHandoffType>("freight");
  const [handoffStatus, setHandoffStatus] = useState<"pending" | "in_progress" | "completed">(
    "pending"
  );
  const [providerName, setProviderName] = useState("");
  const [reference, setReference] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const order = workspace?.kind === "order" ? workspace.order : null;
  const providerWorkspace = workspace?.kind === "provider_handoff" ? workspace : null;
  const providerHandoffActions = providerWorkspace?.handoffActions ?? [];
  const handoffChoices = useMemo(() => {
    if (providerWorkspace) {
      return providerHandoffActions.map((action) => action.handoffType);
    }
    const choices = order
      ? (
          [
            ["freight", order.actions.freight],
            ["custody", order.actions.custody],
            ["fabrication", order.actions.fabrication],
            ["installation_homeid", order.actions.installationHomeId],
          ] as const
        )
          .filter(([, enabled]) => enabled)
          .map(([type]) => type)
      : [];
    return choices.filter(
      (type) =>
        !workspace?.handoffs?.some(
          (handoff) => handoff.handoffType === type && handoff.status === "completed"
        )
    );
  }, [order, providerHandoffActions, providerWorkspace, workspace?.handoffs]);
  const currentHandoff = workspace?.handoffs?.find(
    (handoff) => handoff.handoffType === handoffType
  );
  const selectedProviderAction = providerHandoffActions.find(
    (action) => action.handoffType === handoffType
  );
  const nextHandoffStatus: "pending" | "in_progress" | "completed" = providerWorkspace
    ? (selectedProviderAction?.nextStatus ?? "pending")
    : !currentHandoff
      ? "pending"
      : currentHandoff.status === "pending"
        ? "in_progress"
        : "completed";
  const completedEvidenceReady =
    handoffStatus !== "completed" ||
    (providerName.trim().length > 1 &&
      reference.trim().length > 1 &&
      evidenceNote.trim().length > 1);

  useEffect(() => {
    if (handoffChoices.length && !handoffChoices.includes(handoffType)) {
      const firstEnabledProviderAction = providerHandoffActions.find((action) => action.enabled);
      setHandoffType(firstEnabledProviderAction?.handoffType ?? handoffChoices[0]);
    }
  }, [handoffChoices, handoffType, providerHandoffActions]);

  useEffect(() => {
    setHandoffStatus(nextHandoffStatus);
  }, [nextHandoffStatus]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white text-stone-950 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[30rem] sm:max-w-[92vw] sm:border-l"
        data-testid="bidrock-order-detail-sheet"
      >
        <SheetHeader className="text-left">
          <SheetTitle>BidRock order</SheetTitle>
          <SheetDescription>
            ACH, canonical records, and custody state for this business transaction.
          </SheetDescription>
        </SheetHeader>

        {loading ? <p className="py-10 text-sm text-stone-500">Loading order details…</p> : null}
        {providerWorkspace ? (
          <div className="mt-5 space-y-5" data-testid="bidrock-provider-handoff-workspace">
            <section className="border-y border-stone-200 py-4">
              <h2 className="font-bold">{providerWorkspace.listing.title}</h2>
              <p className="mt-1 text-xs text-stone-500">
                Order {providerWorkspace.orderReference} · lot {providerWorkspace.lotReference}
              </p>
              <p className="mt-3 text-sm text-stone-600">
                This view contains only the assigned handoff evidence and schedule. Commercial and
                party records remain private.
              </p>
            </section>
            {handoffChoices.length ? (
              <HandoffMutationFields
                actions={providerWorkspace.handoffActions}
                handoffType={handoffType}
                handoffStatus={handoffStatus}
                busy={busy}
                providerName={providerName}
                reference={reference}
                evidenceNote={evidenceNote}
                completedEvidenceReady={completedEvidenceReady}
                onType={setHandoffType}
                onProvider={setProviderName}
                onReference={setReference}
                onEvidence={setEvidenceNote}
                onSubmit={() =>
                  onHandoff({
                    orderId: providerWorkspace.orderReference,
                    handoffType,
                    status: handoffStatus,
                    providerName: providerName.trim() || undefined,
                    reference: reference.trim() || undefined,
                    evidence: evidenceNote.trim()
                      ? { source: "provider_attestation", note: evidenceNote.trim() }
                      : {},
                  })
                }
              />
            ) : null}
            <RecordedHandoffs handoffs={providerWorkspace.handoffs} />
          </div>
        ) : null}
        {order && workspace?.kind === "order" ? (
          <div className="mt-5 space-y-6">
            <section className="border-y border-stone-200 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{workspace.listing.title}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {order.quantity} slabs ·{" "}
                    {(order.subtotalCents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </p>
                </div>
                <Badge variant="outline">{order.status}</Badge>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <Banknote className="h-4 w-4" aria-hidden="true" /> ACH only
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {order.actions.prepareAch ? (
                  <Button size="sm" disabled={busy} onClick={() => void onPaymentReady(order.id)}>
                    Prepare ACH
                  </Button>
                ) : null}
                {order.actions.cancel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onCancel(order.id)}
                  >
                    Cancel order
                  </Button>
                ) : null}
                {order.actions.settleAch ? (
                  <Button size="sm" disabled={busy} onClick={() => void onSettle(order.id)}>
                    Reconcile settled ACH
                  </Button>
                ) : null}
                {order.actions.complete ? (
                  <Button size="sm" disabled={busy} onClick={() => void onComplete(order.id)}>
                    Complete sale
                  </Button>
                ) : null}
              </div>
            </section>

            {order.actions.linkCanonical ? (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Link2 className="h-4 w-4" aria-hidden="true" /> Canonical records
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Link existing TradeScout marketplace and procurement records. The server verifies
                  buyer, seller, lot, totals, ACH state, and canonical accounting fields.
                </p>
                <div className="mt-3 space-y-2">
                  <Input
                    aria-label="Canonical marketplace transaction ID"
                    value={transactionId}
                    onChange={(event) => setTransactionId(event.target.value)}
                    placeholder="Marketplace transaction ID"
                  />
                  <Input
                    aria-label="Canonical procurement order ID"
                    value={procurementId}
                    onChange={(event) => setProcurementId(event.target.value)}
                    placeholder="Procurement order ID"
                  />
                  <Button
                    size="sm"
                    disabled={busy || (!transactionId.trim() && !procurementId.trim())}
                    onClick={() =>
                      void onLink({
                        orderId: order.id,
                        canonicalMarketplaceTransactionId: transactionId.trim() || undefined,
                        canonicalProcurementOrderId: procurementId.trim() || undefined,
                      })
                    }
                  >
                    Verify and link
                  </Button>
                </div>
              </section>
            ) : null}

            {handoffChoices.length ? (
              <section className="border-t border-stone-200 pt-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <PackageCheck className="h-4 w-4" aria-hidden="true" /> Handoff evidence
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select
                    value={handoffType}
                    onValueChange={(value) => setHandoffType(value as BidRockHandoffType)}
                  >
                    <SelectTrigger aria-label="Handoff type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {handoffChoices.map((type) => (
                        <SelectItem key={type} value={type}>
                          {handoffLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={handoffStatus} disabled>
                    <SelectTrigger aria-label="Handoff status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={nextHandoffStatus}>
                        {nextHandoffStatus.replace("_", " ")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 space-y-2">
                  <Input
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    placeholder="Provider name"
                  />
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Provider reference"
                  />
                  <Input
                    value={evidenceNote}
                    onChange={(event) => setEvidenceNote(event.target.value)}
                    placeholder="Evidence note"
                  />
                  <Button
                    size="sm"
                    disabled={
                      busy || !handoffChoices.includes(handoffType) || !completedEvidenceReady
                    }
                    onClick={() =>
                      void onHandoff({
                        orderId: order.id,
                        handoffType,
                        status: handoffStatus,
                        providerName: providerName.trim() || undefined,
                        reference: reference.trim() || undefined,
                        evidence: evidenceNote.trim()
                          ? { source: "operator_attestation", note: evidenceNote.trim() }
                          : {},
                      })
                    }
                  >
                    Record handoff state
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="border-t border-stone-200 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Recorded handoffs
              </h3>
              {workspace.handoffs.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {workspace.handoffs.map((handoff) => (
                    <li
                      key={`${handoff.handoffType}:${handoff.status}`}
                      className="border border-stone-200 p-3"
                    >
                      <span className="font-semibold">{handoffLabels[handoff.handoffType]}</span>
                      <span className="ml-2 text-stone-500">{handoff.status}</span>
                      {handoff.reference ? (
                        <p className="mt-1 text-xs text-stone-500">{handoff.reference}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone-500">No handoff evidence recorded.</p>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function HandoffMutationFields({
  actions,
  handoffType,
  handoffStatus,
  busy,
  providerName,
  reference,
  evidenceNote,
  completedEvidenceReady,
  onType,
  onProvider,
  onReference,
  onEvidence,
  onSubmit,
}: {
  actions: readonly BidRockHandoffActionCapability[];
  handoffType: BidRockHandoffType;
  handoffStatus: "pending" | "in_progress" | "completed";
  busy: boolean;
  providerName: string;
  reference: string;
  evidenceNote: string;
  completedEvidenceReady: boolean;
  onType: (type: BidRockHandoffType) => void;
  onProvider: (value: string) => void;
  onReference: (value: string) => void;
  onEvidence: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const selectedAction = actions.find((action) => action.handoffType === handoffType);
  return (
    <section className="border-t border-stone-200 pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <PackageCheck className="h-4 w-4" aria-hidden="true" /> Assigned handoff
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Select value={handoffType} onValueChange={(value) => onType(value as BidRockHandoffType)}>
          <SelectTrigger aria-label="Handoff type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((action) => (
              <SelectItem
                key={action.handoffType}
                value={action.handoffType}
                disabled={!action.enabled}
              >
                {handoffLabels[action.handoffType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border border-stone-200 px-3 text-sm capitalize text-stone-600">
          Next: {handoffStatus.replace("_", " ")}
        </div>
      </div>
      <div className="mt-2 space-y-2">
        <Input
          value={providerName}
          onChange={(event) => onProvider(event.target.value)}
          placeholder="Provider name"
        />
        <Input
          value={reference}
          onChange={(event) => onReference(event.target.value)}
          placeholder="Provider reference"
        />
        <Input
          value={evidenceNote}
          onChange={(event) => onEvidence(event.target.value)}
          placeholder="Evidence note"
        />
        <Button
          size="sm"
          disabled={busy || selectedAction?.enabled !== true || !completedEvidenceReady}
          onClick={() => void onSubmit()}
        >
          Record next handoff state
        </Button>
        {selectedAction?.disabledReason ? (
          <p className="text-xs text-stone-500" role="status">
            {selectedAction.disabledReason}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RecordedHandoffs({
  handoffs,
}: {
  handoffs: readonly Readonly<{
    id?: string;
    handoffType: BidRockHandoffType;
    status: "pending" | "in_progress" | "completed";
    reference: string | null;
  }>[];
}) {
  return (
    <section className="border-t border-stone-200 pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Recorded handoffs
      </h3>
      {handoffs.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {handoffs.map((handoff) => (
            <li
              key={handoff.id ?? `${handoff.handoffType}:${handoff.status}`}
              className="border border-stone-200 p-3"
            >
              <span className="font-semibold">{handoffLabels[handoff.handoffType]}</span>
              <span className="ml-2 text-stone-500">{handoff.status}</span>
              {handoff.reference ? (
                <p className="mt-1 text-xs text-stone-500">{handoff.reference}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-stone-500">No handoff evidence recorded.</p>
      )}
    </section>
  );
}
