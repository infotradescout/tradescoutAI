import { useEffect, useState, type ComponentProps, type ComponentType } from "react";
import { JW_STONE_PORTAL_COPY } from "@shared/jwStonePortalCopy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AccountProps = ComponentProps<
  typeof import("@/components/profile/PublicProfileAccountDialog").PublicProfileAccountDialog
>;

/** Keep account creation available without loading its form into every catalog visit. */
export function PublicProfileAccountDialog(props: AccountProps) {
  const [Account, setAccount] = useState<ComponentType<AccountProps> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!props.open || Account) return;
    let active = true;
    setFailed(false);
    void import("@/components/profile/PublicProfileAccountDialog")
      .then((module) => { if (active) setAccount(() => module.PublicProfileAccountDialog); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [props.open, Account]);

  // Retain the mounted form once loaded so closing/reopening for the same user
  // does not erase its draft. Its existing session boundary owns identity resets.
  if (Account) return <Account {...props} />;
  if (!props.open) return null;
  return (
    <Dialog open onOpenChange={props.onOpenChange}>
      <DialogContent className="border-stone-200 bg-white text-stone-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{JW_STONE_PORTAL_COPY.title}</DialogTitle>
          <DialogDescription>
            {JW_STONE_PORTAL_COPY.audience}{" "}
            {failed ? "The account form could not load. Reload this page to try again." : JW_STONE_PORTAL_COPY.opening}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <button type="button" className="min-h-11 rounded-full bg-stone-950 px-5 font-bold text-white" onClick={() => window.location.reload()}>
            Reload account form
          </button>
        ) : <p role="status" aria-live="polite" className="text-sm text-stone-600">Loading account form…</p>}
      </DialogContent>
    </Dialog>
  );
}
