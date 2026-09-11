import { useEffect, useRef, type ReactNode } from "react";
import "./kitchenWorkspaceControls.css";

type Props = { label: string; children: ReactNode; onClose: () => void };

/** Replaces the inspector, not the drawing. Toolbar history stays available while it is open. */
export default function KitchenWorkspacePanel({ label, children, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    // Native non-modal semantics allow access to Undo and the measured plan.
    if (typeof node.show === "function") node.show();
    else node.setAttribute("open", "");
    return () => {
      if (typeof node.close === "function" && node.open) node.close();
    };
  }, []);
  return <dialog ref={dialog} aria-label={label} className="kitchen-workspace-panel"
    onCancel={event => { event.preventDefault(); close.current(); }}
    onKeyDown={event => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault(); event.stopPropagation(); close.current();
      }
    }}>
    {children}
  </dialog>;
}
