# CardSignal Roadmap

CardSignal's core product goal is to detect conditions that may precede sports-card price movement, while keeping observed evidence separate from unproven predictive claims.

## Current foundation

- Exact-card identity matching and completed-sale comp filtering
- Saved portfolio / watchlist and batch scanning
- 7-day price movement, accepted-sale count, sales velocity, confidence, and unified CardSignal Score
- Scan history, alerts, Action Center, Opportunity Feed, Decision Journal
- News/catalyst tracking and catalyst integration into card detail / Action Center
- Catalyst Event History preserving first-seen and last-seen timestamps for later outcome validation
- Discovery Radar for out-of-portfolio players with configurable price bands
- Market Scout for broad headline-driven discovery
- Supply Watch foundation for active eBay listings
- Grading Population history model with manual/API-ready snapshots and card-detail trend UI
- Portfolio-wide grading population alert view
- Segment Explorer for sport, era, role, grade status, and catalyst-sensitivity concentration
- Player Performance model, card-detail panel, and portfolio-wide Performance Watch
- Portfolio league filtering with explicit league overrides

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
- [ ] Correlate catalysts with later scan outcomes without claiming causation
- [ ] Historical analog matching: similar catalyst + velocity + segment profiles
- [ ] Measure outcome rates at 24h / 3d / 7d / 30d
- [ ] Learn which catalyst categories matter most by sport and card segment
- [ ] Calibrate Catalyst Sensitivity weights only after sufficient labeled history
- [ ] Decide whether validated signals should enter the unified CardSignal Score

## Guardrails

- Do not label correlations as causes.
- Do not fabricate market/index/population values when a source is unavailable.
- Keep heuristic catalyst impact separate from the unified score until validated.
- Prefer exact sold evidence over broad search counts.
- New discovery cards receive a Discovery Buy Watch, not a portfolio BUY MORE signal, until enough card-specific history exists.
- Segment / sensitivity labels are context, not investment guarantees.
