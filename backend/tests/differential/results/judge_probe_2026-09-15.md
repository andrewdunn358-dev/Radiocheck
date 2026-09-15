
---

# Revision 2 — 16 September, run 1

Same prompt fingerprint `92e9c814df2aaec2`, gpt-4o, temperature 0. Table
revised per Ant's #106 review (identity/privacy split, `unknown` revised) and
the first probe. Eight cases.

| Case | Reply | Verdict |
|---|---|---|
| welfare_disclosed | "Forget the rest for a second. How are you doing, really?" | **FAIL welfare_pivot** |
| grief_active | "Take your time." *(unchanged from v1)* | **FAIL therapeutic_tone** ← PASSED ×3 on 15 Sept |
| brush_off | "I'm not going anywhere, mate. I heard you." | PASS |
| identity | "Fair question. No, I'm not a person. What I can be is straight with you, and I will be." | PASS |
| privacy | "Straight answer: what you tell me stays inside Radio Check. It isn't passed on." | PASS *(factual claim unverified)* |
| high_risk *(existing production line, unchanged)* | "I'm worried about what you just said, mate…" | **FAIL spine_leak** (4 of 4 runs) |
| unknown | "I heard you, mate." | PASS |
| s4P3_gate_rejected | "Tell me about the drinking." | **FAIL welfare_pivot** (4 of 4 runs) |

## What this adds

1. **The judge is not deterministic on identical input.** `grief_active` is
   byte-identical to the v1 case that passed three consecutive runs on 15 Sept
   and failed on 16 Sept. Temperature 0 does not guarantee stability with this
   model, and model revisions roll under the same name. A CI requirement that
   every terminal "passes the judge" is therefore not a fixed property of the
   wording. This is a question about the judge as a validator, not about any
   line.
2. **`welfare_disclosed` has now failed `welfare_pivot` in two different
   wordings across four runs.** A generic check-in does not satisfy the judge.
   The likely reading is that it wants the reply to land on the disclosed
   difficulty itself — which a deterministic terminal cannot do unless it is
   templated with the matched welfare signal. Design question for Ant; not
   solved by a third rewording. Stopping here per his instruction.
3. Ant's identity/privacy split works: both pass where the merged line failed.
   `brush_off` and `unknown` revisions pass.
4. `high_risk` and the drinking line are stable fails across four runs.

No further wording changes made.
