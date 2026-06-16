# The Kaval report format

A Kaval report is a JSON document describing what changed in a repo's recent
history and, for each change that later needed a fix, whether running both
versions would have surfaced it before merge. The format is open so anyone can
render, store, diff, or build on a report without our tools. `bin/render.mjs`
is a reference renderer; `examples/report.sample.json` is a full example.

It is deliberately honest: the scoreboard carries the denominator and the
misses. A report that only listed hits would not be worth trusting.

```jsonc
{
  "kaval": 1,                          // format version
  "repo": "dubinc/dub",
  "url": "https://app.usekaval.com/run/dubinc/dub",  // optional: the live report
  "generatedAt": "2026-06-15T00:00:00Z",

  "scope": {
    "commitsScanned": 200,
    "fixLike": 29                      // commits whose message looks like a fix
  },

  "scoreboard": {
    "analyzed": 16,                    // incidents replayed (a change later fixed)
    "flagged": 11,                     // incidents where Kaval pointed at the culprit
    "strong": 4,                       // of those, how many had executed proof
    "blocked": 0,                      // would-block verdicts (executed, unlicensed, reproduced)
    "escalated": 5,                    // worth-a-human-look verdicts
    "missed": 5,                       // incidents Kaval did NOT flag — listed on purpose
    "control": {
      "clean": 27,                     // commits that never needed a fix, run through the same pipeline
      "falseBlocks": 0                 // blocks raised on clean commits — the number to keep at 0
    }
  },

  "incidents": [
    {
      "verdict": "flagged",            // flagged | blocked | escalated | missed | set-aside
      "strong": true,                  // backed by executed before/after evidence
      "culprit": { "sha": "c2c6705", "subject": "feat: per-plan payment behavior" },
      "fix":     { "sha": "5bee35d", "subject": "fix: stripe payment_behavior ..." },
      "file": "apps/web/lib/stripe/checkout.ts",
      "func": "resolvePaymentBehavior",
      "title": "Executed behavior change: a missing subscription status now returns a different default",
      "evidence": {
        "kind": "executed",           // executed | calls | none
        "input": "subscription with no status",
        "before": "\"default_incomplete\"",
        "after": "\"allow_incomplete\""
      }
    }
  ]
}
```

## Verdicts

| verdict      | meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `flagged`    | Kaval surfaced the culprit; a reviewer should confirm it.               |
| `blocked`    | An executed behavior change outside the change's stated intent, reproduced. A merge gate could stop on this. |
| `escalated`  | A change worth a human look (e.g. executed flip with no stated intent). |
| `missed`     | Kaval did not flag this incident. Listed on purpose.                    |
| `set-aside`  | Cosmetic / CI-churn / additive — excluded from the denominator, not a win or a loss. |

## Evidence kinds

- **`executed`** — both versions ran on the same `input`; `before` and `after`
  are the observed results. The strongest claim: observed, not inferred.
- **`calls`** — the ordered set of dependency calls changed; `removed` / `added`
  are the lines that differ.
- **`none`** — no function-shaped behavior to execute (e.g. a config-only
  change). Honest about why nothing was flagged.

## Stability

`kaval: 1` is stable. New optional fields may be added within v1; consumers
should ignore unknown fields. Breaking changes bump the version.
