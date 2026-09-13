/** Shared accessible feedback for on-demand JW panels. */
export function JwStoneLoadingStatus({
  subject,
  failed,
  retry,
  onClose,
}: {
  subject: string;
  failed: boolean;
  retry: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <p role="status" aria-live="polite" aria-busy={!failed}>
        {failed ? `Could not load ${subject}.` : `Loading ${subject}…`}
      </p>
      {failed || onClose ? (
        <div className="mt-3 flex gap-3">
          {failed ? (
            <button type="button" onClick={retry} className="min-h-11 px-4 underline">
              Try again
            </button>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose} className="min-h-11 px-4 underline">
              Close
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
