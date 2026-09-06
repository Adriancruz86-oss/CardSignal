# CardSignal cleanup / tightening pass — 2026-09-05

Goal: reduce overlapping UI/logic, protect data integrity, and keep the product centered on Decision Brief + Edge Stack + validated historical evidence.

## Completed in this pass

- Removed the obsolete `add-card-identity-layer.tsx` overlay. `functional-layer.tsx` is the single Add Card identity path.
- Reduced the top toolbar to a focused everyday set plus a **Research Lab** menu.
- Added a temporary compatibility guard so legacy 100-card add writers cannot silently destroy rows from a 500-card portfolio.
- Tightened exact-card league editing and league inference.
- Tightened Historical Analogs so stale catalysts and distant baseline scans cannot masquerade as contemporaneous context.
- Migrated the primary Add Card writer from 100 to 500 cards.
- Removed the first-generation generated/clip-art UI library from `public/assets`.
- Removed generated-logo, background, slab-frame, camera-icon, collection-icon, badge, frame, and other static-art dependencies from the active UI.
- Rebuilt the main dashboard shell, Card Detail fallback card, photo placeholders, portfolio empty state, radar ornaments, and market framing with CSS/native text only.
- Removed the obsolete `PhotoCatalogGuardLayer` and `PhotoOcrFallbackLayer` interception overlays so there is no second hidden Add Card UI pipeline competing with the main form.
- Removed unused Next.js starter SVGs and stray `.DS_Store` files from `public`.

## Static UI policy

CardSignal's application chrome is CSS-first.

- Do not add generated clip art, decorative PNG/JPG/WebP assets, sprite sheets, faux slab frames, or image-based UI controls.
- User-uploaded card photographs are expected and remain supported.
- A real future brand mark/favicon can be added deliberately if needed; it should not become a dependency for layout or functionality.
- Prefer CSS borders, gradients, typography, native symbols, and simple SVG/chart primitives produced by the application itself.

This keeps the interface easier to maintain and prevents visual assets from hiding functional regressions.

## Known direct-write cleanup still to migrate

The compatibility guard is intentionally temporary. These remaining feature paths still need their portfolio add writers migrated to the shared 500-card convention:

- `src/app/discovery-radar-layer.tsx`
- `src/app/market-scout-layer.tsx`

The `slice(0,100)` cap on discovery *result caches* is not a portfolio-capacity bug and can remain bounded. Only writes to `cardsignal-added-cards` must honor the 500-card collection ceiling.

Do not remove `collection-capacity-guard-layer.tsx` until both remaining collection writers have been migrated and the repository has been searched again for hidden portfolio truncation.

## Intake architecture

The intended Add Card path is now simpler:

1. Add Card form owns photo upload, manual entry, catalog search, and save.
2. Photo identification may provide a clue, but catalog selection should establish canonical identity.
3. Manual entry remains available when no catalog result is reliable.
4. No second DOM interception layer should rewrite or compete with the form.

The remaining intake cleanup is to make the visual-result handoff explicitly return to catalog confirmation instead of treating a visual suggestion as canonical.

## Product focus

New work should default to strengthening these surfaces rather than adding new standalone dashboards:

1. Decision Brief — primary decision surface.
2. Edge Stack — current leading/risk evidence.
3. Historical Analogs / Pattern Playbooks — validated context.
4. Signal Scorecard / Missed-Move Audit — self-grading.
5. Portfolio Pulse / Live Market — evidence collection.
6. Collection / Sell Prep — collector utility parity.

Research tools can remain available in Research Lab without competing for the main navigation.
