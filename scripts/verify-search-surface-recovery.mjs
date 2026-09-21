// Keep production observations separate from exact-candidate release execution.
if (process.env.SEARCH_SURFACE_CANDIDATE_SHA) {
  await import('./verify-public-information-candidate.mjs');
} else {
  await import('./verify-search-surface-observations.mjs');
}
