export type StoneLearningSource = Readonly<{
  label: string;
  url: string;
}>;

export type StoneLearningTopic = Readonly<{
  title: string;
  text: string;
  source: StoneLearningSource;
}>;

const SAFE_SOURCE_HOSTS = new Set(["usenaturalstone.org", "www.naturalstoneinstitute.org"]);

function createSource(label: string, url: string): StoneLearningSource {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !SAFE_SOURCE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Unsafe JW Stone learning source URL: ${url}`);
  }
  if (!label.trim()) throw new Error("JW Stone learning sources require a visible label.");
  return Object.freeze({ label: label.trim(), url: parsed.toString() });
}

const SOURCES = Object.freeze({
  stoneSelection: createSource(
    "Use Natural Stone — A Beginner's Guide to Stone Selection",
    "https://usenaturalstone.org/a-beginners_guide_stone_selection/"
  ),
  bookmatching: createSource(
    "Use Natural Stone — Bookmatching",
    "https://usenaturalstone.org/bookmatching/"
  ),
  finishAppearance: createSource(
    "Use Natural Stone — Adding Value with Natural Stone",
    "https://usenaturalstone.org/how-to-add-value-to-your-project-with-natural-stone/"
  ),
  care: createSource(
    "Natural Stone Institute — Natural Stone Care",
    "https://www.naturalstoneinstitute.org/consumers/care/"
  ),
});

/** Short, sourced topics only — not role paths or recommendation rails. */
export const STONE_LEARNING_TOPICS: readonly StoneLearningTopic[] = Object.freeze([
  Object.freeze({
    title: "Samples are not the full slab",
    text: "Natural stone varies across a full slab. Review the actual material views before locking a selection for a project.",
    source: SOURCES.stoneSelection,
  }),
  Object.freeze({
    title: "Finish changes how stone reads",
    text: "Polished, honed, and other finishes change color depth and reflectivity. Compare the supplied finish evidence, not only a small sample.",
    source: SOURCES.finishAppearance,
  }),
  Object.freeze({
    title: "Movement and layout matter",
    text: "Vein direction and bookmatching affect the final look. Plan layout with the full imagery, then confirm details with JW Stone.",
    source: SOURCES.bookmatching,
  }),
  Object.freeze({
    title: "Care continues after install",
    text: "Natural stone needs appropriate sealing and care for the material and use. Ask about care when you inquire about a selection.",
    source: SOURCES.care,
  }),
]);
