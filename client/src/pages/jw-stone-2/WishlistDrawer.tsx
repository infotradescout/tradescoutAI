import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, MessageCircle, Trash2, X } from "lucide-react";
import type { JwStone2InventoryItem } from "@/features/jw-stone-2/types";

type WishlistDrawerProps = {
  open: boolean;
  items: readonly JwStone2InventoryItem[];
  onClose: () => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onOpenDetails: (item: JwStone2InventoryItem) => void;
  onAskAboutSelection: (items: readonly JwStone2InventoryItem[]) => void;
};

export function WishlistDrawer({
  open,
  items,
  onClose,
  onRemove,
  onClear,
  onOpenDetails,
  onAskAboutSelection,
}: WishlistDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmClear(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => drawerRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const controls = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="jw2-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="jw2-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jw2-wishlist-title"
        tabIndex={-1}
      >
        <header className="jw2-drawer-header">
          <div>
            <p className="jw2-eyebrow">No account required</p>
            <h2 id="jw2-wishlist-title">Saved stones</h2>
            <span>
              {items.length} {items.length === 1 ? "selection" : "selections"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close saved stones">
            <X aria-hidden="true" />
          </button>
        </header>

        {items.length ? (
          <>
            <div className="jw2-drawer-list">
              {items.map((item) => (
                <article className="jw2-drawer-item" key={item.id}>
                  <button
                    className="jw2-drawer-item-image"
                    type="button"
                    onClick={() => onOpenDetails(item)}
                    aria-label={`Open ${item.publicName} details`}
                  >
                    <img src={item.images[0]} alt="" loading="lazy" />
                  </button>
                  <div>
                    <p>{item.categoryLabel}</p>
                    <h3>{item.publicName}</h3>
                    {item.verifiedFinishLabel ? <span>{item.verifiedFinishLabel}</span> : null}
                  </div>
                  <button
                    className="jw2-drawer-remove"
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.publicName} from saved stones`}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </article>
              ))}
            </div>
            <div className="jw2-drawer-footer">
              <button
                type="button"
                className="jw2-button jw2-button--dark"
                onClick={() => onAskAboutSelection(items)}
              >
                <MessageCircle aria-hidden="true" size={17} />
                Ask about these stones
              </button>
              {confirmClear ? (
                <div
                  className="jw2-clear-confirm"
                  role="group"
                  aria-label="Confirm clearing saved stones"
                >
                  <span>Clear every saved stone?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setConfirmClear(false);
                    }}
                  >
                    Yes, clear all
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)}>
                    Keep them
                  </button>
                </div>
              ) : (
                <button
                  className="jw2-clear-link"
                  type="button"
                  onClick={() => setConfirmClear(true)}
                >
                  Clear saved stones
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="jw2-drawer-empty">
            <Bookmark aria-hidden="true" />
            <h3>Your selection board is open.</h3>
            <p>Save any named stone to keep it here in this browser for your next visit.</p>
            <button className="jw2-button jw2-button--light" type="button" onClick={onClose}>
              Explore the collection
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}
