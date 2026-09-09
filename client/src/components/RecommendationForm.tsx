import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, LockKeyhole, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { isSafeNextPath } from "@/lib/postOnboardingRoute";
import {
  browserRecommendationDraftStorage,
  browserRecommendationHandoffStorage,
  beginRecommendationHandoff,
  hasRecommendationHandoff,
  clearRecommendationHandoff,
  clearRecommendationDraft,
  emptyRecommendation,
  readRecommendationDraft,
  saveRecommendationDraft,
} from "@/lib/recommendationDraft";
import {
  recommendationSubmissionSchema,
  type RecommendationSubmission,
} from "@shared/recommendationSubmission";

interface RecommendationFormProps {
  contractorId: string;
  contractorName: string;
  defaultOpen?: boolean;
  resumePath?: string;
  resumeSaved?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}
type RecommendationReceipt = {
  recommendation: {
    id: string;
    comment: string;
    moderationStatus: string | null;
    isPublic: boolean | null;
  } | null;
  missingVerification: string[];
};

export function RecommendationForm({
  contractorId,
  contractorName,
  defaultOpen = false,
  resumePath,
  resumeSaved = false,
  onCancel,
  onSuccess,
}: RecommendationFormProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(defaultOpen);
  const [data, setData] = useState<RecommendationSubmission>(emptyRecommendation);
  const [error, setError] = useState("");
  const [guestSaved, setGuestSaved] = useState(false);
  const [receipt, setReceipt] = useState<{ owner: string; result: RecommendationReceipt } | null>(
    null
  );
  const [writingAnother, setWritingAnother] = useState(false);
  const [recoverableGuest, setRecoverableGuest] = useState(false);
  const [guestConflict, setGuestConflict] = useState(false);
  const [draftOwner, setDraftOwner] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const autoSubmit = useRef(false);
  const attemptedResume = useRef("");
  const ownerUserId = user?.id ?? null;
  const ownerKey = `${contractorId}:${ownerUserId ?? "guest"}`;
  const currentOwner = useRef(ownerKey);
  currentOwner.current = ownerKey;
  const localStorage = browserRecommendationDraftStorage();
  const handoffStorage = browserRecommendationHandoffStorage();
  const destination =
    resumePath && isSafeNextPath(resumePath)
      ? resumePath
      : `${typeof window === "undefined" ? `/contractors/${encodeURIComponent(contractorId)}` : window.location.pathname}?trustAction=recommend`;
  const endpoint = `/api/contractors/${encodeURIComponent(contractorId)}/recommendations`;
  const mine = useQuery<RecommendationReceipt>({
    queryKey: [endpoint, "mine", ownerUserId],
    enabled: isAuthenticated && showForm,
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`${endpoint}/mine`, {
        credentials: "include",
        headers: { "X-Expected-Account-Id": ownerUserId || "" },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load your recommendation.");
      return result;
    },
  });
  useEffect(() => {
    if (authLoading) return;
    const own = readRecommendationDraft(localStorage, contractorId, ownerUserId);
    const guest = ownerUserId ? readRecommendationDraft(localStorage, contractorId, null) : null;
    const authorizedGuest =
      guest &&
      hasRecommendationHandoff(handoffStorage, contractorId, guest.data.submissionId, destination)
        ? guest
        : null;
    // The first authenticated account consumes this tab's continuation,
    // including when two saved drafts require an explicit choice.
    if (authorizedGuest) clearRecommendationHandoff(handoffStorage);
    let restored = own;
    let guestAdopted = false;
    const conflictingDrafts = !!guest && !!own && guest.data.submissionId !== own.data.submissionId;
    if (authorizedGuest && (!own || own.data.submissionId === authorizedGuest.data.submissionId)) {
      // Bind the handoff to the first authenticated account before starting a
      // request. A failed/in-flight save cannot replay it under another account.
      const adopted = { ...authorizedGuest, ownerUserId, savedAt: Date.now() };
      if (saveRecommendationDraft(localStorage, adopted)) {
        restored = adopted;
        guestAdopted = true;
        clearRecommendationDraft(localStorage, contractorId, null);
        clearRecommendationHandoff(handoffStorage);
      } else {
        // The attempted handoff belongs to this account even if local storage
        // fails. A later account must choose the preserved device draft explicitly.
        clearRecommendationHandoff(handoffStorage);
        setError(
          "Your device draft is still saved. Enable site storage, then restore it to continue."
        );
      }
    }
    setRecoverableGuest(!!guest && !guestAdopted);
    setGuestConflict(conflictingDrafts);
    setData(restored?.data ?? emptyRecommendation());
    setGuestSaved(!ownerUserId && restored?.readyToSubmit === true);
    autoSubmit.current =
      !!ownerUserId &&
      resumeSaved &&
      restored?.readyToSubmit === true &&
      !conflictingDrafts &&
      (!authorizedGuest || guestAdopted);
    setReceipt(null);
    setWritingAnother(false);
    setDraftOwner(ownerKey);
    setDraftLoaded(true);
  }, [authLoading, contractorId, ownerUserId, resumeSaved]);

  const saveLocal = (value: RecommendationSubmission, readyToSubmit: boolean) =>
    saveRecommendationDraft(localStorage, {
      version: 1,
      contractorId,
      ownerUserId,
      savedAt: Date.now(),
      readyToSubmit,
      data: value,
    });
  const submit = useMutation({
    mutationFn: async (input: {
      value: RecommendationSubmission;
      owner: string;
      userId: string | null;
      contractorId: string;
    }): Promise<RecommendationReceipt> => {
      const response = await fetch(
        `/api/contractors/${encodeURIComponent(input.contractorId)}/recommendations`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Expected-Account-Id": input.userId || "",
          },
          body: JSON.stringify(input.value),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save your recommendation.");
      return result;
    },
    onSuccess: (result, input) => {
      if (currentOwner.current === input.owner) {
        setReceipt({ owner: input.owner, result });
        setWritingAnother(false);
      }
      const currentDraft = readRecommendationDraft(localStorage, input.contractorId, input.userId);
      // Another tab may have started editing while this request was in flight.
      if (currentDraft && JSON.stringify(currentDraft.data) === JSON.stringify(input.value))
        clearRecommendationDraft(localStorage, input.contractorId, input.userId);
      const guest = readRecommendationDraft(localStorage, input.contractorId, null);
      if (guest?.data.submissionId === result.recommendation?.id)
        clearRecommendationDraft(localStorage, input.contractorId, null);
      if (
        hasRecommendationHandoff(
          handoffStorage,
          input.contractorId,
          input.value.submissionId,
          destination
        )
      )
        clearRecommendationHandoff(handoffStorage);
      queryClient.setQueryData(
        [
          `/api/contractors/${encodeURIComponent(input.contractorId)}/recommendations`,
          "mine",
          input.userId,
        ],
        result
      );
      queryClient.invalidateQueries({ queryKey: [`/api/contractors/${input.contractorId}`] });
    },
    onError: (failure, input) => {
      if (currentOwner.current === input.owner)
        setError(
          formatUserFacingErrorMessage(failure, "Your text is still here. Try saving again.")
        );
    },
  });
  useEffect(() => {
    if (
      !draftLoaded ||
      draftOwner !== ownerKey ||
      !isAuthenticated ||
      !autoSubmit.current ||
      attemptedResume.current === `${ownerKey}:${data.submissionId}` ||
      !mine.isSuccess
    )
      return;
    attemptedResume.current = `${ownerKey}:${data.submissionId}`;
    const parsed = recommendationSubmissionSchema.safeParse(data);
    if (parsed.success)
      submit.mutate({ value: parsed.data, owner: ownerKey, userId: ownerUserId, contractorId });
  }, [
    draftLoaded,
    draftOwner,
    ownerKey,
    isAuthenticated,
    mine.isSuccess,
    mine.data,
    data,
    submit.mutate,
  ]);

  const saved = receipt?.owner === ownerKey ? receipt.result : mine.data;
  const newDraft = !!data.comment.trim() && data.submissionId !== saved?.recommendation?.id;
  const existing = !writingAnother && !newDraft ? saved?.recommendation : null;
  const update = (change: Partial<RecommendationSubmission>) => {
    if (submit.isPending) return;
    const next = { ...data, ...change };
    setData(next);
    setGuestSaved(false);
    setError("");
    if (!saveLocal(next, false))
      setError("This browser could not save a draft. Keep this page open to preserve your text.");
  };
  const signIn = (mode: "create" | "signin") => {
    if (
      !saveLocal(data, true) ||
      !beginRecommendationHandoff(handoffStorage, contractorId, data.submissionId, destination)
    ) {
      setError(
        "This browser could not save your draft. Enable site storage before continuing so your text stays with you."
      );
      return;
    }
    window.location.assign(`/pre-scout-setup?mode=${mode}&next=${encodeURIComponent(destination)}`);
  };

  if (!showForm)
    return (
      <Button onClick={() => setShowForm(true)} data-testid="button-write-recommendation">
        <MessageSquare className="mr-2 h-4 w-4" />
        Share your experience
      </Button>
    );
  if (draftOwner !== ownerKey)
    return (
      <p className="p-6 text-sm text-white/65" role="status">
        Loading your recommendation…
      </p>
    );
  return (
    <Card className="border-white/10 bg-tsCard text-white shadow-none">
      <CardHeader className="space-y-2 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ts-orange">
          Your experience matters
        </p>
        <CardTitle className="pr-7 text-xl leading-snug">Recommend {contractorName}</CardTitle>
        <p className="text-sm leading-relaxed text-white/65">
          Help someone choose with confidence. Start with what happened.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {recoverableGuest && (
          <div className="space-y-3 rounded-lg border border-white/15 p-3">
            {guestConflict && (
              <p className="text-sm text-white/70">
                You have two drafts. Keep the account draft below, or replace it with the draft
                saved on this device.
              </p>
            )}
            <Button
              variant="outline"
              className="w-full whitespace-normal"
              disabled={submit.isPending}
              onClick={() => {
                const guest = readRecommendationDraft(localStorage, contractorId, null);
                if (!guest) return;
                if (!saveLocal(guest.data, false)) {
                  setError(
                    "Your device draft is still saved. Enable site storage, then restore it to continue."
                  );
                  return;
                }
                setData(guest.data);
                setWritingAnother(true);
                autoSubmit.current = false;
                clearRecommendationDraft(localStorage, contractorId, null);
                clearRecommendationHandoff(handoffStorage);
                setError("");
                setRecoverableGuest(false);
                setGuestConflict(false);
              }}
            >
              Restore a draft saved on this device
            </Button>
            {guestConflict && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  autoSubmit.current = false;
                  clearRecommendationHandoff(handoffStorage);
                  setRecoverableGuest(false);
                  setGuestConflict(false);
                  setWritingAnother(true);
                }}
              >
                Keep the account draft
              </Button>
            )}
          </div>
        )}
        {existing ? (
          <div className="space-y-4" data-testid="recommendation-saved" role="status">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
              <div>
                <h3 className="font-semibold">
                  {existing.isPublic
                    ? "Your recommendation is published"
                    : "Your recommendation is saved"}
                </h3>
                <p className="mt-1 text-sm text-white/65">
                  {existing.moderationStatus === "rejected"
                    ? "Your recommendation was reviewed and was not published."
                    : saved?.missingVerification.includes("email")
                      ? "It is private. Confirm your email to send it for review."
                      : existing.isPublic
                        ? "Thanks for sharing your experience."
                        : "Your email is confirmed. Your recommendation is waiting for moderation before it appears publicly."}
                </p>
              </div>
            </div>
            <blockquote className="whitespace-pre-wrap break-words border-l-2 border-white/15 pl-4 text-sm text-white/80">
              {existing.comment}
            </blockquote>
            {saved?.missingVerification.includes("email") &&
              existing.moderationStatus !== "rejected" && (
                <Button
                  className="w-full"
                  onClick={() =>
                    window.location.assign(`/verification?next=${encodeURIComponent(destination)}`)
                  }
                >
                  Confirm email to continue
                </Button>
              )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowForm(false);
                onSuccess?.();
                onCancel?.();
              }}
            >
              Done
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setData(emptyRecommendation());
                setWritingAnother(true);
              }}
            >
              Write another recommendation
            </Button>
          </div>
        ) : guestSaved ? (
          <div className="space-y-4" role="status" data-testid="recommendation-guest-saved">
            <h3 className="font-semibold">Saved on this device</h3>
            <p className="text-sm text-white/65">
              Your recommendation is private. Create a free account or sign in to keep it with you,
              then confirm your email to send it for review.
            </p>
            <blockquote className="whitespace-pre-wrap break-words border-l-2 border-white/15 pl-4 text-sm text-white/80">
              {data.comment}
            </blockquote>
            <Button className="w-full" onClick={() => signIn("create")}>
              Continue with a free account
            </Button>
            <Button variant="outline" className="w-full" onClick={() => signIn("signin")}>
              I already have an account
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setGuestSaved(false)}>
              Edit recommendation
            </Button>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (submit.isPending || guestConflict) return;
              setError("");
              const parsed = recommendationSubmissionSchema.safeParse(data);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Check your recommendation.");
                return;
              }
              const persisted = saveLocal(parsed.data, true);
              if (!isAuthenticated) {
                if (persisted) setGuestSaved(true);
                else
                  setError(
                    "This browser could not save your draft. Keep this page open and enable site storage to continue."
                  );
                return;
              }
              submit.mutate({
                value: parsed.data,
                owner: ownerKey,
                userId: ownerUserId,
                contractorId,
              });
            }}
          >
            <fieldset disabled={submit.isPending} className="space-y-5">
              <fieldset>
                <legend className="mb-3 text-sm font-medium">
                  Would you recommend this business?
                </legend>
                <RadioGroup
                  value={data.recommendationType}
                  onValueChange={(value) =>
                    update({ recommendationType: value as "positive" | "negative" })
                  }
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <Label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-white/15 p-3">
                    <RadioGroupItem value="positive" />
                    Yes, I recommend them
                  </Label>
                  <Label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-white/15 p-3">
                    <RadioGroupItem value="negative" />
                    No, I don’t recommend them
                  </Label>
                </RadioGroup>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor={`experience-${contractorId}`}>What was your experience?</Label>
                <Textarea
                  id={`experience-${contractorId}`}
                  value={data.comment}
                  onChange={(event) => update({ comment: event.target.value })}
                  maxLength={4000}
                  placeholder="What did they help you with? What should someone else know?"
                  className="min-h-32 border-white/15 bg-transparent text-base"
                  data-testid="textarea-comment"
                  aria-describedby="recommendation-privacy"
                />
              </div>
              <details className="border-y border-white/10 py-3">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-sm text-white/75">
                  Add project details (optional)
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`project-${contractorId}`}>Project or service</Label>
                    <Input
                      id={`project-${contractorId}`}
                      value={data.projectType ?? ""}
                      maxLength={120}
                      onChange={(event) => update({ projectType: event.target.value })}
                      placeholder="For example, a kitchen remodel"
                      data-testid="input-project-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`value-${contractorId}`}>Project cost</Label>
                    <Input
                      id={`value-${contractorId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={data.projectValue ?? ""}
                      onChange={(event) => update({ projectValue: event.target.value })}
                      placeholder="Amount in dollars"
                    />
                  </div>
                  {(["workQuality", "timeliness", "communication"] as const).map((field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`${field}-${contractorId}`}>
                        {field === "workQuality"
                          ? "Work quality"
                          : field === "timeliness"
                            ? "Timing"
                            : "Communication"}
                      </Label>
                      <Select
                        value={data[field] ?? ""}
                        onValueChange={(value) => update({ [field]: value })}
                      >
                        <SelectTrigger id={`${field}-${contractorId}`}>
                          <SelectValue placeholder="Choose if you’d like" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field === "timeliness"
                            ? [
                                ["on_time", "On time"],
                                ["slightly_late", "Slightly late"],
                                ["very_late", "Very late"],
                              ]
                            : [
                                ["excellent", "Excellent"],
                                ["good", "Good"],
                                ["fair", "Fair"],
                                ["poor", "Poor"],
                              ]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor={`again-${contractorId}`}>Would you hire them again?</Label>
                    <Select
                      value={data.wouldHireAgain === undefined ? "" : String(data.wouldHireAgain)}
                      onValueChange={(value) => update({ wouldHireAgain: value === "true" })}
                    >
                      <SelectTrigger id={`again-${contractorId}`}>
                        <SelectValue placeholder="Choose if you’d like" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </details>
              <p
                id="recommendation-privacy"
                className="flex items-start gap-2 text-xs leading-relaxed text-white/55"
              >
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                Your recommendation stays private until your email is confirmed and it passes
                moderation.
              </p>
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={
                  authLoading ||
                  guestConflict ||
                  !draftLoaded ||
                  submit.isPending ||
                  (isAuthenticated && mine.isLoading)
                }
                data-testid="button-submit-recommendation"
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save recommendation"
                )}
              </Button>
              {onCancel && (
                <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
                  Close
                </Button>
              )}
            </fieldset>
          </form>
        )}
        {(error || mine.isError) && (
          <p role="alert" className="text-sm text-red-300">
            {error || "Unable to check your saved recommendation. Your draft is still here."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
