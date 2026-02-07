export type ScoutPolicyViolation = {
  kind: "text" | "action_label" | "action_subtitle" | "action_why";
  rule: string;
  original: string;
  sanitized: string;
};

type ActionLike = {
  label?: string;
  subtitle?: string;
  why?: string;
  [key: string]: unknown;
};

function replaceWithRules(input: string): { output: string; violations: ScoutPolicyViolation[] } {
  let output = input;
  const violations: ScoutPolicyViolation[] = [];

  const addViolation = (
    kind: ScoutPolicyViolation["kind"],
    rule: string,
    original: string,
    sanitized: string
  ) => {
    if (original === sanitized) return;
    violations.push({ kind, rule, original, sanitized });
  };

  const textRules: Array<{ rule: string; regex: RegExp; replacement: string }> = [
    {
      rule: "no_scout_recommends",
      regex: /\bscout\s+recommend(s|ed|ation)?\b/gi,
      replacement: "Scout validates trust signals",
    },
    {
      rule: "no_paid_recommendation_phrase",
      regex: /\bpaid\s+recommendation(s)?\b/gi,
      replacement: "Sponsored placement",
    },
    {
      rule: "no_who_do_you_recommend",
      regex: /\bwho\s+do\s+you\s+recommend\??/gi,
      replacement: "who has strong trust signals?",
    },
    {
      rule: "no_recommendations_noun_for_people",
      regex: /\brecommendations?\b/gi,
      replacement: "trust signals",
    },
  ];

  for (const rule of textRules) {
    if (!rule.regex.test(output)) continue;
    const before = output;
    output = output.replace(rule.regex, rule.replacement);
    addViolation("text", rule.rule, before, output);
  }

  return { output, violations };
}

export function sanitizeScoutMessageForPolicy(message: string): {
  message: string;
  violations: ScoutPolicyViolation[];
} {
  const { output, violations } = replaceWithRules(message);
  return { message: output, violations };
}

export function sanitizeScoutActionsForPolicy<T extends ActionLike>(
  actions: T[]
): {
  actions: T[];
  violations: ScoutPolicyViolation[];
} {
  const violations: ScoutPolicyViolation[] = [];

  const sanitized = actions.map((action) => {
    const next = { ...action };

    if (typeof next.label === "string") {
      const { output, violations: v } = replaceWithRules(next.label);
      if (output !== next.label) {
        violations.push(
          ...v.map((item) => ({
            ...item,
            kind: "action_label" as const,
            original: next.label as string,
            sanitized: output,
          }))
        );
        next.label = output;
      }
    }

    if (typeof next.subtitle === "string") {
      const { output, violations: v } = replaceWithRules(next.subtitle);
      if (output !== next.subtitle) {
        violations.push(
          ...v.map((item) => ({
            ...item,
            kind: "action_subtitle" as const,
            original: next.subtitle as string,
            sanitized: output,
          }))
        );
        next.subtitle = output;
      }
    }

    if (typeof next.why === "string") {
      const { output, violations: v } = replaceWithRules(next.why);
      if (output !== next.why) {
        violations.push(
          ...v.map((item) => ({
            ...item,
            kind: "action_why" as const,
            original: next.why as string,
            sanitized: output,
          }))
        );
        next.why = output;
      }
    }

    return next;
  });

  return { actions: sanitized, violations };
}
