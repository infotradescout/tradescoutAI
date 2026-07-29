# Scout Brain Baseline

- Subject commit: `d75401caca311552d4fd0108c8ae47aff2d7c010`
- Execution HEAD: `d75401caca311552d4fd0108c8ae47aff2d7c010`
- Query count: 150
- Controlled corpus records: 105
- Adapter: legacy deterministic Scout decision pipeline
- Scope: reproducible offline benchmark; no live provider, production database, or LLM calls

## Required metrics

| Metric | Baseline |
| --- | ---: |
| Intent accuracy | 36.7% |
| Recall@10 | 0.0% |
| NDCG@5 | 0.0% |
| Locality correctness | 0.0% |
| Verified downstream task completion | 0.0% |
| Working-memory continuity | 0.0% |
| Required result-contract field coverage | 0.0% |

## Intent confusion matrix

| Expected \ Predicted | code_query | provider_search | asset_action | unknown |
| --- | ---: | ---: | ---: | ---: |
| code_query | 0 | 20 | 0 | 30 |
| provider_search | 0 | 45 | 0 | 20 |
| asset_action | 0 | 5 | 10 | 20 |

## Interpretation

- The legacy pipeline does not emit ranked entities or cited evidence through one result contract, so retrieval metrics and locality correctness cannot pass.
- A response or route is not counted as task completion. Completion requires a verified downstream state transition.
- Memory cases require prior-turn context to affect the result; the legacy adapter records no working-memory use.
- Controlled corpus URLs are benchmark identifiers, not claims about live TradeScout pages.

## Failed cases

Failed at least one applicable metric: 150/150

- `provider-001`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-002`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-003`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-004`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-005`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-006`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-007`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-008`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-009`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-010`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-011`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-012`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-013`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-014`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-015`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-016`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-017`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-018`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-019`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-020`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-021`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-022`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-023`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-024`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-025`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-026`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-027`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-028`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-029`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- `provider-030`: expected provider_search, predicted provider_search; decision=deterministic_route/home_project_routing
- … 120 additional failures are recorded in the JSON artifact.

