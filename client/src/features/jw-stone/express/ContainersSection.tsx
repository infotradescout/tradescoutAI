import { useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { jw } from "../brand";
import { displayUsdAmount, getPublishedContainers } from "./api";
import type { JwExpressOfferTarget, JwStonePublicContainer } from "./types";

type ContainersState =
  | Readonly<{ status: "loading"; items: readonly JwStonePublicContainer[] }>
  | Readonly<{ status: "ready"; items: readonly JwStonePublicContainer[] }>
  | Readonly<{ status: "error"; items: readonly JwStonePublicContainer[] }>;

export function ContainersSection({
  onMakeOffer,
}: {
  onMakeOffer: (target: JwExpressOfferTarget) => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ContainersState>({ status: "loading", items: [] });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", items: [] });
    void getPublishedContainers(controller.signal)
      .then((items) => setState({ status: "ready", items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <section
      id="jw-containers"
      aria-labelledby="jw-containers-heading"
      data-testid="jw-containers"
      className={`scroll-mt-20 border-y ${jw.border} bg-[var(--jw-surface)] px-4 py-10 sm:px-8 sm:py-14 lg:px-12`}
    >
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="max-w-2xl">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${jw.muted}`}>
            Published opportunities
          </p>
          <h2
            id="jw-containers-heading"
            className="mt-2 font-editorial text-3xl font-medium tracking-tight text-[var(--jw-ink)] sm:text-4xl"
          >
            Containers
          </h2>
          <p className={`mt-3 text-sm leading-6 sm:text-base ${jw.muted}`}>
            Review containers released by JW Stone. Offers stay private and begin a conversation;
            they do not reserve inventory or create a sale.
          </p>
        </header>

        {state.status === "loading" ? (
          <div className="mt-8 flex min-h-32 items-center justify-center" role="status">
            <p className={`text-sm ${jw.muted}`}>Loading published containers…</p>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div
            className={`mt-8 border px-5 py-6 ${jw.border} bg-[var(--jw-bg)]`}
            role="alert"
            data-testid="jw-containers-error"
          >
            <p className="font-medium text-[var(--jw-ink)]">Containers could not be loaded.</p>
            <p className={`mt-1 text-sm leading-6 ${jw.muted}`}>
              No container records are being shown until the published list can be confirmed.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className={`mt-4 min-h-11 px-4 text-sm ${jw.ghostOnLight}`}
            >
              Try again
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.items.length === 0 ? (
          <div
            className={`mt-8 flex min-h-36 items-center gap-4 border px-5 py-6 ${jw.border} bg-[var(--jw-bg)]`}
            data-testid="jw-containers-empty"
          >
            <PackageOpen className={`h-7 w-7 shrink-0 ${jw.muted}`} aria-hidden="true" />
            <div>
              <p className="font-medium text-[var(--jw-ink)]">
                No published containers are available right now.
              </p>
              <p className={`mt-1 text-sm leading-6 ${jw.muted}`}>
                New container details will appear here only after JW Stone publishes them.
              </p>
            </div>
          </div>
        ) : null}

        {state.status === "ready" && state.items.length > 0 ? (
          <ul
            className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Published JW Stone containers"
            data-testid="jw-containers-list"
          >
            {state.items.map((container) => {
              const minimum = displayUsdAmount(container.target.minimumOffer);
              return (
                <li
                  key={container.target.ref}
                  className={`flex min-w-0 flex-col border ${jw.border} bg-[var(--jw-bg)]`}
                  data-testid="jw-container-card"
                >
                  {container.target.imageUrl ? (
                    <img
                      src={container.target.imageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-[var(--jw-dark)] object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className="font-editorial text-2xl leading-tight text-[var(--jw-ink)]">
                      {container.target.label}
                    </h3>
                    {container.description ? (
                      <p className={`mt-3 text-sm leading-6 ${jw.muted}`}>
                        {container.description}
                      </p>
                    ) : null}
                    <p className="mt-4 text-sm font-medium text-[var(--jw-ink)]">
                      {minimum ? `Public minimum: ${minimum}` : "No minimum is posted."}
                    </p>
                    <div className="mt-auto pt-5">
                      {container.target.acceptingOffers ? (
                        <button
                          type="button"
                          data-testid="jw-container-make-offer"
                          onClick={() => onMakeOffer(container.target)}
                          className={`min-h-12 w-full px-5 text-sm font-semibold ${jw.accentCta}`}
                        >
                          Make An Offer
                        </button>
                      ) : (
                        <p className={`border-t pt-4 text-sm ${jw.muted}`}>
                          Offers are currently closed for this container.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
