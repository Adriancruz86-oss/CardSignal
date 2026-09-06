# CardSignal cleanup / tightening pass — 2026-09-05

Goal: reduce overlapping UI/logic, protect data integrity, and keep the product centered on Decision Brief + Edge Stack + validated historical evidence.

## Completed in this pass

- Removed the obsolete `add-card-identity-layer.tsx` overlay. `functional-layer.tsx` is the single Add Card identity path.
- Reduced the top toolbar to a focused everyday set plus a **Research Lab** menu.
- Tightened exact-card league editing and league inference.
- Tightened Historical Analogs so stale catalysts and distant baseline scans cannot masquerade as contemporaneous context.
- Migrated the primary Add Card, Discovery Radar, and Market Scout portfolio writers to the 500-card ceiling.
- Removed the temporary `CollectionCapacityGuardLayer` after the known legacy 100-card collection writers were migrated.
- Discovery Radar and Market Scout now dedupe on player + year + set + card number + variant rather than player/year/card-number shortcuts that could collapse legitimate parallels.
- Discovery/Scout additions now retain a canonical-identity-shaped record for later exact-card analysis.
- Removed the first-generation generated/clip-art UI library from `public/assets`.
- Removed generated-logo, background, slab-frame, camera-icon, collection-icon, badge, frame, and other static-art dependencies from the active UI.
- Replaced the original mock-heavy dashboard with a lean CSS-only scaffold. It now starts with truthful empty states and lets the live data layers populate the interface.
- Rebuilt Card Detail fallback card, photo placeholders, portfolio empty state, radar ornaments, and market framing with CSS/native text only.
- Removed the obsolete `PhotoCatalogGuardLayer` and `PhotoOcrFallbackLayer` interception overlays so there is no second hidden Add Card UI pipeline competing with the main form.
- Consolidated Add Card photo recognition and catalog confirmation into one component.
- Fixed the photo-identification handoff: a visual result now fills search clues and deliberately returns the user to catalog selection instead of silently becoming canonical identity.
- Added duplicate exact-card prevention and an explicit 500-card limit message to Add Card.
- Removed the no-longer-used `tesseract.js` dependency.
- Removed unused Next.js starter SVGs and stray `.DS_Store` files from `public`.

## Exact-card identity integrity pass

Card-level state must now resolve to a saved card ID rather than silently falling back to the first card belonging to the same player.

- Card Detail writes `data-user-card-id` on the open modal so downstream tools have a stable exact-card target.
- Card Detail itself now resolves by card ID first, exact normalized player + metadata second, and only allows a player-only fallback when exactly one saved card exists for that player.
- League editing reads the open card ID and updates only that exact saved card.
- Supply Watch resolves the exact open card before attaching or writing supply history.
- Market Context resolves the exact open card before reading card-level velocity and segment state.
- Unified Score injection resolves the Card Detail modal by card ID and refuses ambiguous player-only matches.
- Live valuation application and low-confidence valuation override update one resolved card ID only; ambiguous parallels are not modified.
- Opportunity actions resolve exact card IDs before rescanning, moving between owned/watchlist, journaling, dismissing, or flagging buy/sell candidates.
- Grading-population history remains keyed by card ID. 30D/90D comparisons are additionally constrained to the same provider and grade.
- Restored the missing grading-population alert layer. Population acceleration alerts are generated per exact `cardId + provider + grade` combination.
- Player performance remains intentionally player-level, but the open exact card determines league context so a same-name or cross-league record cannot be borrowed accidentally.
- Signal Scorecard performance lookup is now also league-scoped using the card's resolved league.
- Catalyst headlines remain intentionally player-level. In Action Center, one player catalyst now fans out to every matching saved card by exact card ID rather than attaching to only one arbitrary card.
- Catalyst Outcome rows remain card-ID-specific. A catalyst/card outcome now requires a contemporaneous price baseline no more than 36 hours before or 12 hours after first observation; old stale scans are no longer accepted as the event baseline.
- Later outcome scans must occur after the baseline and stay inside the configured horizon tolerance.

### Resolver rule

For card-level reads or writes, use this order:

1. exact saved card ID (`data-user-card-id`, event `cardId`, or stored `cardId`),
2. exact normalized player + visible card metadata when it resolves to one row,
3. player-only fallback only when exactly one saved card exists for that player,
4. otherwise stop and show/return unresolved rather than guessing.

Player-level datasets such as news catalysts and real-world performance can remain keyed by player, but any application of those datasets to collection state must retain the exact card ID.

## Static UI policy

CardSignal's application chrome is CSS-first.

- Do not add generated clip art, decorative PNG/JPG/WebP assets, sprite sheets, faux slab frames, or image-based UI controls.
- User-uploaded card photographs are expected and remain supported.
- A real future brand mark/favicon can be added deliberately if needed; it should not become a dependency for layout or functionality.
- Prefer CSS borders, gradients, typography, native symbols, and simple SVG/chart primitives produced by the application itself.

This keeps the interface easier to maintain and prevents visual assets from hiding functional regressions.

## Portfolio write policy

All writes to `cardsignal-added-cards` must preserve the 500-card application ceiling.

- Result caches may use smaller independent caps for performance; those are not portfolio limits.
- New discovery/watchlist writers must use exact identity including variant/parallel when checking duplicates.
- Do not reintroduce global `Storage.prototype` interception as a compatibility fix. Fix the writer directly.

## Intake architecture

The intended Add Card path is now:

1. Add Card owns photo upload, manual entry, catalog search, and save.
2. Photo recognition may propose player/year/set/card-number/parallel clues.
3. The visual result is converted into a catalog search query.
4. Catalog selection establishes confirmed identity.
5. Manual entry can still be saved when no catalog match is reliable, but it remains explicitly unconfirmed.
6. No secondary DOM interception layer should rewrite or compete with the form.

## Product focus

New work should default to strengthening these surfaces rather than adding new standalone dashboards:

1. Decision Brief — primary decision surface.
2. Edge Stack — current leading/risk evidence.
3. Historical Analogs / Pattern Playbooks — validated context.
4. Signal Scorecard / Missed-Move Audit — self-grading.
5. Portfolio Pulse / Live Market — evidence collection.
6. Collection / Sell Prep — collector utility parity.

Research tools can remain available in Research Lab without competing for the main navigation.

## Verification still required

The GitHub connector cannot execute the Next.js build. Run `npm run build` after pulling this cleanup batch and fix any compiler/runtime regressions before treating the pass as fully verified.
