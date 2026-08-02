import { NamedStoneActions } from "./NamedStoneActions";
import { StoneFacts } from "./StoneFacts";
import type { StoneWorkspaceProps } from "./workspaceTypes";

export function DesignerSelectionBoard(props: StoneWorkspaceProps) {
  return (
    <section className="jw2-workspace jw2-designer" aria-labelledby="designer-board-title">
      <header className="jw2-designer-heading">
        <p className="jw2-eyebrow">Designer Selection Board</p>
        <h2 id="designer-board-title">Let the stone lead. Keep the specification honest.</h2>
      </header>
      <div className="jw2-designer-board">
        {props.items.map((item, index) => (
          <article
            className={
              index % 3 === 0 ? "jw2-designer-card jw2-designer-card--feature" : "jw2-designer-card"
            }
            key={item.id}
          >
            <button
              className="jw2-designer-image"
              type="button"
              onClick={() => props.onOpenDetails(item)}
              aria-label={`Open ${item.publicName} gallery`}
            >
              <img
                src={item.images[0]}
                alt={`${item.publicName} stone from JW Stone inventory`}
                loading="lazy"
              />
              {item.images[1] && index % 3 === 0 ? (
                <img
                  className="jw2-designer-image-inset"
                  src={item.images[1]}
                  alt=""
                  loading="lazy"
                />
              ) : null}
            </button>
            <div className="jw2-designer-caption">
              <div>
                <p>{item.categoryLabel}</p>
                <h3>{item.publicName}</h3>
              </div>
              <StoneFacts item={item} includeColor compact />
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
