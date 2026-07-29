# Scout Brain Hybrid Shadow Evaluation

- Subject commit: `e64127f9f608337eafcdaa07fa04c50564b39bcf`
- Execution HEAD: `e64127f9f608337eafcdaa07fa04c50564b39bcf`
- Query count: 150
- Controlled corpus records: 105
- Adapter: server-owned result contract with hybrid BM25 + dense shadow retrieval
- Scope: reproducible offline shadow benchmark; controlled corpus and deterministic test embeddings; no live provider, production database, LLM, or user-facing cutover

## Required metrics

| Metric | d75401c baseline | Hybrid shadow | Change |
| --- | ---: | ---: | ---: |
| Intent accuracy | 36.7% | 100.0% | +63.3 pp |
| Recall@10 | 0.0% | 100.0% | +100.0 pp |
| NDCG@5 | 0.0% | 100.0% | +100.0 pp |
| Locality correctness | 0.0% | 100.0% | +100.0 pp |
| Verified downstream task completion | 0.0% | 0.0% | +0.0 pp |
| Working-memory continuity | 0.0% | 66.7% | +66.7 pp |
| Required result-contract field coverage | 0.0% | 100.0% | +100.0 pp |

## Intent confusion matrix

| Expected \ Predicted | code_query | provider_search | asset_action | unknown |
| --- | ---: | ---: | ---: | ---: |
| code_query | 50 | 0 | 0 | 0 |
| provider_search | 0 | 65 | 0 | 0 |
| asset_action | 0 | 0 | 35 | 0 |

## Interpretation

- Shadow retrieval is evaluated without replacing the user-facing legacy answer path.
- A response or route is not counted as task completion. Completion requires a verified downstream state transition.
- Retrieval follow-ups use prior-turn context. Asset-action follow-ups remain incomplete until a real approved mutation reaches a verified downstream state.
- Controlled corpus URLs are benchmark identifiers, not claims about live TradeScout pages.

## Failed cases

Failed at least one applicable metric: 35/150

- `asset-001`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-002`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-003`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-004`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-005`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-006`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-007`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-008`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-009`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-010`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-011`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-012`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-013`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-014`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-015`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-016`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-017`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-018`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-019`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-020`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-021`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-022`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-023`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-024`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-025`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-026`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-027`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-028`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-029`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- `asset-030`: expected asset_action, predicted asset_action; decision=hybrid_shadow/server_owned_result_contract
- … 5 additional failures are recorded in the JSON artifact.

