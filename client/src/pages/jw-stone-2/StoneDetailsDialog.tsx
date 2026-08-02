import { useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { Bookmark, ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import type { JwStone2InventoryItem } from "@/features/jw-stone-2/types";
import { sourceCountLabel, StoneFacts } from "./StoneFacts";

type StoneDetailsDialogProps = {
  item: JwStone2InventoryItem | null;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: (item: JwStone2InventoryItem) => void;
  onAsk: (item: JwStone2InventoryItem) => void;
};

export function StoneDetailsDialog({
  item,
  isSaved,
  onClose,
  onToggleSave,
  onAsk,
}: StoneDetailsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!item) return;
    setActiveImage(0);
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveImage((current) => (current + 1) % item.images.length);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveImage((current) => (current - 1 + item.images.length) % item.images.length);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  if (!item || typeof document === "undefined") return null;

  const title = item.publicName || "Call for availability";
  const nextImage = () => setActiveImage((current) => (current + 1) % item.images.length);
  const previousImage = () =>
    setActiveImage((current) => (current - 1 + item.images.length) % item.images.length);
  const finishForImage = item.imageFinishes?.[activeImage]?.filter(Boolean).join(" / ");
  const recordedQuantity = sourceCountLabel(item);

  const handleTouchStart = (event: TouchEvent) => {
    touchStartRef.current = event.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStartRef.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartRef.current = null;
    if (start == null || end == null || Math.abs(end - start) < 42) return;
    if (end < start) nextImage();
    else previousImage();
  };

  return createPortal(
    <div
      className="jw2-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="jw2-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jw2-stone-dialog-title"
        tabIndex={-1}
      >
        <button
          className="jw2-dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close stone details"
        >
          <X aria-hidden="true" />
        </button>
        <div
          className="jw2-dialog-gallery"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={item.images[activeImage]}
            alt={
              item.publicName
                ? `${item.publicName}, photograph ${activeImage + 1}`
                : `Trending Selection stone, photograph ${activeImage + 1}`
            }
          />
          {item.images.length > 1 ? (
            <>
              <button
                className="jw2-gallery-arrow jw2-gallery-arrow--previous"
                type="button"
                onClick={previousImage}
                aria-label="Previous photograph"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="jw2-gallery-arrow jw2-gallery-arrow--next"
                type="button"
                onClick={nextImage}
                aria-label="Next photograph"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          ) : null}
          <span className="jw2-gallery-count" aria-live="polite">
            {activeImage + 1} / {item.images.length}
          </span>
        </div>
        <div className="jw2-dialog-details">
          <p className="jw2-eyebrow">{item.isNamed ? item.categoryLabel : "Trending Selection"}</p>
          <h2 id="jw2-stone-dialog-title">{title}</h2>
          {finishForImage ? (
            <p className="jw2-image-finish">This photograph: {finishForImage}</p>
          ) : null}
          {item.isNamed ? <StoneFacts item={item} includeColor /> : null}
          {!item.isNamed && recordedQuantity ? (
            <dl className="jw2-facts jw2-facts--compact">
              <div className="jw2-fact">
                <dt>Recorded quantity</dt>
                <dd>{recordedQuantity}</dd>
              </div>
            </dl>
          ) : null}
          {item.isNamed ? (
            <div className="jw2-dialog-actions">
              <button
                type="button"
                className={
                  isSaved ? "jw2-button jw2-button--saved" : "jw2-button jw2-button--light"
                }
                aria-pressed={isSaved}
                onClick={() => onToggleSave(item)}
              >
                <Bookmark aria-hidden="true" size={17} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "Saved" : "Save stone"}
              </button>
              <button
                type="button"
                className="jw2-button jw2-button--dark"
                onClick={() => onAsk(item)}
              >
                <MessageCircle aria-hidden="true" size={17} />
                Ask about this stone
              </button>
            </div>
          ) : (
            <p className="jw2-anonymous-note">Call JW Stone for current availability.</p>
          )}
          {item.images.length > 1 ? (
            <div className="jw2-dialog-thumbnails" aria-label="Choose a photograph">
              {item.images.map((src, index) => (
                <button
                  type="button"
                  key={src}
                  className={index === activeImage ? "is-active" : ""}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View photograph ${index + 1}`}
                  aria-current={index === activeImage ? "true" : undefined}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
