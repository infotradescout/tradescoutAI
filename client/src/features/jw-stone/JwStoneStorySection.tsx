import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { jw } from "./brand";

const story = JW_STONE_PROFILE_PRESENTATION_BLOCK.data.story;

/**
 * Profile-owned quarry + source-to-space photography at marketplace bottom.
 * Companion to finished-work installs — quarry / Wagner-era source frames first.
 */
export function JwStoneStorySection() {
  if (!story.images.length) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="h-10 bg-[var(--jw-bg)] sm:h-14"
        data-testid="jw-story-separator"
      />
      <section
        id="jw-story"
        data-testid="jw-marketplace-story"
        aria-labelledby="jw-story-heading"
        className={`border-y border-[var(--jw-border-strong)] bg-[var(--jw-dark)] ${jw.scrollTarget}`}
      >
        <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-9 sm:py-14 lg:px-12 lg:py-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]">
            {story.eyebrow}
          </p>
          <h2
            id="jw-story-heading"
            className="mt-2 max-w-2xl font-editorial text-3xl leading-tight text-white sm:text-4xl lg:text-5xl"
          >
            {story.heading}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
            Quarry relationships and finished rooms — the path from source stone to installed space.
          </p>

          <ul
            className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-10 sm:gap-4 [&::-webkit-scrollbar]:hidden"
            aria-label="JW Stone quarry and finished work"
          >
            {story.images.map((image) => (
              <li
                key={image.src}
                className="w-[85vw] max-w-[36rem] flex-none snap-center sm:w-[70vw] md:w-[48vw] lg:w-[38vw]"
              >
                <figure className="overflow-hidden bg-black">
                  <span className="relative block aspect-[4/3] sm:aspect-[16/11]">
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </span>
                  <figcaption className="border-t border-white/10 px-4 py-3 text-sm font-semibold text-white">
                    {image.label}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
