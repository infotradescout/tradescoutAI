import type { JwStone2FirstCutSlot } from "@/features/jw-stone-2/types";

type FirstCutExclusivesProps = {
  slots: readonly JwStone2FirstCutSlot[];
};

export function FirstCutExclusives({ slots }: FirstCutExclusivesProps) {
  return (
    <section className="jw2-first-cut" aria-labelledby="first-cut-title">
      <div className="jw2-first-cut-heading">
        <p className="jw2-eyebrow">Coming soon</p>
        <h2 id="first-cut-title">First Cut Exclusives</h2>
        <p>First Cut selections will appear here when JW Stone is ready to introduce them.</p>
      </div>
      <div className="jw2-first-cut-slots" aria-label="First Cut previews">
        {slots.map((slot, index) =>
          slot.kind === "placeholder" ? (
            <article className="jw2-first-cut-placeholder" key={slot.slotKey}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>Coming soon</h3>
              </div>
            </article>
          ) : (
            <article className="jw2-first-cut-assigned" key={slot.stone.id}>
              <img src={slot.stone.images[0]} alt="" loading="lazy" />
              <p>First Cut Exclusive</p>
              <h3>{slot.stone.publicName}</h3>
            </article>
          )
        )}
      </div>
    </section>
  );
}
