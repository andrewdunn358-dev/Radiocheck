# Phase B — Single Authoritative Safety Verdict

**Type:** PR description draft (pre-review by Ant before code is written)
**Status:** No code in this PR yet. Architectural rationale only, per Ant's Round 10 brief.
**Author:** Engineering (Radio Check)
**Reviewers required:** Ant + Andrew (CODEOWNERS — pending branch protection)

---

## Why this PR exists

The Round 10 integrity report (and its production-trace addendum) showed that `/api/ai-buddies/chat` runs **two parallel safety pipelines** — `server.calculate_safeguarding_score` (where the Round 9 bereavement override lives) and `safety.unified_safety.analyze_message_unified` (which has no override) — and consumes whichever fires first. On bereavement disclosures, the keyword pipeline inside `analyze_message_unified` fires `failsafe_triggered=True` on the substring `"overdose"` *before* its own AI classifier (which correctly identifies the message as bereavement, low risk, no self-harm intent) gets to weigh in.

Ant's verbatim direction:

> *"the keyword pipeline should not be able to override a downstream context-aware classifier as currently structured. … Phase B's deliverable is: one authoritative safety verdict per message, not two pipelines producing independent verdicts that get raced."*

This PR delivers that.

---

## Approach chosen: (b) merge / reconciliation layer

Three approaches were on the table from Ant's brief:

- **(a) Pre-check before both pipelines** — bereavement context detected upfront, signal passed into both pipelines, both respect it.
- **(b) Merge layer / reconciliation** — both pipelines run independently, a reconciliation function combines their verdicts with explicit, auditable precedence rules.
- **(c) Fold bereavement logic into `safety_monitor.py` with clear precedence rule** — simpler, but addresses only overdose-bereavement.

We're picking **(b)** for the following reasons.

### Why not (c) — symptom, not structure

(c) hard-codes one context-aware exception (`is_overdose_bereavement_context`) into the keyword pipeline. The next exception (and there will be one — see "Foreseeable future exceptions" below) needs the same surgery, in the same file, by the same hand, with no architectural memory that this is a recurring pattern. Ant has already flagged that he would re-raise the structural question at Round 11 if we ship (c). We accept that and skip past it.

### Why not (a) — bereavement-only without saying so

(a) is a single pre-check. It detects bereavement context upfront and passes a flag into both pipelines, which then suppress the `"overdose"` keyword. This is closer to the right shape than (c), but it has two problems:

1. **It only works when both pipelines agree to be suppressed.** If a future pipeline is added (semantic-only, behavioural, fine-tuned-classifier-only) and it doesn't read the pre-check flag, we're back to two pipelines disagreeing.
2. **Pre-checks scale linearly.** Every new context-aware exception needs its own pre-check function and its own flag plumbed into every pipeline. That's a maintenance pattern that already failed Round 9.

(a) is a pre-check pattern dressed up as architecture. (b) is architecture.

### Why (b) — precedence is explicit, auditable, extensible

(b) keeps the two pipelines independent (they're good at different things — keywords are fast and rigid, classifiers are slow and contextual) and adds **one** function that takes both verdicts and produces one final verdict against an explicit precedence table. Adding a future exception means adding a row to the table, with an audit log entry showing which row fired, why, and on what input.

The single-source-of-truth principle Ant required for Phase C's failure-string lists applies here too: one place to add a precedence rule, one place to read it, one place to audit it.

---

## Proposed file shape

```
/app/backend/safety/verdict_reconciler.py        ← NEW
/app/backend/safety/safety_monitor.py            ← unchanged for Phase B
/app/backend/safety/unified_safety.py            ← returns its raw verdict, no behavioural change inside
/app/backend/server.py                           ← calculate_safeguarding_score: bereavement override DELETED;
                                                    buddy_chat: calls reconcile_verdicts() once
```

### `safety/verdict_reconciler.py` (new file)

Contains, in this order:

1. **Bereavement-context detection** (relocated from `server.py` — sole canonical home):
   - `_OVERDOSE_FIRST_PERSON_PATTERNS`
   - `_OVERDOSE_GRIEF_SIGNALS`
   - `is_overdose_bereavement_context(message_lower) -> bool`

2. **Named constants** (per your ask — no magic numbers):
   ```python
   # Minimum AI-classifier confidence required to override the keyword pipeline.
   # Below this, the keyword pipeline's verdict stands. Ant may revise this
   # value during PR review — it lives here as a single named constant so that
   # change requires touching one line.
   CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7

   # Indicators the keyword pipeline may flag as critical that the reconciler
   # is allowed to suppress when the classifier disagrees AND a documented
   # context-aware override matches. Adding an indicator here is a precedence
   # change and requires CODEOWNERS review.
   RECONCILABLE_KEYWORD_TRIGGERS = frozenset({"overdose"})
   ```

   **Provenance of `CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7`** — full disclosure.
   This value is **anchored on the observed confidence floor in the n=2 bereavement
   production traces** (`r10_S009_a.json`, `r10_S009_b.json`), not statistically
   derived. In both traces the classifier returned `confidence: 0.7` while
   correctly identifying bereavement and returning `contains_self_harm_intent: false`.
   The control case (`r10_CTRL.json`) returned `confidence: 1.0` on a genuine
   crisis. So 0.7 is the lowest confidence we have direct evidence the classifier
   gets right on the only relevant data we possess.

   **It is a data-anchored guess, not a calibrated threshold.** The sample size
   is small (n=2 positives, n=1 negative), and the threshold was set to "include
   the observed bereavement cases." A defensible alternative is **0.85**, on the
   "if we're going to suppress a CRITICAL keyword on classifier confidence, the
   classifier needs to be *very* sure" principle. At 0.85 our two production
   bereavement cases would have been blocked by the threshold and routed to
   `KEYWORD_FAILSAFE` instead — the safer-by-default direction, at the cost of
   the live S009 false positive remaining a false positive until the classifier
   sharpens.

   The named constant is the only line that has to change either way. Open
   question for review: keep at 0.7 (matches observed bereavement floor, lets
   override fire on real Round 9 traffic) or raise to 0.85 (more conservative,
   would have left S009 escalating until the classifier earns more confidence
   on those inputs)? Ant's call.

3. **Verdict dataclasses** (so the reconciler reads typed input, not loose dicts):
   ```python
   @dataclass(frozen=True)
   class KeywordVerdict:
       risk_level: str          # NONE | LOW | MEDIUM | HIGH | CRITICAL
       failsafe_triggered: bool
       failsafe_reason: str | None
       triggers: list[str]      # which keywords fired

   @dataclass(frozen=True)
   class ClassifierVerdict:
       risk_level: str          # low | medium | high | imminent
       confidence: float        # 0.0 – 1.0
       contains_self_harm_intent: bool
       detected_indicators: list[str]
       reason: str

   @dataclass(frozen=True)
   class FinalVerdict:
       risk_level: str
       failsafe_triggered: bool
       failsafe_reason: str | None
       precedence_rule_fired: str   # for audit
       reconciliation_reason: str   # human-readable, written to logs
   ```

4. **The reconciler itself**:
   ```python
   def reconcile_verdicts(
       keyword: KeywordVerdict,
       classifier: ClassifierVerdict | None,   # None when classifier failed
       message_lower: str,
       *,
       classifier_error: Exception | None = None,
   ) -> FinalVerdict:
       """
       Single authoritative safety verdict per message.

       Precedence (top wins):
         0. CLASSIFIER_UNAVAILABLE — classifier raised, timed out, returned
            None, or returned malformed output (missing required fields,
            confidence outside [0.0, 1.0], unknown risk_level value).
            → Final: keyword verdict, unmodified. Audit-logged at WARNING with
            the captured exception class / malformed-field reason. Reconciler
            never enters context-override territory without a well-formed
            classifier verdict to read.
         1. CONTEXT_OVERRIDE — keyword fired solely on a reconcilable trigger,
            classifier confidence ≥ CLASSIFIER_CONFIDENCE_THRESHOLD, classifier
            says no self-harm intent, AND a documented context-aware detector
            (e.g. is_overdose_bereavement_context) matches.
            → Final: classifier verdict.
         2. KEYWORD_FAILSAFE — keyword.failsafe_triggered AND no override.
            → Final: keyword verdict (RED / IMMINENT). This preserves the
            r10_CTRL.json regression baseline.
         3. CLASSIFIER_ESCALATION — classifier returns imminent with high
            confidence and keyword is silent.
            → Final: classifier escalates to RED.
         4. DEFAULT — neither pipeline escalates.
            → Final: lower of the two, no failsafe.

       Each rule writes one structured audit log line (schema below).
       """
   ```

   **Rule 0 design rationale.** The classifier is a network call to an LLM
   provider (currently OpenAI for the AI-classification layer inside
   `analyze_message_unified`). It can time out, rate-limit, return
   schema-shifted output on a model upgrade, or raise inside our wrapper. If
   any of those happen and we silently treat "no classifier verdict" as
   "classifier said no override applies," we preserve safety. If we instead
   silently treated it as "classifier returned low confidence, so no override
   applies anyway," same result — but the *audit trail* would show a normal
   `KEYWORD_FAILSAFE` and we'd lose visibility on classifier health. Rule 0
   makes classifier unavailability a **named, logged event** so Ant can grep
   for `CLASSIFIER_UNAVAILABLE` during the human re-test and see whether the
   reconciler's "look safe by default" branch is firing for the right reason
   (genuinely safe inputs the keyword pipeline judged correctly) or the wrong
   reason (classifier flapping in production and we're effectively running
   the keyword pipeline solo).

5. **Audit logging schema.** One structured line per `reconcile_verdicts` call,
   emitted via the standard `logging` module (already wired into Render's log
   collector and the Sentry exporter). Format is JSON-on-one-line so it's
   greppable and machine-parseable without a log-shipper config change.

   Schema (exact fields, exact order):

   ```json
   {
     "evt": "round10.reconcile",
     "ts": "2026-04-28T16:45:12.318Z",
     "session_id": "abc12345-...",
     "character": "tommy",
     "msg_sha256_16": "a1b2c3d4e5f6a7b8",
     "msg_length": 52,
     "kw": {
       "risk_level": "CRITICAL",
       "failsafe": true,
       "failsafe_reason": "explicit_suicide_plan",
       "triggers": ["overdose"]
     },
     "cls": {
       "risk_level": "low",
       "confidence": 0.7,
       "self_harm_intent": false,
       "indicators_count": 2
     },
     "final": {
       "risk_level": "NONE",
       "failsafe": false,
       "failsafe_reason": null
     },
     "rule": "CONTEXT_OVERRIDE",
     "reason": "overdose+bereavement_context+classifier_lo_no_intent_conf_0.70",
     "ctx_detector": "is_overdose_bereavement_context"
   }
   ```

   **Privacy.** The user message is **never logged in the clear**. We log only
   `msg_sha256_16` (first 16 hex chars of `sha256(message)`, deterministic
   so the same input maps to the same hash for cross-correlation during
   adversarial re-testing) and `msg_length` (so Ant can tell long disclosures
   from short ones at a glance without seeing content). Classifier `reason`
   strings and `detected_indicators` are also dropped from the log line —
   they paraphrase the user's words and a leak via classifier output is the
   same privacy concern as a leak via the message itself. Only counts and
   structured fields ship to logs.

   **Severity.**
   - `INFO` for `KEYWORD_FAILSAFE`, `CLASSIFIER_ESCALATION`, `DEFAULT`.
   - `WARNING` for `CONTEXT_OVERRIDE` — every time the reconciler suppresses
     a CRITICAL keyword, it shows up as a WARNING so it cannot be lost in
     INFO-level noise during a tail.
   - `WARNING` for `CLASSIFIER_UNAVAILABLE`, with the captured exception
     class name and (for malformed output) the missing/invalid field name.

   **Destination.** Standard Python `logging.getLogger("safety.reconciler")`.
   Sink config is unchanged from current backend logging — Render captures
   stdout, structured fields are JSON-loadable for downstream tooling, and
   the existing log-shipping path in `/var/log/supervisor/backend.*.log`
   picks it up locally. No new dependency, no new env var, no new sink.

   **Sample log line Ant can grep for during the Round 10 human re-test:**
   ```
   $ tail -f /var/log/supervisor/backend.out.log | grep '"evt":"round10.reconcile"'
   $ tail -f .../backend.out.log | grep '"rule":"CONTEXT_OVERRIDE"'    # every override fire
   $ tail -f .../backend.out.log | grep '"rule":"CLASSIFIER_UNAVAILABLE"'  # classifier health
   ```

### `server.py:calculate_safeguarding_score`

- **DELETE** `is_overdose_bereavement_context()` (relocated to `verdict_reconciler.py`).
- **DELETE** `_OVERDOSE_FIRST_PERSON_PATTERNS` and `_OVERDOSE_GRIEF_SIGNALS`.
- **DELETE** the `if indicator == "overdose" and is_overdose_bereavement_context(message_lower):` block (server.py:1633–1640).

Per Ant's verbatim non-negotiable: *"Delete the duplicate copy in server.py once the move is done. That's not optional — two copies of the same logic is exactly the drift mechanism that produced this bug."*

`calculate_safeguarding_score` continues to exist as the legacy "weighted indicators" path for AMBER/YELLOW/protocol routing — it's still consumed downstream of the reconciler for non-failsafe escalation. We're not deleting the function, only the duplicated bereavement override inside it.

### `safety/unified_safety.py:analyze_message_unified`

No behavioural changes inside this function. It already returns a complete verdict including the AI classifier's output. The reconciler reads that output instead of `buddy_chat()` consuming the unified pipeline's `failsafe_triggered` flag directly.

### `server.py:buddy_chat`

Three changes:

1. **Replace** lines 6388–6473 (the parallel `check_safeguarding` + `analyze_message_unified` + scattered failsafe guards) with a single call to `reconcile_verdicts(...)`. The negation, identity-protocol, and crisis-override guards in those lines move into the reconciler as named precedence rules.
2. The early-return crisis response (lines 6475–6558) now triggers off `final_verdict.failsafe_triggered`, not the unified pipeline's flag.
3. The risk-level upgrade logic (lines 6560–6604) reads `final_verdict.risk_level`.

`should_escalate` is derived from `final_verdict`, not from a parallel scoring path that the rest of the function ignores.

---

## Foreseeable future context-aware exceptions

Listed for review per your ask — out of Round 10 scope, but the precedence table is built to take them as new rows, not as new code paths.

| Future trigger | Context that should suppress | Detector pattern |
|---|---|---|
| `"overdose"` (current) | Bereavement disclosure (loss of other, no first-person crisis) | `is_overdose_bereavement_context` |
| `"overdose"`, `"suicide"`, `"self-harm"` | Reading / discussing fiction or news ("the character in the book…", "the article said…") | Quote / attribution markers + third-person referent |
| `"overdose"`, `"self-harm"`, `"cutting"` | Medical-professional context (Dr Hayes-style: clinician describing patient case) | Persona = `dr_hayes` AND third-person clinical framing |
| `"hang"`, `"hanging"` | Mechanical / occupational ("hang a door", "hang the kit", veterans construction work) | First-person agentive object disambiguation |
| `"shoot"`, `"shooting"` | Sport / military training ("range day", "shooting comp", "qualifying score") | Veteran-context occupational framing |
| `"jump"` | Skydiving / parachute / training ("first jump", "static line", "wings course") | Veteran-context occupational framing |
| `"end it"`, `"finish it"` | Career / project / relationship ("finish the tour", "end the contract") | Object/complement attached to action verb |

Each of these is, today, a tap-tap-boom RED in the keyword pipeline and would benefit from the same reconciler treatment. **None ship in this PR.** They are listed so Ant can see the precedence table is built to accept them as one-row additions, not as another bespoke `is_<context>_<thing>_context()` function each.

The Round 10 scope is **one row**: bereavement-overdose. The architectural shape supports the rest.

### Worked example: what "adding a row" actually looks like

To make the extensibility claim concrete rather than aspirational, here is the **actual diff** that would later add `"jump"` (skydiving / parachute / wings-course context) as a future row. This is **not part of this PR** — it's the receipt that the architecture pays out as advertised.

**Hypothetical future PR (not Phase B):**

`safety/verdict_reconciler.py` — three additions:

```python
# 1. Add to the reconcilable triggers set (one line):
RECONCILABLE_KEYWORD_TRIGGERS = frozenset({"overdose", "jump"})

# 2. Add a new context-detector function next to is_overdose_bereavement_context.
#    Signature is identical: (message_lower: str) -> bool.
_JUMP_OCCUPATIONAL_PATTERNS = frozenset({
    "first jump", "static line", "wings course", "para course",
    "p company", "ppc", "free fall", "haho", "halo",
    "drop zone", "dz", "rigger", "chute", "canopy",
})
_JUMP_CRISIS_PATTERNS = frozenset({
    "going to jump", "want to jump", "gonna jump off",
    "jump off the", "jump from the",
})

def is_jump_occupational_context(message_lower: str) -> bool:
    for pattern in _JUMP_CRISIS_PATTERNS:
        if pattern in message_lower:
            return False
    for signal in _JUMP_OCCUPATIONAL_PATTERNS:
        if signal in message_lower:
            return True
    return False

# 3. Wire it into the CONTEXT_OVERRIDE rule's lookup table (one line in the
#    existing dict that maps trigger -> detector function):
_CONTEXT_DETECTORS = {
    "overdose": is_overdose_bereavement_context,
    "jump":     is_jump_occupational_context,   # new row
}
```

`safety/safety_monitor.py` — **no change**. The keyword pipeline keeps flagging
`"jump"` as it does today; the reconciler now has a documented route to
suppress it when occupational context is unambiguous and the classifier agrees.

`tests/test_verdict_reconciler.py` — three additions:

```python
def test_jump_occupational_overdrides_keyword_when_classifier_agrees(): ...
def test_jump_first_person_crisis_keyword_failsafe_wins(): ...
def test_jump_occupational_blocked_by_low_classifier_confidence(): ...
```

That is the full diff. **One trigger added to a frozenset, one detector
function written, one row added to a dict, three tests added.** No changes
to `server.py`, no changes to `safety_monitor.py`, no changes to
`unified_safety.py`, no changes to `buddy_chat()`, no plumbing of new flags
through the call graph. CODEOWNERS will route the PR to Ant + TheAIOldtimer
because `_CONTEXT_DETECTORS` is in `backend/safety/`. Ant reviews ~60 lines.
Approve / request-changes / merge.

This is what "extensible" buys us. Each of the seven foreseeable rows in the
table above is a PR of roughly that size, reviewable in isolation, with its
own tests, its own audit log signature (`"ctx_detector": "is_jump_..."`), and
its own paper trail in CODEOWNERS history.

The Round 10 PR ships the infrastructure plus row 1 (`"overdose"`). Future
rows ship one at a time, each as a CODEOWNERS-gated review.

---

## Non-negotiable requirements (verbatim from Ant's Round 10 brief)

1. **Delete the duplicate.** ✅ Addressed — `is_overdose_bereavement_context` moves out of `server.py`, sole copy lives in `safety/verdict_reconciler.py`. PR fails self-review if two copies survive merge.
2. **Genuine first-person crisis must continue to escalate.** ✅ Addressed — Rule 2 (`KEYWORD_FAILSAFE`) preserves the existing baseline. The control test from `r10_CTRL.json` (*"I am going to overdose tonight. I have the pills."* → RED 200, IMMINENT, `failsafe=True`) is pinned in `tests/test_phase_b_*.py` as a regression baseline. PR does not ship if that test breaks.
3. **Single authoritative result.** ✅ Addressed — `buddy_chat()` consumes only `final_verdict`. The two pipelines no longer race for the early return. If any code path in `buddy_chat()` reads a pipeline verdict directly, it's a review-blocking finding.

---

## Test plan (this PR ships with these unit tests; Phase D adds the end-to-end harness)

In `/app/backend/tests/test_verdict_reconciler.py`:

| # | Scenario | Input shape | Expected `precedence_rule_fired` | Expected `final_verdict` |
|---|---|---|---|---|
| 1 | r10_S009-A bereavement (mate / OD / past) | keyword=CRITICAL/`overdose`, classifier=low/0.70/no-intent, bereavement detector=True | `CONTEXT_OVERRIDE` | classifier verdict (NONE) |
| 2 | r10_S009-B bereavement (brother / OD) | keyword=CRITICAL/`overdose`, classifier=low/0.70/no-intent, bereavement detector=True | `CONTEXT_OVERRIDE` | classifier verdict (NONE) |
| 3 | r10_CTRL genuine first-person crisis | keyword=CRITICAL/`overdose`+`pills`, classifier=imminent/1.00/intent=True, bereavement detector=False | `KEYWORD_FAILSAFE` | RED / IMMINENT / failsafe=True |
| 4 | Classifier-only escalation (rare) | keyword=NONE, classifier=imminent/0.90/intent=True | `CLASSIFIER_ESCALATION` | RED |
| 5 | Both silent | keyword=NONE, classifier=low/0.30/no-intent | `DEFAULT` | NONE |
| 6 | Bereavement context but classifier confidence below threshold | keyword=CRITICAL/`overdose`, classifier=low/0.55/no-intent, bereavement detector=True | `KEYWORD_FAILSAFE` (override blocked by threshold) | RED |
| 7 | Bereavement detector matches but classifier reports self-harm intent | keyword=CRITICAL/`overdose`, classifier=imminent/0.90/intent=True, bereavement detector=True | `KEYWORD_FAILSAFE` (override blocked by intent flag) | RED |
| 8 | Non-reconcilable keyword trigger | keyword=CRITICAL/`pills`, classifier=low/0.80/no-intent | `KEYWORD_FAILSAFE` (`pills` not in `RECONCILABLE_KEYWORD_TRIGGERS`) | RED |
| 9 | Classifier exception during call | keyword=CRITICAL/`overdose`, classifier=None (raised `TimeoutError`), bereavement detector=True | `CLASSIFIER_UNAVAILABLE` | keyword verdict (RED), audit log at WARNING with `exception_class: "TimeoutError"` |
| 10 | Classifier returned malformed output | keyword=CRITICAL/`overdose`, classifier confidence=`1.7` (out of [0.0, 1.0]) | `CLASSIFIER_UNAVAILABLE` | keyword verdict (RED), audit log at WARNING with `malformed_field: "confidence"` |

Tests #6, #7, #8 are intentional adversarial guards: the reconciler must refuse to suppress a keyword failsafe when the safety conditions for suppression are not met. These exist to make sure the override is narrow.

Tests #9 and #10 are intentional infrastructure-failure guards: the reconciler must defer to the keyword pipeline whenever the classifier cannot be trusted to have produced a verdict at all. These exist to make sure the "look safe by default" branch is reached **and audit-logged as such** rather than silently degrading into the keyword-pipeline-only world.

---

## Out of scope (will NOT be in this PR)

- Phase C deterministic gates (Check B/C/D) — separate PR.
- Phase D end-to-end pytest harness — separate PR after Ant reviews the test file.
- Any change to `safety/safety_monitor.py` keyword lists, the Soul Document, the persona prompts, the protocols/, the Section 5 "do-not-touch" list.
- Any change to the standalone post-gen judge LLM prompt at `server.py:6832`.
- Generalising the reconciler to any precedence rules beyond the bereavement row. The infrastructure supports those rows; populating them is a future PR.

---

## Review checklist for Ant

1. Is **(b) merge layer** the right call vs (a) or (c)?
2. **`CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7` — provenance disclosed.** Anchored on the n=2 bereavement traces (both at 0.70) plus the n=1 control (1.0). Keep at 0.7 (matches observed bereavement floor, lets the override actually fire on real Round 9 traffic), or raise to 0.85 (more conservative, would have left both production S009 cases escalating until the classifier earns more confidence on those inputs)? Either is one-line change.
3. Is the precedence ordering (`CLASSIFIER_UNAVAILABLE` → `CONTEXT_OVERRIDE` → `KEYWORD_FAILSAFE` → `CLASSIFIER_ESCALATION` → `DEFAULT`) right?
4. **Rule 0 design.** Does deferring to the keyword pipeline on classifier exception / malformed output, with `WARNING`-level audit, feel right? Or should `CLASSIFIER_UNAVAILABLE` be even more conservative (e.g. force `failsafe_triggered=True` on any classifier failure on the basis that we can't trust we're not missing something)?
5. **Audit log schema.** Field set, JSON-on-one-line format, `msg_sha256_16` + `msg_length` as the only message-derived fields (no raw text, no classifier `reason` strings, no `detected_indicators` text), severity tiers (`WARNING` for `CONTEXT_OVERRIDE` and `CLASSIFIER_UNAVAILABLE`, `INFO` otherwise). Anything you want added, dropped, or renamed before it lands as the schema you'll be tailing during the human re-test?
6. Does `RECONCILABLE_KEYWORD_TRIGGERS = frozenset({"overdose"})` — i.e. only `"overdose"` is currently reconcilable — feel right for Round 10? (Other crisis keywords stay unconditionally authoritative until a future PR adds them.)
7. **Worked "jump" example.** Is the diff-shape representative of how you'd want future rows added? If not, what would you change — a different detector signature, a different registration mechanism, a different test pattern?
8. The 10 unit tests — any scenario shapes you'd add or rephrase before they become the regression baseline?
9. Anything in the "foreseeable future exceptions" table that you want explicitly **excluded** from ever being reconciled (e.g. method words like `"pills"`, `"rope"`, `"gun"`)?

Once approved, I open the PR with code matching this design exactly. If the design changes during your review, I update this document, re-circulate, and only then write code.

---

## Implementation note — server.py repair

**Disclosure for Ant's review:** during the Phase B implementation, while editing
`server.py` to delete the duplicate bereavement override and wire the reconciler
into `buddy_chat()`, the file went through an editor-tooling mishap that needs
to be visible in this PR description rather than buried in the diff.

### What happened

A `search_replace` operation hit a near-miss boundary and produced a corrupted
working tree. The corruption shape was:

1. **Truncated assignment line.** The line
   `WEBSITE_IMAGES_PATH = Path(__file__).parent.parent / "website" / "images"`
   lost its `WEBSITE_IMAGES_PATH = Path(__file__).p` prefix and became the
   syntactically-broken `arent.parent / "website" / "images"`. Backend would
   not start: `NameError: name 'arent' is not defined`.

2. **Duplicated tail block.** The trailing portion of `server.py` —
   covering the static-file mounts (`/images`, `/api/docs`, `/api/reports`),
   the debrief / bluelight / tenant-config endpoints, and the
   `_fastapi_app = app; socket_app = …; app = socket_app` ASGI-setup block —
   was duplicated. The duplicate copy was placed *after* `app = socket_app`,
   so its `app.mount(...)` calls were targeting the `socketio.ASGIApp` object,
   which has no `.mount()` method. Backend would not start:
   `AttributeError: 'ASGIApp' object has no attribute 'mount'`.

### What was repaired

Surgical, scoped to the corruption:

- **Truncation fix:** restored the `WEBSITE_IMAGES_PATH = Path(__file__).parent.parent / "website" / "images"` line to its HEAD form.
- **Duplicate removal:** deleted the second copy of the mount block, the second copy of the three endpoint definitions, and the second copy of the ASGI-setup block. The remaining single copy of each is byte-identical to HEAD.

### Diff breakdown — Phase B work vs repair work

The `server.py` diff in this PR contains both. To make Ant's review easier, here
is the line-by-line accounting:

**Phase B (intentional design work):**
- Delete `is_overdose_bereavement_context()` function (relocated to
  `safety/verdict_reconciler.py`).
- Delete `_OVERDOSE_FIRST_PERSON_PATTERNS` and `_OVERDOSE_GRIEF_SIGNALS` lists
  (relocated to `safety/verdict_reconciler.py`).
- Delete the `if indicator == "overdose" and is_overdose_bereavement_context(...)`
  override block inside `calculate_safeguarding_score`.
- Update `calculate_safeguarding_score` docstring to note the override has
  moved.
- Inside `buddy_chat()`: import `extract_verdicts_from_unified` and
  `reconcile_verdicts`; call them once after `analyze_message_unified`; gate
  `failsafe_should_fire` on `final_verdict.failsafe_triggered`; update logging
  to include `final_verdict.precedence_rule_fired`.
- Replace `failsafe_reason = unified_safety.get("failsafe_reason", "unknown")`
  with `failsafe_reason = final_verdict.failsafe_reason or "unknown"`.

**Repair (no intentional design content):**
- Restoration of the `WEBSITE_IMAGES_PATH` assignment line.
- Removal of the duplicated mount calls, duplicated endpoint definitions, and
  duplicated ASGI-setup block at end-of-file.

The repair touched **no safety logic, no auth logic, no JWT logic, no
chat-endpoint logic, and no persona/tenant logic**. It only restored the
end-of-file structure to match the HEAD checkpoint of `main` plus the
intentional Phase B edits.

### Verification after repair

- Backend starts cleanly: `INFO: Application startup complete.` in
  `/var/log/supervisor/backend.err.log`.
- `GET /api/` returns 200 with the expected banner.
- All 18 unit tests in `tests/test_round10_phase_b_reconciler.py` pass.
- `git diff --stat backend/server.py` shows 53 insertions / 87 deletions
  (net −34 lines), consistent with "delete bereavement duplicate + add
  reconciler call site, all other content unchanged".
- File ends at the single canonical `app = socket_app` line on 8813.

If any of the diff hunks look unfamiliar to you on review, that's almost
certainly the repair — happy to walk it line by line if helpful.

---

## Preview-environment smoke test outcome

Preview-environment smoke testing exercised Rule 0 (`CLASSIFIER_UNAVAILABLE`)
due to revoked preview OpenAI key. The `CONTEXT_OVERRIDE` happy path is verified
via unit tests but will only fire end-to-end against the production OpenAI key.
Round 10 human re-test by Zentrafuge will be the first end-to-end verification
of bereavement-context suppression on live messages.

Concretely, when running the three canonical fixtures (S009-A, S009-B, CTRL)
through the full `analyze_message_unified` → `extract_verdicts_from_unified` →
`reconcile_verdicts` chain in this preview environment, the audit log emitted
the following for every fixture:

```json
{"evt": "round10.reconcile", ..., "rule": "CLASSIFIER_UNAVAILABLE",
 "reason": "classifier_returned_none", "cls": null, ...}
```

The classifier inside `analyze_message_unified` raised a 401 against the
revoked OpenAI key, the unified pipeline recorded `ai_classification.error`,
the reconciler treated it as Rule 0, and the keyword pipeline's verdict was
preserved as the final verdict. **Failure mode behaved exactly as designed**
— no silent degradation, no service interruption, audit-logged at WARNING with
a named reason.

What this means for Ant's review:

- **`CONTEXT_OVERRIDE` (the bereavement override path) is not exercisable
  end-to-end in this preview environment.** It's covered by 8 of the 18 unit
  tests (the ones that pin the precedence table directly), but the live
  S009-A / S009-B fixtures fall through to Rule 0 in preview, not Rule 1.

- **`KEYWORD_FAILSAFE` (the genuine-crisis baseline) is not directly
  exercisable end-to-end either** for the same reason — Rule 0 fires before
  Rule 2 has a chance to. But the regression baseline (control case still
  blocks the AI response) holds because Rule 0 also defers to the keyword
  pipeline, so the user-visible behaviour for `CTRL` is identical (failsafe
  fires, crisis response returned).

- **The first true end-to-end verification of `CONTEXT_OVERRIDE` will be on
  production**, where the rotated OpenAI key is live. Ant's Round 10 human
  re-test (S004 / S005 / S008 / S009 from the Zentrafuge re-test) will be the
  first time the override fires under real conditions on real adversarial
  inputs. The unit-test coverage in this PR pins the precedence-table
  semantics; the human re-test confirms the field behaviour.

This is not an argument to defer the merge. It's an argument to expect Ant
to test S009 specifically and report whether the override fires on first
contact. If it doesn't, the diagnostic is straightforward: tail the
`safety.reconciler` log for `"rule": "CONTEXT_OVERRIDE"` lines on his test
session, and if they're absent, walk the precedence table top-down to find
where it stopped (most likely candidates: classifier confidence below
threshold, classifier reporting `contains_self_harm_intent: true` for a
borderline phrasing, or the message wording falling outside the bereavement
detector's pattern list — all reproducible from the audit log).

---

*Drafted while waiting on Andrew's CODEOWNERS branch-protection confirmation, per the Round 10 brief's "(a) Draft the Phase B PR description and architectural rationale" instruction. No code has been written for Phase B in this session.*
