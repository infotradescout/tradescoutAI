import { NamedStoneActions } from "./NamedStoneActions";
import type { StoneWorkspaceProps } from "./workspaceTypes";

export function HomeownerStoneFinder(props: StoneWorkspaceProps) {
  return (
    <section className="jw2-workspace jw2-homeowner" aria-labelledby="homeowner-finder-title">
      <header className="jw2-homeowner-heading">
        <p className="jw2-eyebrow">Homeowner Stone Finder</p>
        <h2 id="homeowner-finder-title">Notice what you love. Save it. Ask when you are ready.</h2>
        <p>
          There is no need to know stone-yard language. Start with the photographs, then use the
          available details to narrow the list.
        </p>
      </header>
      <div className="jw2-homeowner-grid">
        {props.items.map((item) => (
          <article className="jw2-homeowner-card" key={item.id}>
            <button
              className="jw2-homeowner-photo"
              type="button"
              onClick={() => props.onOpenDetails(item)}
              aria-label={`See more photographs of ${item.publicName}`}
            >
              <img
                src={item.images[0]}
                alt={`${item.publicName} stone from JW Stone inventory`}
                loading="lazy"
              />
              <span>
                See {item.images.length > 1 ? `all ${item.images.length} photos` : "the photo"}
              </span>
            </button>
            <div className="jw2-homeowner-card-body">
              <p className="jw2-homeowner-kind">
                {item.material?.name
                  ? `${item.material.name} in ${item.categoryLabel}`
                  : item.categoryLabel}
              </p>
              <h3>{item.publicName}</h3>
              <div className="jw2-homeowner-plain-facts">
                <p>
                  <span>Color direction</span>
                  <strong>
                    {
                      {
                        "warm-neutrals": "Warm neutrals",
                        "cool-lights": "Cool and light",
                        "deep-dramatic": "Deep and dramatic",
                        "green-earth": "Green and earth",
                        "mixed-palette": "A mixed palette",
                      }[item.colorDirection]
                    }
                  </strong>
                </p>
                {item.verifiedFinishLabel ? (
                  <p>
                    <span>
                      {item.verifiedFinishes.length > 1 ? "Verified finishes" : "Verified finish"}
                    </span>
                    <strong>{item.verifiedFinishLabel}</strong>
                  </p>
                ) : null}
              </div>
              <NamedStoneActions
                item={item}
                isSaved={props.savedIds.has(item.id)}
                onToggleSave={props.onToggleSave}
                onOpenDetails={props.onOpenDetails}
                onAsk={props.onAsk}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
