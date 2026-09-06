# CardSignal cleanup / tightening pass — 2026-09-05

Goal: reduce overlapping UI/logic, protect data integrity, and keep the product centered on Decision Brief + Edge Stack + validated historical evidence.

## Completed in this pass

- Removed the obsolete `add-card-identity-layer.tsx` overlay. The canonical search/confirmation flow in `functional-layer.tsx` remains the single visible Add Card identity path.
- Reduced the top toolbar from a long flat row to a focused everyday set plus a **Research Lab** menu.
  - Core: Decision Brief, Portfolio Pulse, Edge Stack, Live Market, Collection, Sell Prep, Discovery, Action Center, Pokémon.
  - Research Lab: analogs, playbooks, scorecard, validation tools, benchmark tools, performance/population research, etc.
- Added a compatibility guard so legacy 100-card add writers cannot silently destroy rows from a 500-card portfolio.
- Tightened league overrides: when multiple saved cards share a player, CardSignal no longer falls back to the first matching player if the visible exact card cannot be resolved.
- Tightened Historical Analogs:
  - current catalysts must be dated within seven days;
  - historical velocity context is only accepted when a scan exists within 36 hours of the event baseline;
  - prevents stale catalyst reads and distant-scan leakage into analog similarity.

## Known direct-write cleanup still to migrate

The compatibility guard is intentionally temporary. These legacy add paths still contain direct `slice(0,100)` collection writes and should be migrated to the shared 500-card convention:

- `src/app/functional-layer.tsx`
- `src/app/discovery-radar-layer.tsx`
- `src/app/market-scout-layer.tsx`

Do not remove `collection-capacity-guard-layer.tsx` until all three direct add paths have been migrated and searched again for hidden portfolio truncation.

## Intake architecture

The current photo flow has two layers by design:

1. `PhotoCatalogGuardLayer` intercepts visual identification so a visual model cannot directly establish canonical identity.
2. `PhotoOcrFallbackLayer` extracts factual clues and routes them back through catalog search/selection.

`functional-layer.tsx` still contains older visual-identification code behind the same button. Because the guard intercepts the action, that code is currently redundant. A later cleanup should move the guarded photo/OCR/catalog flow into one component and delete the dead visual path rather than maintaining both indefinitely.

## Product focus

New work should default to strengthening these surfaces rather than adding new standalone dashboards:

1. Decision Brief — primary decision surface.
2. Edge Stack — current leading/risk evidence.
3. Historical Analogs / Pattern Playbooks — validated context.
4. Signal Scorecard / Missed-Move Audit — self-grading.
5. Portfolio Pulse / Live Market — evidence collection.
6. Collection / Sell Prep — collector utility parity.

Research tools can remain available in Research Lab without competing for the main navigation.
