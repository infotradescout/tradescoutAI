import { STONE_LEARNING_TOPICS } from "./stoneLearning";

export function StoneLearningSection() {
  return (
    <section
      id="learn-about-stone"
      data-testid="stone-learning"
      aria-labelledby="stone-learning-title"
      className="border-t border-stone-300 bg-white px-5 py-14 sm:px-8 lg:px-12 lg:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Learn</p>
        <h2
          id="stone-learning-title"
          className="mt-3 max-w-3xl font-editorial text-4xl leading-none text-stone-950 sm:text-5xl"
        >
          Learn about stone
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
          Plain guidance for reading natural stone. Sources are linked; JW Stone can help with the
          material you are considering.
        </p>

        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {STONE_LEARNING_TOPICS.map((topic) => (
            <li key={topic.title} className="border border-stone-300 bg-stone-50 p-6">
              <h3 className="font-editorial text-2xl leading-tight text-stone-950">
                {topic.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-700">{topic.text}</p>
              <a
                href={topic.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4 hover:decoration-stone-900"
              >
                {topic.source.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
