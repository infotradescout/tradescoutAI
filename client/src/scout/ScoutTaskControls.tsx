import { ChevronDown } from "lucide-react";

export function ScoutTaskControls({
  saved,
  request,
  onSave,
  onNew,
  onDelete,
}: {
  saved: boolean;
  request: string | null;
  onSave: () => void;
  onNew: () => void;
  onDelete?: () => void;
}) {
  const closeMenu = (button: HTMLButtonElement) => {
    button.closest("details")?.removeAttribute("open");
  };

  return (
    <div className="scout-current-task__controls flex w-full items-center gap-1.5 sm:w-auto" aria-label="Thread controls">
      <button
        type="button"
        className="min-h-11 flex-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 text-xs font-bold text-[color:var(--text-secondary)] sm:flex-none"
        onClick={saved ? onNew : onSave}
      >
        {saved ? "Start new" : "Save task"}
      </button>
      <details className="scout-current-task__menu group relative">
        <summary
          className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 text-xs font-bold text-[color:var(--text-secondary)] [&::-webkit-details-marker]:hidden"
          aria-label="Task options"
        >
          Options
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-40 max-h-[50dvh] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2 text-xs text-[color:var(--text-secondary)] shadow-xl">
          <button
            type="button"
            className="min-h-11 w-full rounded-md px-3 text-left font-bold hover:bg-[color:var(--surface-intermediate)]"
            onClick={(event) => {
              closeMenu(event.currentTarget);
              if (saved) onSave();
              else onNew();
            }}
          >
            {saved ? "Save current version" : "Start new"}
          </button>
          {request && (
            <div className="mt-1 border-t border-[color:var(--border-subtle)] px-3 py-2">
              <p className="font-bold text-[color:var(--text-primary)]">Full request</p>
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{request}</p>
            </div>
          )}
          {saved && onDelete && (
            <button
              type="button"
              className="mt-1 min-h-11 w-full border-t border-[color:var(--border-subtle)] px-3 text-left font-bold hover:bg-[color:var(--surface-intermediate)]"
              onClick={(event) => {
                closeMenu(event.currentTarget);
                onDelete();
              }}
            >
              Delete saved task
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
