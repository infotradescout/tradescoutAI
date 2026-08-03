import { StoneFacts } from "./StoneFacts";
import { NamedStoneActions } from "./NamedStoneActions";
import type { StoneWorkspaceProps } from "./workspaceTypes";

export function FabricatorDesk(props: StoneWorkspaceProps) {
  return (
    <section className="jw2-workspace jw2-fabricator" aria-labelledby="fabricator-desk-title">
      <header className="jw2-workspace-heading">
        <p className="jw2-eyebrow">Fabricator Desk</p>
        <h2 id="fabricator-desk-title">Key details, lined up for comparison.</h2>
        <p>
          Recorded quantities are a reference, not a live availability promise. Open any gallery for
          the full image set.
        </p>
      </header>
      <div className="jw2-fabricator-list" role="list">
        {props.items.map((item) => (
          <article className="jw2-fabricator-row" key={item.id} role="listitem">
            <button
              className="jw2-fabricator-image"
              type="button"
              onClick={() => props.onOpenDetails(item)}
              aria-label={`Open ${item.publicName} gallery`}
            >
              <img src={item.images[0]} alt="" loading="lazy" />
              <span>
                {item.images.length} {item.images.length === 1 ? "image" : "images"}
              </span>
            </button>
            <div className="jw2-fabricator-identity">
              <p>{item.categoryLabel}</p>
              <h3>{item.publicName}</h3>
            </div>
            <StoneFacts item={item} compact />
            <NamedStoneActions
              item={item}
              isSaved={props.savedIds.has(item.id)}
              onToggleSave={props.onToggleSave}
              onOpenDetails={props.onOpenDetails}
              onAsk={props.onAsk}
              compact
            />
          </article>
        ))}
      </div>
    </section>
  );
}
