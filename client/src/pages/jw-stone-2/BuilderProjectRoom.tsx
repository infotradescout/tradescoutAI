import { BookmarkCheck, ClipboardList } from "lucide-react";
import { StoneFacts } from "./StoneFacts";
import { NamedStoneActions } from "./NamedStoneActions";
import type { StoneWorkspaceProps } from "./workspaceTypes";

export function BuilderProjectRoom(props: StoneWorkspaceProps) {
  const savedInView = props.items.filter((item) => props.savedIds.has(item.id)).length;

  return (
    <section className="jw2-workspace jw2-builder" aria-labelledby="builder-room-title">
      <header className="jw2-builder-heading">
        <div>
          <p className="jw2-eyebrow">Builder Project Room</p>
          <h2 id="builder-room-title">Turn a broad collection into a project shortlist.</h2>
          <p>
            Save candidates for team review. This list is a planning aid, not a hold or reservation.
          </p>
        </div>
        <div className="jw2-builder-summary" aria-live="polite">
          <BookmarkCheck aria-hidden="true" />
          <strong>{savedInView}</strong>
          <span>saved from these results</span>
        </div>
      </header>
      <div className="jw2-builder-sheet">
        <div className="jw2-builder-sheet-label">
          <ClipboardList aria-hidden="true" size={18} />
          Project candidates
        </div>
        <div className="jw2-builder-grid">
          {props.items.map((item, index) => (
            <article className="jw2-builder-card" key={item.id}>
              <button
                className="jw2-builder-photo"
                type="button"
                onClick={() => props.onOpenDetails(item)}
                aria-label={`Open ${item.publicName} gallery`}
              >
                <img src={item.images[0]} alt="" loading="lazy" />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
              <div className="jw2-builder-card-body">
                <p>{item.categoryLabel}</p>
                <h3>{item.publicName}</h3>
                <StoneFacts item={item} compact />
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
      </div>
    </section>
  );
}
