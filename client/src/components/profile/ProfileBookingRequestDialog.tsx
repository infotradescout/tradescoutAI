import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type PricingRow = {
  id: string;
  name: string;
  priceLabel: string;
  description?: string;
};

type CreatedBookingRequest = {
  id: string;
  depositRequired?: boolean | null;
  depositAmountUsd?: string | number | null;
};

type Props = {
  profileId?: string;
  ownerUserId?: string;
  businessProfileSlug?: string;
  profileName: string;
  timezone: string;
  pricingRows: PricingRow[];
  paidBookings: boolean;
  bookingPriceUsd: number;
  bookingCategory: string;
  bookingStateCode: string;
  hasViewerSession: boolean;
  viewerCanManage: boolean;
  signInHref: string;
  platformBaseHref: string;
  onAccountCreate?: () => void;
  onBookingRequest?: () => void;
};

function shouldOpenFromReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("book") === "1";
}

export function ProfileBookingRequestDialog({
  profileId,
  ownerUserId,
  businessProfileSlug,
  profileName,
  timezone,
  pricingRows,
  paidBookings,
  bookingPriceUsd,
  bookingCategory,
  bookingStateCode,
  hasViewerSession,
  viewerCanManage,
  signInHref,
  platformBaseHref,
  onAccountCreate,
  onBookingRequest,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(() => hasViewerSession && shouldOpenFromReturn());
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestedStart, setRequestedStart] = useState("");
  const [serviceLabel, setServiceLabel] = useState(pricingRows[0]?.name || "");
  const [requestMessage, setRequestMessage] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"onsite" | "remote" | "mobile">("onsite");
  const [locationNote, setLocationNote] = useState("");

  const requiresDeposit = paidBookings && Number.isFinite(bookingPriceUsd) && bookingPriceUsd > 0;
  const bookingTargetId = String(profileId || ownerUserId || "").trim();
  const requesterTimezone = useMemo(() => {
    if (typeof Intl === "undefined") return timezone;
    return Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
  }, [timezone]);
  const minimumStart = useMemo(() => {
    const now = new Date(Date.now() + 15 * 60 * 1000);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
    return local.toISOString().slice(0, 16);
  }, []);

  useEffect(() => {
    if (hasViewerSession && shouldOpenFromReturn()) setOpen(true);
  }, [hasViewerSession]);

  const handleTrigger = () => {
    if (viewerCanManage) return;
    onBookingRequest?.();
    if (!hasViewerSession) {
      onAccountCreate?.();
      window.location.assign(signInHref);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!requestedStart) {
      toast({
        title: "Choose a requested time",
        description: "The business can accept it or suggest another time.",
        variant: "destructive",
      });
      return;
    }

    const start = new Date(requestedStart);
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      toast({
        title: "Choose a future time",
        description: "The requested appointment must be in the future.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const created = (await apiRequest("POST", "/api/profile-booking/requests", {
        ...(profileId ? { profileId } : { ownerUserId }),
        ...(businessProfileSlug ? { businessProfileSlug } : {}),
        serviceLabel: serviceLabel.trim() || null,
        requestMessage: requestMessage.trim() || null,
        requestedStartAt: start.toISOString(),
        requestedEndAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        timezone: requesterTimezone,
        deliveryMode,
        locationNote: locationNote.trim() || null,
        bookingContext: {
          category: bookingCategory,
          stateCode: bookingStateCode,
          serviceType: (serviceLabel.trim() || "other")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, ""),
          deliveryMode,
        },
      })) as CreatedBookingRequest;

      if (requiresDeposit) {
        const checkoutPath = `/checkout/booking/${encodeURIComponent(bookingTargetId)}?bookingRequestId=${encodeURIComponent(
          created.id
        )}&amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${encodeURIComponent(
          `Booking deposit for ${profileName}`
        )}`;
        window.location.assign(qualifyPublicProfileItemDestination(checkoutPath, platformBaseHref));
        return;
      }

      setSent(true);
      toast({
        title: "Booking request sent",
        description: `${profileName} can now accept it or suggest a different time.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Booking request not sent",
        description: formatUserFacingErrorMessage(
          error,
          "Please review the details and try again."
        ),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (viewerCanManage || !bookingTargetId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="bg-ts-orange text-white hover:bg-ts-orange-dark"
          onClick={handleTrigger}
        >
          {requiresDeposit ? (
            <DollarSign className="mr-1.5 h-4 w-4" />
          ) : (
            <CalendarCheck className="mr-1.5 h-4 w-4" />
          )}
          Request a booking
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a booking with {profileName}</DialogTitle>
          <DialogDescription>
            Send the time that works for you. The business must accept it before it is confirmed.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-5 text-center">
            <CalendarCheck className="mx-auto h-7 w-7 text-emerald-300" />
            <p className="mt-2 font-semibold text-white">Request sent</p>
            <p className="mt-1 text-sm text-white/60">
              {profileName} can review the request now. It is not confirmed until they respond.
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="profile-booking-start">Requested date and time</Label>
              <Input
                id="profile-booking-start"
                type="datetime-local"
                min={minimumStart}
                value={requestedStart}
                onChange={(event) => setRequestedStart(event.target.value)}
                required
              />
              <p className="text-xs text-white/50">
                Shown in your local time ({requesterTimezone}).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-booking-service">Service or reason</Label>
              {pricingRows.length > 0 ? (
                <select
                  id="profile-booking-service"
                  value={serviceLabel}
                  onChange={(event) => setServiceLabel(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/15 bg-black/20 px-3 text-sm text-white"
                >
                  {pricingRows.map((row) => (
                    <option key={row.id} value={row.name}>
                      {row.name} · {row.priceLabel}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              ) : (
                <Input
                  id="profile-booking-service"
                  value={serviceLabel}
                  onChange={(event) => setServiceLabel(event.target.value)}
                  placeholder="What do you need?"
                  maxLength={120}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-booking-mode">Appointment type</Label>
              <select
                id="profile-booking-mode"
                value={deliveryMode}
                onChange={(event) =>
                  setDeliveryMode(event.target.value as "onsite" | "remote" | "mobile")
                }
                className="h-10 w-full rounded-md border border-white/15 bg-black/20 px-3 text-sm text-white"
              >
                <option value="onsite">At the business</option>
                <option value="mobile">Business comes to me</option>
                <option value="remote">Remote appointment</option>
              </select>
            </div>

            {deliveryMode !== "remote" ? (
              <div className="space-y-2">
                <Label htmlFor="profile-booking-location">Service area (optional)</Label>
                <Input
                  id="profile-booking-location"
                  value={locationNote}
                  onChange={(event) => setLocationNote(event.target.value)}
                  placeholder="City or neighborhood only — no street address"
                  maxLength={120}
                />
                <p className="text-xs text-white/50">
                  Keep phone, email, links, and the exact address in TradeScout until contact opens.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="profile-booking-message">Anything the business should know?</Label>
              <Textarea
                id="profile-booking-message"
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="Add the details needed to review this appointment."
                maxLength={1000}
                rows={4}
              />
            </div>

            {requiresDeposit ? (
              <div className="rounded-lg border border-ts-orange/25 bg-ts-orange/10 p-3 text-sm text-white/75">
                This business requires a ${bookingPriceUsd.toFixed(2)} deposit. Your booking request
                is created first, then payment is completed securely.
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                No payment is required to send this booking request.
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-ts-orange text-white hover:bg-ts-orange-dark"
              >
                {submitting
                  ? "Sending…"
                  : requiresDeposit
                    ? "Submit and continue to deposit"
                    : "Send booking request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
