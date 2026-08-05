import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { jw } from "./brand";

const story = JW_STONE_PROFILE_PRESENTATION_BLOCK.data.story;

/**
 * Profile-owned quarry + finished-space photography.
 * Compact horizontal rail (not a tall editorial band) — same assets/copy as `/u/jw-stone`.
 */
export function JwStoneStorySection() {
  if (!story.images.length) return null;

  return (
    <section
      id="jw-story"
      data-testid="jw-marketplace-story"
      aria-labelledby="jw-story-heading"
      className={`border-y border-white/10 ${jw.darkBar}`}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-3 max-w-2xl sm:mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]">
            {story.eyebrow}
          </p>
          <h2
            id="jw-story-heading"
            className="mt-1 font-editorial text-xl leading-tight text-[var(--jw-on-dark)] sm:text-2xl"
          >
            {story.heading}
          </h2>
        </div>

        <div
          className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:gap-3 sm:px-0"
          aria-label="JW Stone quarry and finished work"
        >
          {story.images.map((image) => (
            <figure
              key={image.src}
              className={`group w-[72vw] max-w-[360px] flex-none snap-start overflow-hidden sm:w-[46vw] md:w-[28vw] md:max-w-[320px] ${jw.darkElevated}`}
            >
              <span className="relative block aspect-[16/10] overflow-hidden bg-black">
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </span>
              <figcaption className="border-t border-white/10 px-3 py-2.5 text-sm font-semibold text-[var(--jw-on-dark)]">
                {image.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
