import type { BuyerType, JwStoneCatalogItem } from "./types";
import { CUSTOMER_PATH_GUIDANCE, resolveCustomerPathGuidance } from "./customerPathGuidance";

function sourcePublisher(label: string): string {
  return label.startsWith("Use Natural Stone") ? "Use Natural Stone" : "Natural Stone Institute";
}

type CustomerPathGuideProps = {
  selectedPath: BuyerType | null;
  onSelectPath: (path: BuyerType | null) => void;
  onOpenStone: (stone: JwStoneCatalogItem) => void;
};

export function CustomerPathGuide({
  selectedPath,
  onSelectPath,
  onOpenStone,
}: CustomerPathGuideProps) {
  const guidance = selectedPath ? resolveCustomerPathGuidance(selectedPath) : null;

  return (
    <section
      id="choose-buyer"
      data-testid="customer-path-guide"
      className="scroll-mt-24 border-b border-stone-300 bg-white px-5 py-4 text-stone-950 sm:px-8 lg:px-12"
      aria-labelledby="customer-path-title"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <h2
            id="customer-path-title"
            className="max-w-xl text-sm font-medium leading-5 text-stone-700"
          >
            Choose the path that fits you. The inventory stays the same; the questions and next step
            adapt to your project.
          </h2>
          <div
            data-testid="customer-path-toolbar"
            className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0"
            aria-label="Customer paths"
          >
            {CUSTOMER_PATH_GUIDANCE.map((path) => {
              const selected = selectedPath === path.id;
              return (
                <button
                  type="button"
                  key={path.id}
                  aria-pressed={selected}
                  onClick={() => onSelectPath(selected ? null : path.id)}
                  className={`min-h-11 shrink-0 whitespace-nowrap border px-4 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-stone-950 bg-stone-950 text-white"
                      : "border-stone-300 bg-stone-50 text-stone-800 hover:border-stone-700"
                  }`}
                >
                  {path.label}
                </button>
              );
            })}
          </div>
        </div>

        {guidance ? (
          <div
            data-testid="customer-path-panel"
            data-customer-path={guidance.id}
            className="mt-3 grid gap-3 border-t border-stone-300 pt-3 lg:grid-cols-[0.72fr_1.28fr] lg:items-start"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                {guidance.label}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-4 text-stone-700">
                {guidance.knowledgePoints.map((point) => (
                  <li key={`${guidance.id}-${point.source.url}`}>
                    {point.text}{" "}
                    <a
                      href={point.source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-stone-950 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-950"
                    >
                      {sourcePublisher(point.source.label)}
                      <span className="sr-only">: {point.source.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h3 className="font-editorial text-2xl">{guidance.rail.title}</h3>
                <p className="max-w-2xl text-xs leading-4 text-stone-600">{guidance.rail.reason}</p>
              </div>
              <ul
                className="scrollbar-hide -mx-5 mt-2 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
                aria-label={`${guidance.rail.title} for ${guidance.label}`}
              >
                {guidance.rail.items.map((item) => (
                  <li key={item.id} className="w-40 shrink-0 snap-start">
                    <button
                      type="button"
                      onClick={() => onOpenStone(item.stone)}
                      className="h-full w-full border border-stone-300 bg-stone-50 text-left hover:border-stone-700"
                      aria-label={`Open ${item.stone.publicLabel} from ${guidance.rail.title}`}
                    >
                      <img
                        src={item.stone.images[0]}
                        alt=""
                        loading="lazy"
                        className="h-16 w-full bg-stone-200 object-contain"
                      />
                      <span className="block p-2">
                        <span className="block font-editorial text-lg leading-5">
                          {item.stone.publicLabel}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-stone-600">
                          {item.reason}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
