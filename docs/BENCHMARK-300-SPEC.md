# CardSignal 300-Card Benchmark Portfolio

This account is an internal validation lab, not a showcase of the 300 most expensive cards.

## Purpose

The benchmark account should continuously test whether CardSignal's leading indicators behave differently across sports, card types, liquidity levels, eras, grades, and catalyst sensitivity.

The account must be resettable and reproducible. Every benchmark card is tagged `benchmark: true` and should be imported through the Benchmark Lab rather than hand-entered.

## Target size

Primary target: **300 exact card identities**.

Hard application ceiling for the current POC: **500 cards**.

## League allocation

Suggested initial mix:

| Segment | Target |
| --- | ---: |
| MLB | 75 |
| NBA | 60 |
| NFL | 55 |
| WNBA | 30 |
| NHL | 25 |
| Soccer / MLS / NWSL | 25 |
| College / prospects / other | 30 |
| **Total** | **300** |

These are test quotas, not market-size estimates. They can be adjusted after we see where exact comp coverage is strongest.

## Card-role mix

Within each major league, aim for a deliberate spread rather than only stars:

- established stars / high-liquidity veterans
- rookies
- prospects where relevant
- recently emerging players
- retired / vintage stars
- players vulnerable to injury, role-change, trade, call-up, playoff, award, and milestone catalysts

## Product / scarcity mix

The benchmark should include:

- base flagship cards
- Chrome / Prizm style flagship parallels
- numbered parallels
- autographs
- short prints / SSPs when exact identity can be established
- inserts
- raw cards
- PSA 9 / PSA 10 examples
- selected SGC / BGS / CGC examples when population data becomes reliable

Avoid letting one product family dominate the dataset.

## Era mix

Suggested portfolio-level mix:

- Vintage / pre-1980: 10%
- Junk-wax / 1980-1995: 10%
- Modern / 1996-2017: 25%
- Ultra-modern / 2018-present: 55%

This weighting intentionally favors cards likely to have enough online sales activity for repeated observation while retaining older comparison groups.

## Liquidity mix

Each league should include:

- highly liquid cards with frequent exact comps
- medium-liquidity cards
- scarce cards where supply movement matters more than raw sales velocity

Cards that repeatedly fail to produce exact evidence are still useful as a test of CardSignal's `NEEDS DATA` behavior, but they should not dominate the account.

## Import schema

Benchmark Lab accepts CSV or JSON. Recommended fields:

```text
player,year,setName,cardNumber,variant,league,mode,grader,grade,marketValue,purchasePrice
```

Only identity fields should be preloaded. Do not preload synthetic signals, market movements, scan histories, or grading populations.

## Success criteria

The Benchmark Health dashboard should eventually show:

- 300 benchmark identities loaded
- high player/year/set/card-number completeness
- broad league coverage
- repeated scan coverage on most cards
- 3+ accepted exact comps on a meaningful subset
- catalyst history across many unique players
- live-performance coverage across supported leagues
- grading-population coverage across graded cards
- enough repeated observations to evaluate 24h / 3d / 7d / 30d outcomes

## Scan cadence

The current client scanner saves every completed batch and supports up to 500 cards. Once server-side scheduling is available, the benchmark account should be scanned on a controlled recurring cadence rather than relying on someone leaving the app open.

The cadence must respect provider rate limits and API terms. More frequent scanning is not automatically better if it creates duplicate observations without meaningful new market evidence.

## Validation rule

Benchmark results remain descriptive until sample sizes are large enough to justify calibration.

Do not change the unified CardSignal Score because a small number of benchmark cards happened to move after a catalyst. The lab exists specifically to prevent that mistake.
