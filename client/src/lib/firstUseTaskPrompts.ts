export type FirstUseTaskPrompt = {
  message: string;
  ctaLabel: string;
};

export function resolveHomeIdFirstUseTaskPrompt(state: {
  hasSelectedHome: boolean;
  knownDetailsCount: number;
  hasComponentLikeDetail: boolean;
}): FirstUseTaskPrompt {
  if (!state.hasSelectedHome || state.knownDetailsCount < 1) {
    return {
      message: "Add one home detail.",
      ctaLabel: "Add home detail",
    };
  }

  if (!state.hasComponentLikeDetail) {
    return {
      message: "Add a system or component.",
      ctaLabel: "Add component detail",
    };
  }

  return {
    message: "Create request details when you need work done.",
    ctaLabel: "Create request details",
  };
}

export function resolveDirectConnectFirstUseTaskPrompt(state: {
  requestCount: number;
  hasHomeIdContext: boolean;
}): FirstUseTaskPrompt {
  if (state.requestCount < 1) {
    return {
      message: "Start a local work request.",
      ctaLabel: "Start request",
    };
  }

  if (state.hasHomeIdContext) {
    return {
      message: "Link a HomeID to keep this request attached to the right home.",
      ctaLabel: "Link HomeID",
    };
  }

  return {
    message: "Review your request details before you submit.",
    ctaLabel: "Review requests",
  };
}

export function resolveScoutFirstUseTaskPrompt(state: {
  hasHomeIdUpdates: boolean;
  hasSavedContext: boolean;
}): FirstUseTaskPrompt {
  if (state.hasHomeIdUpdates) {
    return {
      message: "Review your HomeID updates.",
      ctaLabel: "Review HomeID",
    };
  }

  if (state.hasSavedContext) {
    return {
      message: "Review saved context.",
      ctaLabel: "Review context",
    };
  }

  return {
    message: "Start with HomeID or Direct Connect.",
    ctaLabel: "Pick a start",
  };
}
