# CardSignal Portfolio Capacity Audit

Goal: make the current POC safe for the planned ~300-card benchmark account while retaining a 500-card application ceiling.

## Active card-storage paths

- `src/app/user-card-layer.tsx` — saves `cardsignal-added-cards` with `MAX_SAVED_CARDS = 500`.
- `src/app/portfolio-pulse-v2.tsx` — saves with `MAX_CARDS = 500`; batch scanning persists after each batch.
- `src/app/benchmark-portfolio-layer.tsx` — imports up to 500 and preserves benchmark-only reset behavior.
- valuation, live-market, league editor, identity editor, opportunity actions, and workbench paths update the full array rather than truncating it.
- cloud sync captures the entire `cardsignal-added-cards` value as part of the user-state payload.

## Removed risk

The repository still contained an obsolete `portfolio-pulse-layer.tsx` implementation with a hard `slice(0, 150)` write limit. It was not mounted by `layout.tsx`, but leaving it in the tree made accidental reintroduction possible. The obsolete file has been removed.

## Search result

A repository search for `cards.slice(0` now leaves only the active 500-card bounded writers. Other `slice(0, N)` calls in CardSignal are result-history, headline, candidate, or UI-display caps rather than collection-storage caps.

## Remaining practical limits

The 500-card ceiling is an intentional POC guardrail, not the long-term data model. Before production-scale collections:

- move card records out of one localStorage JSON array and into normalized Supabase rows;
- move photos/base64 payloads to object storage;
- move repeated scan/catalyst/performance/population observations to append-only database tables;
- run benchmark scans server-side rather than requiring an open browser;
- enforce provider-specific rate limits and resumable scan jobs.

## Benchmark readiness conclusion

The client collection paths are now structurally safe for a 300-card benchmark account under the current 500-card POC ceiling. The next bottleneck is not collection truncation; it is persistent cloud storage, scheduled scanning, and provider throughput.
