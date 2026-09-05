# CardSignal Roadmap

CardSignal's core product goal is to detect conditions that may precede sports-card price movement, while keeping observed evidence separate from unproven predictive claims.

## Current foundation

- Exact-card identity matching and completed-sale comp filtering
- Saved portfolio / watchlist and batch scanning
- 7-day price movement, accepted-sale count, sales velocity, confidence, and unified CardSignal Score
- Scan history, alerts, Action Center, Opportunity Feed, Decision Journal
- Leading Signal Edge Stack that separates early inputs (catalyst, performance, velocity acceleration, supply tightening) from price confirmation and downside risk
- Historical Analogs matching current catalyst/card setups against prior validated catalyst outcomes using category, league, card role, sensitivity, era, grading status, and liquidity context
- Pattern Playbooks that aggregate repeating catalyst × league × card-role × sensitivity setups and show sample size, median outcome, positive rate, large-move rate, and observed range
- News/catalyst tracking and catalyst integration into card detail / Action Center
- Catalyst Event History preserving first-seen and last-seen timestamps for later outcome validation
- Catalyst Outcome Lab matching first-seen events to later saved market scans at 24h / 3d / 7d / 30d horizons without interpolation
- Catalyst category outcome tables for comparing observed behavior by event type without changing the unified score
- Validation Cohorts for league, era, rookie/veteran role, catalyst sensitivity, grade status, and observed liquidity
- Discovery Radar for out-of-portfolio players with configurable price bands
- Market Scout for broad headline-driven discovery
- Supply Watch foundation for active eBay listings
- Grading Population history model with manual/API-ready snapshots and card-detail trend UI
- Portfolio-wide grading population alert view
- Segment Explorer for sport, era, role, grade status, and catalyst-sensitivity concentration
- Player Performance model, card-detail panel, and portfolio-wide Performance Watch
- Portfolio league filtering with explicit league overrides
- Benchmark Portfolio Seeder for repeatable CSV/JSON test-account datasets up to 500 cards, with benchmark-only reset behavior
- Benchmark Health and Scan Readiness dashboards for repeated-observation coverage and daily scan cadence

## Product differentiation focus

- [x] Separate leading evidence from lagging price confirmation in a portfolio-wide Edge Stack
- [x] Explain every Edge Stack classification with the underlying catalyst, performance, velocity, supply, price, risk, and missing-data factors
- [x] Keep Edge Stack readouts separate from the production CardSignal Score until historical validation supports calibration
- [x] Add historical analog matching for similar catalyst + velocity + card-segment setups
- [x] Compare each live catalyst setup with validated prior outcomes and show sample size / median outcome / positive-rate / large-move context
- [x] Add Pattern Playbooks for catalyst-category × league × role × sensitivity cross-analysis
- [x] Add explicit sample-quality gates so thin patterns remain visible without being treated as reliable
- [ ] Surface the most relevant validated playbook directly inside each live Edge Stack card
- [ ] Extend analog matching to full performance + supply-state snapshots once those histories are dense enough at event time
- [ ] Promote only statistically credible validated factors into the unified Score

## Internal validation / benchmark roadmap

- [x] Benchmark CSV / JSON import format
- [x] Benchmark-only tagging and safe reset that preserves real collector cards
- [x] Raise primary portfolio editor capacity to 500 saved cards
- [x] Raise Portfolio Pulse scanning/write capacity to 500 cards with controlled batching and stop-after-batch behavior
- [x] Add benchmark health metrics: cards scanned, exact-comp coverage, stale scans, catalyst coverage, performance coverage, and population coverage
- [x] Add scan-readiness queue with unscanned / overdue / due / soon / fresh status and league filtering
- [x] Add validation cohort analysis with minimum-sample labels
- [x] Audit remaining collection write paths for hidden 100/150-card truncation; remove obsolete 150-card Portfolio Pulse implementation
- [x] Define machine-readable 300-card benchmark target quotas and curation rules in `data/benchmark/benchmark-300-targets.json`
- [ ] Curate the first ~300 exact card identities across leagues, eras, grades, liquidity, price bands, rookie/veteran roles, and base/parallel/auto/scarcity profiles
- [ ] Add scheduled background benchmark scans after Supabase/Vercel deployment
- [ ] Persist server-run scan jobs and job health after cloud deployment

## Leading-indicator roadmap

### P0 — easiest / immediate

- [x] Preserve scan snapshots with velocity so velocity can be compared over time
- [x] Velocity Acceleration: compare current sales velocity with prior scans and flag demand acceleration before price fully reacts
- [x] Card Market Segmentation: classify cards by era, rookie/prospect indicators, grade/raw status, and scarcity clues from identity text
- [x] Catalyst Sensitivity Context: show that rookies, prospect cards, numbered parallels, autos, SSPs, and low-supply cards may react differently from modern base cards without yet modifying the CardSignal Score
- [x] Surface market-context and velocity-acceleration evidence in individual Card Detail
- [ ] Use segmentation in Opportunity Feed / Discovery ranking after enough validation

### P1 — high-value data integrations

- [~] Player Performance Engine for MLB / NBA / WNBA / NFL
  - [x] normalized performance snapshot model and direction/confidence logic
  - [x] card-detail performance panel
  - [x] portfolio-wide Performance Watch
  - [ ] live box-score deltas vs season baseline
  - [ ] streaks / season highs / role changes from live feeds
  - [ ] transactions / call-ups / injuries / starting-status changes
  - [ ] independent live performance catalyst separate from headline sentiment
- [~] Grading Population Monitor
  - [x] population snapshot/history schema by exact saved card, provider, and grade
  - [x] card-detail population monitor with baseline / growth status
  - [x] 30D / 90D growth calculations when sufficient snapshots exist
  - [x] explicit manual-vs-API source tagging so no population value is inferred or fabricated
  - [x] high-grade supply acceleration alerts across the portfolio
  - [ ] connect PSA population source when approved/reliable access exists
  - [ ] stagnant-pop scarcity support in Opportunity ranking after validation
  - [ ] add BGS / SGC / CGC adapters when reliable sources are available
- [ ] eBay active-supply production integration
  - listing count trend
  - median / low ask trend
  - sold-vs-ask spread
  - tightening / loosening supply
- [ ] Product release / checklist calendar catalysts
  - Topps / Bowman / Prizm / National Treasures and other major releases
  - prospect-to-rookie transition windows
  - debut patches / major insert launches

### P2 — broader market context

- [x] Sport and era segment views: MLB / NBA / WNBA / NFL; vintage / modern / ultra-modern
- [x] Rookie / prospect / veteran grouping view
- [x] Raw / graded / grader-grade grouping view using available saved identity data
- [ ] GOAT grouping rules after a reliable player classification source exists
- [ ] High-pop / medium-pop / scarce segmentation once grading-pop data exists broadly enough
- [ ] Market regime / index layer using legal and reliable aggregate sources
- [ ] Major event calendar: playoffs, finals, World Series, Super Bowl, Hall of Fame, major collector shows

### P3 — historical learning

- [x] Catalyst event history with first-seen timestamps
- [x] Correlate catalysts with later scan outcomes without claiming causation
- [x] Historical analog matching: similar catalyst + velocity + segment profiles
- [~] Measure outcome rates at 24h / 3d / 7d / 30d
  - [x] card-level median change at each horizon when a nearby saved scan exists
  - [x] aggregate matched-count / median / average / positive-rate calculations
  - [x] category-by-category outcome tables
  - [x] league / era / card-role / grade-status / sensitivity / liquidity cohort breakdowns
- [~] Learn which catalyst categories matter most by sport and card segment
  - [x] descriptive category outcome layer
  - [x] minimum sample thresholds and confidence labels for cohort comparison
  - [x] league / era / role / sensitivity / grade / liquidity breakdown framework
  - [x] catalyst-category × league × role × sensitivity Pattern Playbooks
- [ ] Calibrate Catalyst Sensitivity weights only after sufficient labeled history
- [ ] Decide whether validated signals should enter the unified CardSignal Score

## Guardrails

- Do not label correlations as causes.
- Do not fabricate market/index/population values when a source is unavailable.
- Keep heuristic catalyst impact separate from the unified score until validated.
- Prefer exact sold evidence over broad search counts.
- New discovery cards receive a Discovery Buy Watch, not a portfolio BUY MORE signal, until enough card-specific history exists.
- Segment / sensitivity labels are context, not investment guarantees.
- Thin validation cohorts remain visible but must not drive score tuning.
