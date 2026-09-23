# PROPOSAL — failsafe suppressors must not switch off an explicit current-turn statement

**Status:** for Ant's review. **Not merged. No safety behaviour has changed on `main`.**
**Prepared:** 23 September 2026, against `main` at `e5edc8c`
**Defect evidence:** `docs/zentrafuge-authoritative-consumption-falsification-2026-09-23.md`,
"Read this first" section (preserved unchanged, as requested).
**Prototype branch for review:** `safety/suppressor-explicit-current-turn-PROPOSAL`
(labelled NOT FOR MERGE, same convention as the Q6 proposal `75b00c6`).

---

## 1. The defect, in one line

The post-reconciler negation list (`server.py:6745-6800`) and identity guard (`:6806-6824`)
switch off a correct reconciler failsafe on explicit current-turn crisis statements, because
the negation list is an unscoped substring test (`"i'm not"`, `"won't"` anywhere in the
message) and the identity guard assumes `imminent_intent` is trajectory-only.

## 2. The proposed correction

**One rule:** neither suppressor may switch off the failsafe when the keyword monitor rated
the **current message** critical on either representation.

That fact already exists inside unified failsafe Check 1 — it is exactly the condition
`keyword_result.risk_level == "critical" or original_is_critical`
(`unified_safety.py:304`). The change exposes it rather than computing anything new.

Why this shape and not another:

- **Uses the existing scoped negation.** `safety_monitor.assess_message_safety` already applies
  word-boundary, scoped negation (PR #110). If it still rates the message critical, it has
  already judged the message not to be a denial. **No sixth negation implementation** (the
  `:6772` comment's explicit instruction).
- **Leaves the pinned coupling in place.** The negation list still gates the failsafe for every
  non-explicit failsafe (trajectory, semantic, classifier). `test_negation_still_gates_the_failsafe`
  still passes, but see §6 — its docstring asks for it to be revisited if the coupling changes.
- **Touches no phrase list, no reconciler rule, no normaliser, no scoring, no thresholds.**
- **Fails to existing behaviour.** If `current_turn_explicit` is ever absent from the unified
  result, the server reads it as `False` and behaves exactly as today.

### The change (4 files, +38 / −8)

**`backend/safety/unified_safety.py`** — name Check 1's condition and return it as evidence:

```python
current_turn_explicit = (
    keyword_result.get("risk_level") == "critical" or original_is_critical
)
if current_turn_explicit:
    failsafe_triggered = True
    ...
# in the returned dict:
"current_turn_explicit": current_turn_explicit,
```

Behaviour of Check 1 itself is identical (same condition, now named).

**`backend/server.py`** — guard both suppressors:

```python
current_turn_explicit = bool(unified_safety.get("current_turn_explicit", False))

if failsafe_should_fire and negation_confirmed and current_turn_explicit:
    logging.warning("NEGATION SUPPRESSION BLOCKED - current turn is explicit ...")
elif failsafe_should_fire and negation_confirmed:
    ...existing suppression, unchanged...

if failsafe_should_fire and identity_active and current_turn_explicit:
    logging.warning("IDENTITY SUPPRESSION BLOCKED - current turn is explicit ...")
elif failsafe_should_fire and identity_active:
    ...existing identity guard, unchanged...
```

**`backend/tests/differential/runtime_chain.py`** — mirror the guard in the hash-guarded
transcription and repin `negation_and_identity_guards` (`f1e24bc4619bd1b1` → `a8bd9937b02df27f`).
The other two region hashes are unchanged. `verify_fidelity()` returns OK on all three.

**`.github/workflows/safety-tests.yml`** — add the new test file to the CI list. CI currently
runs only three named files, so without this the regression tests would never run in CI.

## 3. Behaviour change

| Input | Today | With change |
|---|---|---|
| `i won't be here tomorrow` | AMBER, no overlay | **RED, overlay** |
| `i'm not coping, i'm going to kill myself tonight` | AMBER, no overlay | **RED, overlay** |
| `i'm not ok. i want to end it all tonight` | AMBER, no overlay | **RED, overlay** |
| `you're just a bot, you're not real. i'm going to kill myself tonight` | AMBER, no overlay | **RED, overlay** |
| `i would never kill myself but i want to die` | AMBER, no overlay | **RED, overlay** — ⚠ needs your ruling, §6 |
| `i wont kill myself` (R12-03 accepted case) | RED, overlay | RED, overlay — unchanged |
| All 10 genuine negations in §4 | no overlay | no overlay — unchanged |
| Trajectory/classifier failsafe + non-critical denial | suppressed | suppressed — unchanged |

I searched for genuine denials the keyword monitor still rates critical, since those are the
only messages whose behaviour this change can alter. Of 20 tried, two were critical:
`i wont kill myself` (already fires today; the list has no `"will not"`) and the mixed
`i would never kill myself but i want to die`. That second one is the only real behaviour
change beyond the four defects.

## 4. Test plan

New file: **`backend/tests/test_suppressor_explicit_current_turn.py`**, 21 tests. They run the
real unified pipeline and reconciler (classifier unavailable, Rule 0), then the hash-guarded
transcription of the server chain. Built so that preservation tests pass on **both** old and
new code, and defect tests fail on old code for the right reason (the outcome, not a missing
field).

| Group | Tests | On today's `main` | With change |
|---|---|---|---|
| Transcription still matches `server.py` | 1 | pass | pass |
| The four reproduced cases reach the overlay | 4 | **fail** | pass |
| Control: explicit plan still fires | 1 | pass | pass |
| Genuine negations stay non-triggering (incl. Tommy scenario 008 turn 4) | 10 | pass | pass |
| Negation still suppresses a non-explicit failsafe | 1 | pass | pass |
| Identity still suppresses a non-explicit trajectory failsafe | 1 | pass | pass |
| Missing field → existing behaviour | 1 | pass | pass |
| Mixed denial + wish to die now fires (pinned for your ruling) | 1 | **fail** | pass |
| R12-03 `i wont kill myself` unchanged | 1 | pass | pass |
| **Total** | **21** | **5 fail, 16 pass** | **21 pass** |

Genuine negations covered: scenario 008 turn 4; `I'm not going to kill myself, I just feel
low`; `I would never hurt myself but I feel like a burden`; `I'm not suicidal`;
`I don't want to die`; `not gonna top myself`; `I won't hurt myself`;
`I'm not going to hurt myself, not like that`; `don't worry i'm not going to do anything
stupid`; `I am not going to end my life`.

### Regression evidence from the prototype

- **Existing safety suites, before and after, identical:** 151 passed, 2 xfailed, 1 failed
  across `test_negation_mood_phrases`, `test_negation_word_boundary`,
  `test_differential_harness`, `test_decision_provenance`, `test_r12_03_original_text_failsafe`,
  `test_unified_safeguarding`, `test_fallback_validation`, both grief gate files,
  `test_round9_items3_4_5_signals_judge` and `test_typographic_safety`. The one failure
  (`TestPerformance::test_analysis_speed`) fails identically on `main`; it times out on the
  sandbox's blocked embedding calls.
- **Full differential corpus, before and after:** 76/76 turns, runtime outcome
  (`risk_level`, `safeguarding_triggered`, `exit_path`) changed on **0** turns. Expected, since
  no corpus turn has this shape.

## 5. Deliberately out of scope

Each is real, and each is left alone because you asked for the smallest correction:

1. **The negation list stays unscoped for non-explicit failsafes.** A trajectory failsafe
   followed by `"i'm not ok"` is still suppressed. Fixing that means scoping or removing the list,
   which is the "fold all five negation implementations" item.
2. **Staff visibility of suppressed turns** (`audit_only`, `:7768`). With this change the four
   cases take the failsafe exit and write an active RED alert, so they are fixed for staff too.
   Other suppressed turns are unaffected.
3. **The differential harness doesn't pass `original_message`** to unified, so it can't model
   R12-03. The new tests call unified directly with it. Fixing the harness is separate tooling.
4. **Live classifier and live normaliser** behaviour on these inputs remains unmeasured. The
   change is downstream of both, so neither can undo it; a live normaliser rewrite could in
   principle change whether the keyword monitor rates the text critical, but the original-text
   arm covers that.
5. **The identity guard's comment** about `imminent_intent` being trajectory-only stays as the
   code's stated intent; the guard now simply cannot act on an explicit current turn. Correcting
   the comment's premise more broadly would be a separate change.

## 6. Decisions needed from you

1. **Approve the rule** — suppressors may not act when the current message is keyword-critical.
2. **The mixed case:** `i would never kill myself but i want to die` currently gets no overlay
   (suppressed by `"would never"`) and would get one. I think firing is right — the keyword
   monitor matched `want to die` after its own negation handling — but it is a behaviour change
   you should rule on. It is pinned by its own test so the decision stays visible.
3. **`test_negation_still_gates_the_failsafe`:** it still passes, because it greps for the
   `if failsafe_should_fire and negation_confirmed:` line, which survives inside the `elif`. Its
   docstring asks that it be revisited if the coupling changes. The coupling is now conditional.
   Do you want its docstring or assertion updated in the same PR, or left alone?
4. **CI list:** OK to add the new test file to `safety-tests.yml`?

On your approval I'll open the PR from the proposal branch exactly as reviewed, with no further
changes except whatever you rule on above.
