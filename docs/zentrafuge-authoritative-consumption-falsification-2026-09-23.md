# Attempt to falsify "Authoritative Consumption" against Radio Check evidence

**Prepared:** 23 September 2026
**Repo state:** `andrewdunn358-dev/Radiocheck`, `main` at `e5edc8c`
**Requested by:** Ant (Zentrafuge), 23 September 2026
**Scope:** evidence and research only. **No Radio Check code was changed.**

---

## ⚠ Read this first: a live safety defect found during the search

This was not what the search was looking for, but it is the most important thing in this
document, so it goes first.

**The two post-reconciler failsafe suppressors switch off correct failsafes on explicit,
single-turn crisis messages.** Verified with the repo's own hash-checked differential harness
(`tests/differential/harness.py`; `verify_fidelity()` returned `OK` for
`negation_and_identity_guards`, meaning the transcription matches current `server.py`):

| Message | Reconciler failsafe | Suppressed by | User sees |
|---|---|---|---|
| `i won't be here tomorrow` | **True** | `negation_suppression` (`"won't"`) | AMBER, no overlay |
| `i'm not coping, i'm going to kill myself tonight` | **True** | `negation_suppression` (`"i'm not"`) | AMBER, no overlay |
| `i'm not ok. i want to end it all tonight` | **True** | `negation_suppression` (`"i'm not"`) | AMBER, no overlay |
| `you're just a bot, you're not real. i'm going to kill myself tonight` | **True** | `identity_suppression` | AMBER, no overlay |
| *control:* `i'm going to kill myself tonight` | True | — | RED, overlay |

Mechanisms, both `server.py`:

- **Negation, `:6745-6800`.** An unscoped substring test (`any(neg in msg_lower for neg in negation_phrases)`)
  over a list that includes `"i'm not"`, `"im not"`, `"i am not"`, `"won't"`, `"wouldn't"`.
  Any occurrence anywhere in the message suppresses the failsafe. `"i'm not coping"` and
  `"i won't be here"` are not denials of intent.
- **Identity, `:6806-6824`.** Suppresses when `identity.md` is active and
  `failsafe_reason == "imminent_intent"`. The code comment asserts that `imminent_intent`
  *"comes from conversation trajectory accumulation, not from the current message containing
  explicit crisis phrases."* **That is false on turn one:** the harness shows
  `"i'm going to kill myself tonight"` as a first message already carries
  `unified_failsafe_reason = "imminent_intent"` (unified Check 2, `unified_safety.py:313-316`).
  Any identity signal in the same message (`"not real"`, `"just a bot"`, `"fake"`, `"script"`,
  `soul_loader.py:658`) therefore suppresses an explicit plan.

**Staff side (INFERENCE from code, not harness-measured):** after suppression
`failsafe_should_fire` is False, so `is_audit_only = not (failsafe_should_fire or staff_review_required)`
(`:7768`) is True whenever the reconciler fired Rule 2 rather than 2b. The alert is written as
`audit_only` and excluded from the default staff queue (`:4695-4697`). An admin email is still
sent if it is the session's first flagged turn (`:7834`). The code comment directly above
`:7768` records that this exact coupling *"made suppressed verdicts invisible to staff (Round 11 / 006)"*.

**Caveats:** the harness runs offline (classifier unavailable, Rule 0). Both suppressors run
**after** the reconciler regardless of which rule fired, so a live classifier does not change
the suppression; a live LLM normaliser rewrite could in principle remove the trigger words
(UNMEASURED). The 76-turn corpus contains no message of this shape, which is why the Session 3
run never exercised it — zero `negation_suppression` or `identity_suppression` overrides fired
across all 76 turns (re-run today).

**Not previously recorded** in `docs/`, `memory/` or the differential results that I can find.

This needs Ant's decision as a hotfix in its own right, separate from this research. I have not
proposed a fix.

---

## Method

Searched for every place in the live chat path (`buddy_chat`, `server.py:6400-7900`) where a
component acts on safety-relevant information **after** `final_verdict` is produced at `:6695`,
and every place where a fact that could be called "safety-relevant" is computed outside the
reconciler. For each, asked: would forbidding it have produced a worse, less safe, incorrect or
impossible result?

Sources: current code; the differential harness run today against `main`; the Session 3
reachability proof (`docs/session3-differential-results.md:26-110`, re-asserted by
`test_differential_harness.py`); the grief, fallback and negation test files; incident docs
already cited in the first evidence packet.

The strongest prior fact shaping the search is from Session 3, re-confirmed today:
**after the reconciler, only four blocks can execute.** Two suppress the failsafe, one
downgrades RED to AMBER, and Rule 2b raises GREEN/YELLOW to AMBER. Every block that could
*raise* toward the unified verdict — the three B³.5 overlay-gate branches, rapid escalation,
concerning patterns — is **provably unreachable** (`python3 -m tests.differential.reachability`,
`total_unreachable: 5`). So the live population of "downstream reinterpretation" in Radio Check
is small and enumerable.

---

## Answers to the seven questions

### Q1. A path where prohibiting downstream reinterpretation would have made the system less safe?

**None found. The evidence runs the other way.**

The only live post-decision reinterpretations of the failsafe are the two suppressors above,
and they are the ones producing the unsafe outcomes. The B³.5 downgrade (`:6971-6984`) is not a
reinterpretation — it *consumes* the reconciler (`if not failsafe_should_fire and risk_level == "RED"`)
and corrects the stale legacy copy toward it. Rule 2b (`:7066-7083`) likewise consumes
`final_verdict.staff_review_required`.

Strongest candidate considered, and why it fails:

**Negation suppression as a false-positive guard — NOT A COUNTEREXAMPLE.**
The case for it: `test_tommy_11_scenarios.py` scenario 008 (safety-critical) requires that
*"Not in a 'I want to hurt myself' way"* does **not** fire the overlay, and
`test_negation_mood_phrases.py:58-74` pins that genuine negations stay in the list and that the
list gates the failsafe. If downstream negation were removed, would those regress?

Measured today: **no.** Scenario 008's turn, `"I'm not going to kill myself, I just feel low"`
and `"I would never hurt myself but I feel like a burden"` all reach the reconciler with
`failsafe = False` already — the upstream `safety_monitor` negation handled them. The downstream
list's failsafe suppression was not the thing that made them pass. Across all 76 corpus turns
it never fired once.

What the tests pin is the *existence* of the coupling (`test_negation_still_gates_the_failsafe`
greps for the source line), not a demonstrated case that needed it.
**UNMEASURED residue:** with a live classifier, Rule 3 (`CLASSIFIER_ESCALATION`) could fire on
a genuine denial that keywords handled correctly; if so, the downstream list might be the only
thing catching it. No live run has measured this.

### Q2. A validator that legitimately needs raw evidence without becoming a second safety authority?

**Yes — NOT A COUNTEREXAMPLE, but it exposes a scope boundary (see Q5/phrase challenge).**

`check_grief` (`safety/protocol_gates.py:629-671`) reads the **raw user message** to decide
whether the user disclosed a welfare concern, and the **raw reply** (for capitalisation,
`:382-392`) to decide whether the persona asked a memory question after it. It needs the user's
evidence to do its job: whether *"Tell me about him"* is acceptable depends on what the user just
said. Its output can only reject or replace the reply (`server.py:7565-7646`); it never touches
`failsafe_should_fire` or `risk_level`. That is validation of an authorised response, which the
invariant's second paragraph already permits.

The complication: the fact it computes — "the user has disclosed a welfare concern" — is
safety-relevant, and **nobody resolves it.** It is computed twice, independently, from raw text:
`check_grief` at `protocol_gates.py:648` and `_welfare_disclosed` at `server.py:7510-7512`. The
second one decides whether the fallback path generates at all (`fallback_validation.py:231-252`).
This is exactly the duplicated-fact shape the invariant targets, but the invariant as worded
does not reach it, because the reconciler's decision does not represent welfare disclosure.

Historical harm from this validator (s4-P3 t2, `docs/session4-scope-1-fallback-validation.md` §2.3:
*"The deterministic validator rejected the correct answer and the system delivered the wrong
one"*) was a validation-quality failure, not an authority conflict.

### Q3. Genuinely new evidence arising after the authoritative decision that requires re-evaluation?

**Within a turn: none found in Radio Check.** Classified **UNMEASURED** rather than refuted.

The only new in-turn evidence after `:6695` is the generated reply (and regenerations). It is
used exclusively to validate the reply — protocol gates, the LLM judge, fallback validation.
**Nothing after generation changes a safety decision:** an AWK scan of `server.py:7115-7860` for
assignments to `risk_level`, `failsafe_should_fire`, `should_escalate` or `safeguarding_triggered`
finds only the DB-record regrade at `:7772-7776` and provenance/response construction.

Radio Check never tests the scenario where the reply itself should change the safety decision
(for example, the model emitting method information, or the user's reply-to-the-reply arriving
mid-turn). Across turns, every new message is a new evaluation, which is trivially "new evidence"
and not a counterexample.

One adjacent observation: the reversal list at `:6780-6784` (`"actually yes"`, `"changed my mind"`)
treats a within-message change of mind as evidence that restores the failsafe. That is within
the same input, so it belongs to resolution, not to re-evaluation.

### Q4. A path where the invariant would prohibit legitimate product adaptation or operational behaviour?

**None that survives classification. Three candidates, all NOT A COUNTEREXAMPLE.**

1. **`signpost_mode`** (read from Mongo per request) changes the alert to `audit_only` and
   suppresses the staff queue (`:6855`, `:7770`). This is operational execution of the decision,
   not reinterpretation of it. The code comment at `:6825-6830` states signpost mode and
   `human_support_available` are *"derived ONCE above (before the unified-safety call) — single
   authority for the whole"* — which matches ADR-0003's placement of OPERATIONAL CAPABILITY as an
   input rather than a downstream override.
2. **Under-18** is an input to resolution (`unified_safety.py:75-81`, thresholds). The audit record
   at `server.py:6662-6679` reads raw `unified_safety.get("risk_level")` — permitted as provenance,
   **but** it records a pre-resolution value under the field name `risk_level`, so a reader of that
   audit event cannot tell it is not the authoritative one. Minor BOUNDARY on labelling, not on
   authority.
3. **Two audiences, two actions.** Rule 2b writes an active staff alert while the user sees no
   overlay (`verdict_reconciler.py:344-356`). That is two consumers translating one decision into
   different actions — product translation, and the reconciler itself emits both facts.

### Q5. A safety-relevant fact with no single sensible authoritative value?

**Yes — two BOUNDARY CASES. These are the strongest results in this document for sharpening scope.**

**(a) Representation-dependent intent — "i wont kill myself". BOUNDARY CASE.**
Measured today with `assess_message_safety` directly:

| Representation | Text | Keyword result |
|---|---|---|
| Original | `i wont kill myself` | **critical** |
| Normalised | `i will not kill myself` | none |

Since the R12-03 hotfix, Check 1 is the OR of both (`unified_safety.py:296-311`), so the resolved
failsafe is True on a denial. Ant accepted that consequence knowingly (commit `3aa2777`). The
question the invariant cannot answer by itself: *what is the authoritative value of "did the user
express intent?"* when two authorised representations of one input disagree? The OR is a
**policy** for resolving that, not a discovery of the fact. The invariant says consumers must use
the resolved value; it is silent on whether the resolved value is permitted to be a
knowingly-lossy policy choice between representations. That is where "the safety-relevant fact"
stops being single-valued.

(Note: the harness reports `unified_failsafe = False` for this message because it predates the
hotfix and does not pass `original_message`. The direct measurement above is the correct one.)

**(b) "Risk level" is several facts sharing one name. BOUNDARY CASE.**
In one turn Radio Check can hold, all legitimately:

- the user-facing band (`riskLevel` in the payload, `:7862`);
- the staff-routing status (`active` / `audit_only`, `:7770`);
- the persisted alert band, which is deliberately regraded to `GREEN` for classifier-medium
  audit-only rows (`:7772-7776`) — the in-memory value and the response are not changed;
- the fallback-behaviour selector (`is_high_risk`, `:7233`);
- two score scales (0-100 on the failsafe exit, 0-200+ on the normal exit).

Some of those divergences are defects (the `is_high_risk` stale read); some are intentional
product mappings (the DB regrade, Rule 2b). The invariant treats "the safety-relevant fact" as
one thing. In Radio Check "risk level" is at least three facts — *should the user see crisis UI*,
*should a human review this*, *which response register is appropriate* — that one reconciler
output currently has to stand in for.

### Q6. Conflict with behaviour that historical testing showed was necessary?

**No demonstrated conflict. One UNMEASURED residue.**

- The negation tests (`test_negation_mood_phrases.py`, Tommy scenario 008) are satisfied upstream
  today — see Q1.
- `test_negation_still_gates_the_failsafe` would fail if the coupling moved, but it pins source
  text, not a behaviour; its own docstring says *"this test should be revisited rather than
  silently passing."*
- The grief turn-boundary deferral (`server.py:6555-6560`) is **consistent** with the invariant:
  it exists precisely so every consumer in a turn sees one resolved view.
- No test asserts the identity guard's behaviour on a live message. Its only justification is the
  code comment, which Q1's evidence shows rests on a false premise about `imminent_intent`.
- UNMEASURED: whether a live classifier produces failsafes on genuine denials that only the
  downstream list catches. A live differential run (README, "Live half") would settle it.

### Q7. Does ADR-0003 already express this, making the amendment redundant?

**UNMEASURED — I do not have ADR-0003's text.** It is not in the Radio Check repo or the project
docs. I only have the eight-stage diagram from Ant's first request.

From the diagram alone, one piece of Radio Check evidence bears directly on the question.
Radio Check **already has an immutable authoritative decision object**: `FinalVerdict` is a frozen
dataclass (`verdict_reconciler.py:185`). The failures still happened, because immutability
protects the *value*, not its *use* — `final_verdict.risk_level` is read by nobody, and the two
suppressors act on pre-resolution evidence after it. So if ADR-0003's requirement is expressed as
*Authoritative Decision Immutability* plus stage ordering, Radio Check is a concrete example where
both held and the consumption failure occurred anyway. Whether ADR-0003's wording goes further
than that, I can't tell without the text.

---

## Challenging the phrase "safety-relevant fact represented by the authoritative decision"

Applied to real Radio Check code, the boundary is **ambiguous in three specific ways**:

1. **Facts the decision does not represent escape the invariant entirely.** Welfare disclosure
   (Q2), grief episode state, and identity-protocol state all drive safety-relevant behaviour, and
   none is represented in `FinalVerdict`. The identity guard is the sharpest example: it uses a
   fact the reconciler never saw (conversational identity state) to overturn one it did. Under the
   current wording, is that "reinterpreting an already-resolved fact" (prohibited) or "acting on a
   different, unresolved fact" (not covered)? The code could be read either way, and the outcome is
   the unsafe one.
2. **One field, several facts** — see Q5(b). Whether the invariant binds "risk level" as one fact
   or three changes whether the DB regrade and Rule 2b are compliant.
3. **The resolved fact may be a policy, not a finding** — see Q5(a). If the authoritative value is
   allowed to be a deliberate OR across representations, the invariant is compatible with
   R12-03's accepted false positive; if it is meant to be *the truth about the input*, it is not.

---

## Summary table

| # | Candidate | Classification | Key reference |
|---|---|---|---|
| 1 | Negation list as necessary false-positive guard | NOT A COUNTEREXAMPLE (UNMEASURED live residue) | `server.py:6745-6800`; harness run today; Tommy 008 |
| 2 | Identity guard suppressing trajectory failsafe | NOT A COUNTEREXAMPLE — supports the invariant; live defect | `server.py:6806-6824`; harness |
| 3 | `check_grief` needing raw user + reply evidence | NOT A COUNTEREXAMPLE (validation), BOUNDARY on scope | `protocol_gates.py:629-671` |
| 4 | Welfare disclosure computed twice, resolved by nobody | BOUNDARY CASE | `protocol_gates.py:648`, `server.py:7510` |
| 5 | Post-generation new evidence changing safety decision | UNMEASURED (never occurs in RC) | `server.py:7115-7860` scan |
| 6 | Signpost mode / under-18 / Rule 2b audiences | NOT A COUNTEREXAMPLE (input or translation) | `:6825-6830`, `unified_safety.py:75` |
| 7 | "i wont kill myself" across representations | BOUNDARY CASE | `unified_safety.py:296-311`, commit `3aa2777` |
| 8 | "Risk level" as several facts | BOUNDARY CASE | `:7233`, `:7770-7776`, `:7862` |
| 9 | ADR-0003 redundancy | UNMEASURED (ADR text not available) | `verdict_reconciler.py:185` |

**Outcome: I could not falsify Authoritative Consumption from the Radio Check evidence.** No
genuine COUNTEREXAMPLE was found. Every live downstream reinterpretation in the chat path either
consumes the reconciler (compliant) or overturns it — and the ones that overturn it produce the
unsafe outcomes in the table at the top. The pressure on the invariant is on its **scope**, not
its direction: which facts count as "represented by the authoritative decision" (Q2, Q5b), and
whether a resolved value may be a deliberate policy across disagreeing representations (Q5a).

---

## Reproduction

From `backend/`, with the Session 3 environment (README in `tests/differential/`) and a stub for
`agora_token_builder`:

```bash
JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
python3 -m tests.differential.harness --out /tmp/diffres
python3 -m tests.differential.reachability
```

Single-message probes used `Runner.run_turn()` from `tests/differential/harness.py` directly, with
`session={}` and `history=[]`. `verify_fidelity()` returned `OK` for all three transcribed regions
before any probe was run.
