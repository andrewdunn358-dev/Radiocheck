# Radio Check state archaeology — evidence packet for the Zentrafuge Safety Kernel

**Prepared:** 23 September 2026
**Repo state:** `andrewdunn358-dev/Radiocheck`, `main` at `0a497e7`
**Requested by:** Ant (Zentrafuge), 23 September 2026
**Scope:** evidence gathering only. **No Radio Check code was read for modification, and nothing was changed.**

## What this is, and what it deliberately is not

Three end-to-end traces of paths where an observation or detector result affects resolved
state, and that state subsequently affects a safety decision or user-facing behaviour.

Per the brief, this packet does **not**: design a state resolver, propose a detector
framework, propose risk scoring, rule on precedence, or tidy anything up. Where Radio Check
is contradictory, the contradiction is preserved.

Every claim is labelled:

- **CURRENT** — what the code does today, with file:line.
- **TESTED** — what an automated test actually asserts.
- **HISTORICAL** — what has demonstrably gone wrong, from incident docs or commit messages.
- **INFERENCE** — reasonable but not directly demonstrated.

Line numbers are from `main` at `0a497e7`. Excerpts are kept to the minimum needed to
identify the mechanism.

### Selection note

The three cases were chosen for contrast, not to fill the A/B/C categories. Case A is the
closest thing in Radio Check to a working state path, and it is offered with the caveat in
A.8: it works **now**, after two live failures, and one of its two known failure shapes is
still open as a strict-xfail test. If that disqualifies it as a "normal path" example in
your terms, the evidence in A.6 and A.9 is still the most complete picture of a state
lifecycle in the product.

---

## Case A — Grief protocol lifecycle: state participates and currently behaves as designed

The one path where safety-adjacent state is explicitly modelled as an episode with a
beginning, a persistence window and an end.

### A.1 Path

```
user input (RAW, never normalised on this path)
  → _grief_gate_fires()                       two-tier regex, deterministic
  → protocol_files contains 'grief.md'
  → session counters written (buddy_sessions)  grief_active_turns / turn_count / name / pronoun
  → grief_lifecycle snapshot read              one resolved view per turn
  → primary_protocol = 'grief' (highest priority)
  → persona reply generated (LLM)
  → check_grief() post-generation gate         deterministic
  → regenerate → micro-fallback → terminal response
  → user-facing reply
```

### A.2 Input representation — **CURRENT**

`server.py:6464` calls `get_protocol_files(request.message)` — the **original** user text.
Every safeguarding scorer below it is called on `safeguarding_text`, which is the
**normalised** text (`server.py:6449-6457`). The grief path therefore never sees the
normaliser's output.

This is recorded in-repo as known and unfixed, `backend/tests/differential/runtime_chain.py:206-210`:

> "`get_protocol_files` upstream is called on `request.message` (the ORIGINAL text), while
> the scorers below it are called on `safeguarding_text` (the NORMALISED text). The grief
> gate therefore never sees normalisation. Recorded, not fixed."

The post-generation gate `run_protocol_gates` (`safety/protocol_gates.py:678`) is also
passed raw `request.message` (`server.py:7443-7447`) and applies its own local
`_normalise()` (`protocol_gates.py:475`) — lowercase, punctuation strip. `check_grief`
receives **both** representations, because the capitalised-name branch of
`_person_reference_follows` (`protocol_gates.py:382-392`) needs the raw casing that
normalisation destroys.

**Relevance to the kernel:** this path already demonstrates, without an envelope
abstraction, that one stage needs two representations of the same input simultaneously
and for different reasons — the phrase matcher needs the normalised form, the referent
detector needs the original.

### A.3 Signal produced — **CURRENT**

`GateVerdict`, frozen dataclass, `protocol_gates.py:456-468`: `passed`, `gate`, `reason`,
`matched_phrase`. `check_grief` (`:629-671`) fails only on a conjunction: user welfare
signal present **AND** memory-elicitation match **AND** no redemption phrase.

`check_grief` itself is **stateless**. It reads no session key; it recomputes the welfare
signal from this turn's raw message.

### A.4 Where state is written — **CURRENT**

One in-memory dict, `buddy_sessions` (`server.py:1776`). No grief field reaches the
database.

| server.py | Write |
|---|---|
| 6483-6487 | deferred clear: `grief_name=None`, `grief_pronoun=None`, `grief_turn_count=0` |
| 6497-6507 | crisis override: immediate clear, `grief_active_turns=0` |
| 6514 | on detection: `grief_active_turns = 2` |
| 6516 | `grief_turn_count += 1` |
| 6529 | `grief_name = extract_grief_name(...)`, guarded by set-once `is None` at 6518 |
| 6533-6537 | `grief_pronoun` |
| 6542 | **mutates `protocol_files`** — force-injects `grief.md` while the counter is warm |
| 6543-6544 | decay: `grief_active_turns -= 1`, `grief_turn_count += 1` |
| 6561 | `grief_pending_clear = True` |

### A.5 Where state is read — **CURRENT**

`server.py:6584-6590` builds `grief_lifecycle`, the single resolved view for the turn:

```python
grief_lifecycle = {
    "active": 'grief.md' in protocol_files,
    "turn": session.get('grief_turn_count', 1) or 1,
    "name": session.get('grief_name'),
    "pronoun": session.get('grief_pronoun', 'they'),
    "closing": bool(session.get('grief_pending_clear', False)),
}
```

Consumed at `:6602-6604` (provenance), `:7268` (`protocol_turn_counts`), `:7279-7282`
(`protocol_state` → micro-fallback prompt), `:7232` (`is_grief_active`, suppresses the
brush-off override), `:7217-7222` (protocol priority — grief is highest).

### A.6 Expiry, and the desync that shaped it — **HISTORICAL**

Episode = detection turn + 2 (`grief_active_turns = 2`). During decay `grief.md` is
force-injected regardless of message content.

The end-of-episode clear is **deliberately deferred to the start of the next turn**. The
in-code comment at `server.py:6555-6560` records why:

> "Session 4 Scope 1 (Ant): do NOT clear here. grief.md has already been injected for THIS
> turn, so clearing now leaves protocol_state reading turn 0 / grief_opening on what is
> actually the closing turn (observed live: C7 t3, s4 runs). Defer to the start of the next turn."

Corroborated by `docs/session3-live-addendum.md:165-170`: `grief_active_turns: 0` with
`grief.md` still injected and the fallback running `situation=grief_opening, turn=0` on a
closing turn.

**This is a mid-turn state mutation producing two different views of the same episode
inside one request.** The fix was not to reconcile the views but to forbid the write until
the turn boundary.

Other clears: crisis override (`:6489`), session TTL 60 min (`:1778`), `/api/ai-buddies/reset`
(`:7898`).

### A.7 Conversational or safety state? — **CURRENT: mixed, in one dict, no separation**

`buddy_sessions[sid]` holds `history`, `character`, `message_count`, `grief_name`,
`grief_pronoun`, `grief_turn_count`, `last_fallback_question`, `spine_turn_count`,
`brush_off_turn_count` alongside `grief_active_turns`, `grief_pending_clear` and
`identity_active_turns`.

`grief_active_turns` is the clearest mixed case: a conversational continuity counter that
determines which protocol file is active, which gate runs, and therefore which
deterministic validator can reject the reply.

`grief_name` is conversational in origin but has a proven safety-adjacent consequence — see
the Round 12 "Yeah" bug regression, `backend/tests/test_grief_gate_two_tier.py:276`.

### A.8 Authority — **CURRENT**

When the gate fails (`server.py:7565-7646`):

1. FAIL → conditioned regeneration (gpt-4o, temp 0.2).
2. Re-run gate. Still FAIL → `_apply_gate_micro_fallback()`, `gate_finalised = True`.
3. Regeneration exception → straight to micro-fallback, `gate_finalised = True`.
4. `if not gate_finalised:` (`:7646`) — **the LLM judge block is skipped entirely.**

So the deterministic gate, once it finalises, removes the stochastic judge from the path.
Nothing mutates `reply` after this block.

**Bypasses — CURRENT:**

- The whole gate is conditional: `server.py:7212`, `if protocol_files and buddy_openai_client:`.
  No client, or no protocol file, and no gate runs.
- The crisis failsafe returns at `:6930-6940`, before generation — the gate never sees that turn.
- `fallback_validation.py:231-252`: a welfare-disclosure state returns a terminal response
  with **no generation, no gate call, no judge call**.
- `_welfare_disclosed` (`server.py:7510-7512`) and `check_grief` (`protocol_gates.py:648`)
  compute the same predicate independently from the same frozenset. **INFERENCE:** they agree
  today only because both read raw input; a change to either input representation desyncs
  them silently.

### A.9 Tests — **TESTED**

- `test_grief_gate_person_reference.py` — the Check-E referent rule. Each case is annotated
  with the live transcript it came from (`s4-P3 t2`, `C7 t2`).
- `test_grief_gate_person_reference.py:116` — **`xfail(strict=True)`**. `"Tell me about the
  good old days with your dad."` is not caught; `dad` sits beyond `PERSON_REF_WINDOW = 3`.
  Reason string: *"widening the window is his call, not a silent change."*
- `test_fallback_validation.py:256` — **`xfail(strict=True)`**: *"the protocol has no grief
  off-ramp concept, so pressing a bereaved user who is disengaging is the specified
  behaviour. C7 turn 2."*
- `test_fallback_validation.py:215` asserts `TERMINAL_WORDING_APPROVED is False` — the
  terminal wording is not signed off.
- `test_grief_state_cleardown.py` is mostly **source-text assertion** (regex over
  `server.py`), which the file states at `:21-24`. `:107` fails the build if any new
  set-once-never-cleared session key appears. Only `:126` is behavioural.
- `test_grief_gate_two_tier.py:257` records that `"Dave was lost in Afghan"` fires on
  *"Afghan"*, not *"Dave"* — *"recorded here so nobody later cites it as evidence that place
  names are understood."*
- `test_grief_gate_two_tier.py:297` — `test_name_extractor_and_gate_cannot_disagree`, an
  explicit lockstep guard against split authority between two components reading the same input.

### A.10 Determinism — **CURRENT**

Entry gate, name extraction, session counters, `check_grief` and the terminal table are
deterministic. Persona generation, conditioned regeneration, micro-fallback generation and
the judge are LLM-dependent. The judge is **empirically non-deterministic at temp 0** —
`backend/tests/differential/results/judge_probe_2026-09-15.md:62`: *"The judge is not
deterministic on identical input"*; the same string passed three times then failed
`therapeutic_tone`.

The session counters are deterministic **but order- and history-dependent**: not
reproducible from the current message alone.

### A.11 Product-specific assumptions embedded

- Bereavement is an episode of a fixed length (2 turns), not a condition.
- One grief subject per episode, set once (`:6518`).
- A grief episode outranks every other protocol (`:7217`).
- Grief is treated as a *conversational* register with a *safety* gate attached; the
  relationship is not modelled anywhere.

---

## Case B — `risk_level` split: two copies of resolved risk, one corrected, one stale

### B.1 The mechanism — **CURRENT**

```python
server.py:6595  should_escalate, risk_data = check_safeguarding(safeguarding_text, ...)
server.py:6597  risk_level = risk_data["risk_level"]        # copy taken here (str, immutable)
```

From 6597 onward, `risk_data` is never written again in `buddy_chat` — verified by scanning
every `risk_data` occurrence between 6400 and 7600; all remaining hits are reads.

Every corrective rebinds the **local** only:

- `:6971-6984` — B³.5 initial-assignment corrective: `if not failsafe_should_fire and risk_level == "RED": risk_level = "AMBER"`.
- `:7024-7052` — three B³.5 overlay-gate branches.
- `:7066-7083` — Rule 2b staff review: GREEN/YELLOW → AMBER.

The response payload reads the corrected local (`:7860-7863`).

Then, ~260 lines later:

```python
server.py:7233   is_high_risk = risk_data.get('risk_level') == 'RED'
```

This reads the **dict**, i.e. the pre-reconciler legacy value.

### B.2 Where they disagree — **CURRENT**

Condition: `risk_data['risk_level'] == "RED"` **and** `failsafe_should_fire == False`.

On such a turn:

- `riskLevel` returned to the user is `AMBER`, `safeguardingTriggered` is `False` — the
  reconciler is obeyed.
- `is_high_risk` is `True` — the pre-reconciler legacy value is obeyed.

Consequences, pulling opposite ways:

- `is_high_risk` is the **highest-precedence terminal state** in
  `fallback_validation.py` (`TERMINAL_STATE_ORDER[0]`, `:133`) and short-circuits ahead of
  everything, including welfare disclosure (`:222-229`): *"at high risk we do not generate
  at all."* The user can therefore receive a crisis-register deterministic fallback on a
  turn whose visible risk band is AMBER with no crisis overlay.
- Brush-off routing (`:7235`) is suppressed on the same reconciler-downgraded turn.
- It inverts too: Rule 2b and the overlay-gate hotfix raise the local from GREEN/YELLOW
  while `risk_data` stays low, so `is_high_risk` is `False` on a turn that escalated —
  and the high-risk override that should have applied does not.

**The stale value is over-cautious in one direction and under-cautious in the other.**

### B.3 Why the audit did not catch it — **HISTORICAL**

`memory/PHASE_B3_5_RISK_LEVEL_AUDIT.md:37` scopes itself to *writes* to the local
`risk_level` in lines 6320-7028 and lists this exact read as out of scope:

> "Only **writes** to the local `risk_level` are listed; reads (e.g. … `is_high_risk = risk_data.get('risk_level') == 'RED'` …) are excluded per §3.1."

`:201` gives the justification: *"Strings are immutable in Python, so no by-reference
mutation is possible."* That is correct about the local, and is precisely why the dict was
never updated — but the audit did not then ask which consumers read the dict.

The same audit (`:166-193`) classified two of its six write sites as "Latent split-authority
bug — not gated by `failsafe_should_fire`".

### B.4 The live failure of the same shape — **HISTORICAL**

`docs/session3-live-addendum.md` §1, production request against `/api/ai-buddies/chat`,
scenario C2:

```
authoritative_runtime   risk_level GREEN, risk_level_source "legacy_scorer"
reconciled_result       risk_level HIGH, risk_level_assigned_from_this: FALSE
outcome                 safeguarding_triggered FALSE, risk_level AMBER, alert_created true (active)
```

> "This is not a detection failure. It is a routing failure, and it is the finding.
> **The staff pathway works. The user pathway does not.**" (`:45`)

`memory/PHASE_B3_INVESTIGATION_ANSWERS.md:49` records the mirror image from the Round 10
S009 era — *"the user sees the crisis overlay … the staff queue stays clean"*.

### B.5 Tests — **TESTED**

- `test_round10_phase_b_reconciler.py` covers B³.5 extensively, but **every assertion is on
  the response payload** (`riskLevel` / `safeguardingTriggered`), which reads the corrected
  local. The split is invisible to it.
- `test_fallback_validation.py:228,240` test `is_high_risk=True` as a **literal argument**.
  Neither test exercises how the flag is derived.
- `backend/tests/differential/runtime_chain.py:356-380` transcribes the B³.5 chain for the
  differential harness and models only the local `risk_level` — not `risk_data`, not
  `is_high_risk`. `:366` records that three upgrade branches are unreachable on the EXIT-A
  path: "Recorded, not fixed."

**So the split is untested in both the product suite and the differential harness.**

### B.6 Determinism

`check_safeguarding` is deterministic per message **but stateful**: `session_risk_history`
(`server.py:1425`, written `:1665`) adds a repeat bonus, so identical text scores
differently on turn 2. The correctives are deterministic. The reconciler is a pure function.

### B.7 Product-specific assumptions

- Two scoring scales coexist: legacy 0-200+ (`risk_data["score"]`) and unified 0-100. The
  user receives a different scale depending on which exit fires — logged as
  `riskscore_scale_switches_by_exit` in `docs/session3-differential-results.md`.
- "Risk level" is a display band, an alert-routing key and a behaviour selector at once,
  with no distinction between those roles.

---

## Case C — Reconciler: multiple authorities, one narrow output, three silent desyncs

### C.1 What the reconciler actually reconciles — **CURRENT**

`reconcile_verdicts()`, `safety/verdict_reconciler.py:232`. **Two** inputs:
`KeywordVerdict` (`:166`) and `Optional[ClassifierVerdict]` (`:175`).

The **legacy scorer** (`check_safeguarding`, the thing that produced `risk_data`) is a third
authority that **never reaches the reconciler at all**.

Rules, in precedence order:

| # | Name | Line | Effect |
|---|---|---|---|
| 0 | `CLASSIFIER_UNAVAILABLE` | 260 | keyword verdict passes through verbatim |
| 1 | `CONTEXT_OVERRIDE` | 281 | classifier wins, `failsafe_triggered=False` |
| 2 | `KEYWORD_FAILSAFE` | 319 | IMMINENT, failsafe True |
| 2b | `CLASSIFIER_HIGH_REVIEW` | 356 | HIGH, failsafe False, **`staff_review_required=True`** |
| 3 | `CLASSIFIER_ESCALATION` | 377 | failsafe `classifier_imminent` |
| 4 | `DEFAULT` | 404 | max of the two, no failsafe |

### C.2 Which output is authoritative — **CURRENT**

Only `failsafe_triggered` and `staff_review_required` are consumed.
**`final_verdict.risk_level` is read nowhere in `server.py`** — every reference is
`.failsafe_triggered`, `.failsafe_reason`, `.precedence_rule_fired` (logging only) or
`.staff_review_required`. The code records this itself at `server.py:6713`:
`risk_level_assigned_from_this=False`.

`docs/session3-differential-results.md:51-63` states the consequence:

> "The legacy scorer, the unified score, and `final_verdict.risk_level` have no path to the
> crisis overlay at all. One boolean — `failsafe_triggered`, minus two suppressors — is the
> entire user-facing safeguarding decision."

Empirically, 2 of 76 corpus turns reached RED.

### C.3 What overrides the reconciler afterwards — **CURRENT**

In execution order after `failsafe_should_fire = final_verdict.failsafe_triggered` (`:6734`):

1. `:6788-6800` — inline negation list. The comment at `:6772` records this as the **fifth
   independent negation implementation in the codebase**.
2. `:6811-6824` — identity-protocol guard. Note it reads `unified_safety.get("failsafe_reason")`
   (raw), **not** `final_verdict.failsafe_reason`.
3. `:6971-6984`, `:7024-7052` — B³.5. The provenance source strings say it plainly:
   `"server.corrective_block(reads RAW unified, not reconciler)"`.
4. `:7088-7112` — rapid escalation and concerning patterns, also raw unified.
5. `signpost_mode` — read from Mongo per request; forces `status="audit_only"` regardless
   of verdict.

### C.4 Three desyncs at the reconciler's inputs — **CURRENT**

**(a) Trajectory arrives disguised as a keyword verdict.** Cross-turn escalation from
`conversation_monitor` enters via unified Checks 2/4/5 and is folded into
`KeywordVerdict.failsafe_triggered` by `extract_verdicts_from_unified` (`:583`). The
reconciler cannot distinguish a per-turn keyword hit from an accumulated trajectory hit.
Worse, a trajectory-only failsafe arrives with `triggers=[]`, so Rule 1's
`len(keyword.triggers) > 0` guard (`:283`) fails and `CONTEXT_OVERRIDE` **cannot fire** —
Rule 2 wins by default.

**(b) The classifier is evaluated single-turn and context-free.** `unified_safety.py:199`:

```python
history_list = getattr(conv_state, 'history', []) if conv_state else []
```

`ConversationSafetyState` has no `history` attribute — the field is `message_history`
(`conversation_monitor.py:160`). `getattr` returns `[]` on every call, silently. So the
authority that can fire Rules 1, 2b and 3 always sees an empty conversation, while the
keyword side is trajectory-aware. (Even were the name corrected, the comprehension at `:201`
calls `.get()` on dataclass instances and would raise.)

**INFERENCE:** this is the largest input desync found, and it is invisible in every log,
because a defaulted `getattr` produces no error.

**(c) Original vs normalised, one layer down.** `safeguarding_text` is normalised, so
conversation-monitor history is built from normalised text, while the R12-03 hotfix re-runs
Check 1 on the **original** (`unified_safety.py:296-311`). A failsafe can fire from the
original on a turn whose trajectory record holds different text.

### C.5 R12-03: the representation failure that produced an authority conflict — **HISTORICAL**

From the commit body of `3aa2777` (PR #111, merged 21 Sept):

> "the normaliser rewrote '...to top myself do I.' as '...to take my own life...'. 'top
> myself' is in `EnhancedSafetyMonitor.critical_keywords`; 'take my own life' is not.
> Unified failsafe Check 1 read only the rewrite, so it never fired; legacy scored RED 100,
> the reconciler found no failsafe, and the user received AMBER with no crisis overlay."

Classified in-repo as `SEMANTIC EQUIVALENCE FAILURE -> AUTHORITY CONFLICT`, kernel invariant
*Safety Semantic Invariance*.

The fix (`unified_safety.py:296-311`) is a **logical OR of two independent
`assess_message_safety()` calls**, one per representation. Scoring is untouched: only the
boolean `failsafe_triggered` sees the original; `keyword_score` still derives from the
normalised text alone.

**The underlying vocabulary asymmetry was not closed.** `"take my own life"` is in
`RED_INDICATORS` (`server.py:1008`, legacy) and absent from
`safety_monitor.critical_keywords`. **INFERENCE:** `test_r12_03_rewrite_alone_does_not_fire_documents_the_defect`
actively pins that asymmetry — adding the phrase to `critical_keywords` would break the test.

**The documented "i wont kill myself" consequence exists in exactly one place in the
repository: the commit message of `3aa2777`.** There is no test and no code comment.
Searches for `wont kill myself`, `won't kill myself` and `negation-suppressed` across all
`.py` and `.md` files return only that commit body. The mechanism is reconstructible:
`text_normalizer.py:280` expands `"i wont" → "i will not"`; the original `"i wont"` is not
in `NEGATION_PREFIXES`, so the original-text arm sees an unsuppressed `kill myself` and
fires the failsafe on a **denial** of intent.

### C.6 Cross-turn state behind all this — **CURRENT**

`conversation_monitor.conversation_states` (`:212`) is **process memory only**. No Mongo, no
Redis, no file. State dies on every Render redeploy. Keyed by `session_id`; `user_id` is
stored but never keyed on, and `server.py:6638` passes `user_id=request.sessionId`, so for
anonymous chat the two are the same value.

- `reset_buddy_session` (`server.py:7895-7900`) deletes `buddy_sessions[sid]` only. It does
  **not** call `clear_conversation_state`, and does not clear the legacy scorer's
  `session_risk_history`. After a user "reset", trajectory, peak risk, accumulated
  `detected_patterns` and the legacy repeat bonus all survive.
- `rapid_escalation_detected` (`:328`) is assigned only inside the escalating branch — once
  True it is **never** reset by a later calm turn, and it feeds `trigger_staff_alert` and
  unified Check 4.
- `detected_patterns` is `.extend()`ed without dedup (`:314`) and
  `_calculate_conversation_risk` (`:743-744`) sums the bonus over the whole accumulated list
  each turn, so conversation score ratchets upward independently of the current message.
- `peak_risk_level` and `highest_category_reached` are monotonic by design (`:339-340`, `:541`).
- `risk_scores` (`:164`) is unbounded and never trimmed, unlike `message_history`.

### C.7 Provenance — **CURRENT**

`safety/provenance.py` records the three verdict columns independently and deliberately does
not collapse them (`:19-26`). `reconciled_result` carries `precedence_rule_fired` and
`risk_level_assigned_from_this=False`. Every corrective is recorded as a named override with
`before`/`after`/`changed`/`reason`.

So the *decision* is reconstructible. The *record* is not: `set_sink()` is called nowhere in
production code (only in tests), so records go to logs only, and `finish()` passes
`alert_created=bool(alert_id)` rather than the ID — the provenance record cannot be joined
to a `safeguarding_alerts` row. The module docstring records this as deliberate ("Ant's
ruling 3: no persistence in this pass", `:158-163`).

Correlation to the reconciler's own audit line works through a shared message hash, pinned
by `test_decision_provenance.py:180` after a 14 Sept production mismatch.

### C.8 Where the staff record and the user view diverge — **CURRENT**

Eight places, all in `server.py` unless noted:

1. Rule 2b by design: active alert + staff email, `safeguardingTriggered=False`, no overlay.
2. `is_audit_only` (`:7768-7770`): alert row written, excluded from the default staff queue
   (`:4695-4697`).
3. Classifier-`medium` regrading (`:7773-7776`): DB row says `GREEN`, response payload says
   otherwise.
4. `signpost_mode`: full crisis overlay to the user, `audit_only` in the queue.
5. Risk-score scale differs by exit (0-100 vs 0-200+).
6. Exception path (`:7866-7893`): user gets `GREEN / 0 / not triggered`; any alert already
   written survives.
7. Failsafe-path `ai_response` is the literal `"[FAILSAFE TRIGGERED - Crisis response sent]"`,
   so the staff record never contains the crisis text the user read.
8. `prov.finish` outcome mirrors the user view, not the DB view.

### C.9 Determinism

`reconcile_verdicts` is **fully deterministic** — a pure function of two typed inputs plus
`message_lower`. Its inputs are not: the classifier is `gpt-4o-mini` (5-minute response
cache makes repeats deterministic within the window), the semantic layer is
network-dependent embeddings with a zero-similarity fallback, and `conversation_monitor` is
deterministic arithmetic over path-dependent accumulated state.

**HISTORICAL:** `docs/session3-differential-results.md:148-153` records
`reconciler_deferred_to_keywords_only` on **76/76** offline turns — Rule 0 fired every time,
i.e. that entire differential run measured no reconciliation at all.

---

## Cross-case analysis

### What is common to all three

1. **Two or more components hold independently-derived copies of the same safety-relevant
   fact, and only one is corrected.** Case B: `risk_data['risk_level']` vs the post-B³.5
   local. Case C: normalised vs original text at Check 1; `_welfare_disclosed` vs
   `check_grief`'s internal welfare test in Case A. R12-03 and the `is_high_risk` split are
   **the same failure shape one layer apart**.
2. **The divergence is silent.** No exception, no log line, no test failure. The R12-03
   hotfix added a `logger.warning` for its own case (`unified_safety.py:307-311`) — that is
   the only place in the three paths where a disagreement announces itself.
3. **The fix in every case was to forbid or widen, never to reconcile.** Case A defers the
   write to a turn boundary. Case C ORs the two representations. Nothing resolves a conflict;
   the conflicting states simply both remain, with one of them made unreachable or
   unconditionally dominant.
4. **Authority is positional.** What wins is determined by where in the ~1,400-line
   `buddy_chat` handler a line sits, not by any declared precedence. Case A's gate wins by
   setting `gate_finalised` before the judge block is reached; Case B's stale copy wins
   because it is read 260 lines after the corrective; Case C's correctives win because they
   run after the reconciler.

### What differs because of Radio Check product implementation, not safety architecture

- The grief episode length of 2 turns, single-subject-per-episode, and grief's top priority
  are product decisions with no architectural content.
- Two scoring scales, and the legacy scorer surviving alongside the unified pipeline, are
  migration debt.
- `buddy_sessions` being a process-memory dict, and the reset endpoint clearing one of three
  state stores, are deployment-shaped, not design-shaped.
- The 0.30 AI-influence cap (`unified_safety.py:265-274`) — which
  `docs/session3-live-addendum.md` §2 shows means *"the AI classifier cannot, by score alone,
  lift `unified.risk_level` above LOW — at any confidence, on any message"* — is a tuning
  decision, but it has an architectural consequence: it makes one authority's score
  structurally incapable of changing the outcome.

### Does state have a single identifiable authority?

**No, and in three different ways.**

- **Case A:** single authority in practice (the `grief_lifecycle` snapshot), achieved not by
  design but by forbidding writes mid-turn. The snapshot is built once and read by five
  consumers. This is the closest Radio Check comes to a resolved state.
- **Case B:** authority is **split by accident of reference** — one value, two holders, one
  corrected.
- **Case C:** authority is **distributed by design and then overridden by position**. The
  reconciler is the named authority, but `final_verdict.risk_level` is read by nobody, and
  five subsequent blocks reassign risk from raw pre-reconciler inputs.

### Are conversational state and safety state separated in practice?

**No.** `grief_active_turns` is a conversational continuity counter that selects a safety
protocol and a deterministic gate. `session_risk_history` makes a keyword score
conversation-dependent. `detected_patterns` and `rapid_escalation_detected` accumulate
conversational history into a safety score that ratchets. Three different stores
(`buddy_sessions`, `conversation_states`, `session_risk_history`) hold overlapping state
with different lifetimes and only one is cleared on reset.

### Common bypass and desync mechanisms

1. **Copy-then-correct** (B, and the `_welfare_disclosed` duplication in A).
2. **Different input representation per consumer** (A: raw vs normalised; C(c): the same
   split one layer down).
3. **Silent default on a missing attribute** — `getattr(conv_state, 'history', [])`
   (C(b)) is a desync with no failure signal at all.
4. **Conditional wrappers** — `if protocol_files and buddy_openai_client:` removes the
   entire gate and `is_high_risk` from the path.
5. **Early return** — the failsafe exit at `:6930` bypasses every downstream validator.
6. **Monotonic state with no decay** — `rapid_escalation_detected`, `peak_risk_level`,
   `detected_patterns`.

### Demonstrated by more than one case

- Copy/derive-then-correct divergence: **B and C**, plus a latent instance in A.
- Representation choice changing a safety outcome: **A (gate never sees normalisation) and
  C (R12-03)**.
- Post-hoc overrides reading pre-reconciler inputs: **B and C**.
- State that persists past its intended episode: **A (name persistence, pre-fix) and C
  (reset leaves two of three stores intact)**.

### Relies on one case only — do not generalise

- **The turn-boundary write discipline** (A.6) is a single instance. It worked for grief, but
  there is no second case showing it generalises.
- **The empty-classifier-history bug** (C.4b) is one line in one file. Its consequences are
  inferred, not measured — no incident is attributed to it.
- **`is_high_risk` reaching the user as a crisis-register fallback on an AMBER turn** (B.2)
  is derived from code reading. **I found no incident record and no test demonstrating it
  has actually happened in production.** It should be treated as a live hypothesis, not an
  observed failure.
- The `"i wont kill myself"` behaviour (C.5) is documented only in a commit message and is
  demonstrated by no test in either direction.

---

## On whether state resolution is the next justified step

The brief invited the answer "not yet", so: the evidence points at a **neighbouring**
problem rather than contradicting the plan.

Across all three cases, the recurring failure is not that Radio Check resolves state badly.
It is that **the same fact exists in more than one place with no rule about which holder is
authoritative, and no signal when they disagree.** Case B has no state resolver involved at
all — it is one string copied at line 6597. Case C's reconciler is a working resolver whose
output is then ignored by the consumers that matter.

That suggests the evidence supports a contract about **single authority and disagreement
detection** at least as strongly as it supports one about resolution. Both A and C also show
that a resolution rule is worth little if later code can read the pre-resolution inputs
directly — which is exactly what `server.corrective_block(reads RAW unified, not reconciler)`
records itself doing.

Which of those Zentrafuge takes first is your and Ant's call. I have not drafted either.

---

## Appendix: primary sources

Code (all `backend/`, `main` @ `0a497e7`): `server.py`, `safety/unified_safety.py`,
`safety/verdict_reconciler.py`, `safety/protocol_gates.py`, `safety/conversation_monitor.py`,
`safety/text_normalizer.py`, `safety/fallback_validation.py`, `safety/provenance.py`,
`safety/safety_monitor.py`, `personas/soul_loader.py`.

Tests: `test_grief_gate_person_reference.py`, `test_grief_gate_two_tier.py`,
`test_grief_state_cleardown.py`, `test_fallback_validation.py`,
`test_r12_03_original_text_failsafe.py`, `test_round10_phase_b_reconciler.py`,
`test_decision_provenance.py`, `test_unified_safeguarding.py`, `test_differential_harness.py`,
`tests/differential/runtime_chain.py`, `tests/differential/corpus.json`.

Incident and audit docs: `docs/session3-live-addendum.md`,
`docs/session3-differential-results.md`, `docs/session4-scope-1-fallback-validation.md`,
`docs/app-and-portals-review-2026-09-18.md`, `memory/PHASE_B3_5_RISK_LEVEL_AUDIT.md`,
`memory/PHASE_B3_INVESTIGATION_ANSWERS.md`,
`backend/tests/differential/results/judge_probe_2026-09-15.md`,
`backend/tests/differential/results/post_deploy_106_2026-09-20.md`.

Commits: `3aa2777` (R12-03 hotfix), `f1a9e7f` (negation whole-word), `9db1f32` (Phase E
grief welfare gate), `75b00c6` (Q6 person-reference, labelled NOT FOR MERGE).
