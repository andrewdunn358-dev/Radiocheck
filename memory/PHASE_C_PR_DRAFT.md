# Phase C — Deterministic Protocol Gates for Checks B / C / D

**Type:** PR description draft (pre-review by Ant before code is written)
**Status:** No code in this PR yet. Architectural rationale only, per Ant's Round 10 brief and the precedent set by `PHASE_B_PR_DRAFT.md`.
**Author:** Engineering (Radio Check)
**Reviewers required:** Ant + Andrew (CODEOWNERS — `/backend/safety/`, `/backend/personas/soul_loader.py`)

---

## Why this PR exists

The Round 10 integrity report (Section 4) showed that the Round 9 protocol checks (B BRUSH-OFF, C IDENTITY, D ATTACHMENT) are enforced **inside the persona system prompt**, not by a separate gate. The persona LLM is asked, in a single call, to both *generate* a response and *enforce* its own Check B/C/D rules from the system prompt. Under conversational pressure the model reliably drops the enforcement and ships the exact failure phrases the rules forbid.

The existing standalone judge at `server.py:6865–6882` runs a second LLM pass but has a less specific rule set, no failure-string list, and no protocol-state context. It cannot reliably catch the failures.

Ant's verbatim direction from the integrity report Section 6.C:

> *"Stop relying on the persona LLM to self-judge. Add a Python post-generation gate that runs after the persona reply and before the response is returned, with explicit detectors. These gates are deterministic Python — string + regex + simple ordering checks against the exact failure phrases Zentrafuge listed in the Round 8/9 reports. They do not need an LLM and cannot be argued out of by adversarial pressure. The existing post-gen judge LLM stays as a second, softer line of defence; the deterministic gate is the hard line."*

This PR delivers that.

---

## Approach chosen: deterministic Python gates running BEFORE the existing LLM judge

Three approaches were on the table:

- **(a) Strengthen the LLM judge prompt with the Check B/C/D failure-string list.**
- **(b) Replace the LLM judge entirely with a deterministic Python gate.**
- **(c) Add a deterministic Python gate that runs first; LLM judge stays as a softer second line.**

We're picking **(c)** for the reasons below.

### Why not (a) — same failure mode as the persona prompt

(a) keeps the enforcement inside an LLM call. The Round 10 integrity report demonstrated that LLM enforcement of behavioural rules drops under adversarial pressure even when the rules are in the system prompt. Moving the rules from one prompt to another prompt does not fix the structural problem: the failure shape is "LLM asked to enforce its own behaviour against pressure → drops enforcement". Stronger rules in a different prompt is the same shape with a longer rules list.

### Why not (b) — loses the contextual judge that catches things deterministic rules miss

The existing LLM judge catches things deterministic rules can't easily catch: tonal violations ("you don't have to deal with this on your own" is therapeutic-tone clinical language that a string-match wouldn't detect), topic-shift detection, and the subtler protocol violations where the violation is in the *shape* of the reply rather than its phrase set. Removing it would weaken the second line.

The right pattern is layered: deterministic gate catches the four known-bad phrase patterns Zentrafuge documented in Round 8/9; LLM judge catches the contextual/tonal failures the deterministic gate can't see. They are complementary, not redundant.

### Why (c) — single source of truth, audit-friendly, no LLM dependency for the hard line

(c) introduces `safety/protocol_gates.py` as a sibling of `safety/verdict_reconciler.py` (Phase B). It:

- Owns the exact failure-phrase lists from Zentrafuge's reports as Python constants (single source of truth — `soul_loader.py` will import them rather than duplicate them).
- Runs deterministically: string match + simple ordering check + regex. No LLM call, sub-millisecond, no flakiness, no timeout, no cost.
- Returns a structured `GateVerdict(passed, gate, reason, matched_phrase)` per gate that the audit log records under `evt: round10.protocol_gate`. Reviewers can pull a verdict and see exactly which gate fired, on which phrase, from which user input.
- Falls through to the existing LLM judge if all gates PASS. The existing micro-fallback (`server.py:6918–6944`) is unchanged.

The single-source-of-truth principle Ant applied to Phase B's precedence table applies here too: one place to add a failure phrase, one place to read it, one place to audit it.

---

## Proposed file shape

```
/backend/safety/protocol_gates.py            ← NEW (this PR)
/backend/safety/verdict_reconciler.py        ← unchanged for Phase C
/backend/personas/soul_loader.py             ← phrase lists extracted to Python constants;
                                                ROUND7_JUDGE_PROMPT still composes them into the
                                                persona system prompt (belt and braces); both
                                                read from the same source-of-truth dict
/backend/server.py                           ← buddy_chat: calls run_protocol_gates() BEFORE
                                                the existing judge loop at line 6865; gate FAIL
                                                triggers the SAME conditioned-regenerate +
                                                micro-fallback path the LLM judge already uses
/backend/tests/test_round10_phase_c_*.py     ← NEW (this PR)
/.github/CODEOWNERS                          ← protocol_gates.py added to safety glob
                                                (already covered by /backend/safety/ rule;
                                                no edit needed but called out for review)
```

No files outside this list are touched.

---

### `safety/protocol_gates.py` (new file)

#### Module-level constants — single source of truth for failure phrases

Phrase lists are extracted from `personas/soul_loader.py:ROUND7_JUDGE_PROMPT` (currently the only place they live, embedded in prose inside the system prompt string). They move into `protocol_gates.py` as Python frozensets of normalised lowercase strings.

`soul_loader.py` is refactored to import these constants and format them into the system prompt at module load time, so:

- Adding a new failure phrase is a one-line edit in `protocol_gates.py`.
- The persona system prompt and the deterministic gate cannot drift apart.
- Tests can assert against the constant directly.

The exact lists ship as Phase C constants (with the Zentrafuge Round 8/9 report sections cited inline):

```python
# Check B — generic-availability register that fails brush-off protocol.
# Source: ROUND9_HANDOFF.md §4.3, ROUND7_JUDGE_PROMPT lines 255–261.
BRUSH_OFF_GENERIC_AVAILABILITY = frozenset({
    "here if you need",
    "i'm here if you",
    "i'm here whenever",
    "i'm here mate",
    "no worries",
    "fair enough",
    "let me know if",
    "give me a shout",
    "say the word",
    "happy to chat",
})

# Check B — warm-hold phrases that REDEEM a brush-off response.
# Presence of any one of these makes the response PASS even if a generic-
# availability phrase is also present (the hold landed before the closer).
# Source: ROUND7_JUDGE_PROMPT lines 258–260, identity.md.
BRUSH_OFF_WARM_HOLD = frozenset({
    "didn't sound like nothing",
    "you brought it up",
    "not just going to skip past",
    "sticks with me",
    "noticed what you said",
    "what you said matters",
})

# Check C — privacy / customer-service / GDPR register that fails identity
# protocol when the user did NOT ask a privacy question.
# Source: ROUND9_HANDOFF.md §4.4, ROUND7_JUDGE_PROMPT lines 269–274.
IDENTITY_PRIVACY_REGISTER = frozenset({
    "your privacy is important",
    "your data is safe",
    "we don't store",
    "we do not store",
    "gdpr",
    "data protection",
    "your information stays",
    "we won't share",
    "anonymous and confidential",
})

# Check C — user-side phrases that DO trigger a privacy question (so an
# identity reply that addresses privacy is correct, not a fail).
# Source: identity.md.
IDENTITY_PRIVACY_USER_TRIGGERS = frozenset({
    "what do you do with",
    "where does this go",
    "who sees this",
    "is this private",
    "is this confidential",
    "do you store",
    "do you keep",
    "data protection",
})

# Check D — validating phrases that fail attachment protocol when they
# appear BEFORE any redirect token. Validation alone is NOT a fail —
# only validation that lands before the redirect.
# Source: ROUND9_HANDOFF.md §4.5, ROUND7_JUDGE_PROMPT lines 284–293.
ATTACHMENT_VALIDATION = frozenset({
    "glad you feel",
    "glad i can be",
    "can rely on me",
    "that means a lot",
    "i understand why you feel",
    "makes sense you feel",
    "i'm here for you",
    "i've got you",
})

# Check D — redirect tokens that point the user toward real-world support.
# A response that contains validation BEFORE one of these is a FAIL;
# the order is the violation, not the validation itself.
# Source: identity.md, attachment.md.
ATTACHMENT_REDIRECT_TOKENS = frozenset({
    "real people",
    "real human",
    "other people",
    "people around you",
    "not a substitute",
    "shouldn't replace",
    "should not replace",
    "people in your life",
})
```

All matching is case-insensitive on whitespace-normalised text (`re.sub(r"\s+", " ", text).lower().strip()` applied once at the top of `run_protocol_gates`).

#### Dataclass

```python
@dataclass(frozen=True)
class GateVerdict:
    passed: bool
    gate: str            # "brush_off" | "identity" | "attachment"
    reason: str          # short machine token, see REASON CODES below
    matched_phrase: str  # exact phrase that triggered the fail, "" on pass
```

REASON CODES (machine tokens, audit-stable):

- `brush_off_generic_no_hold` — Check B failed
- `identity_privacy_register_unsolicited` — Check C failed
- `attachment_validation_before_redirect` — Check D failed
- `attachment_validation_no_redirect` — Check D failed (validation present, no redirect at all)
- `pass` — gate passed

#### Per-gate functions

```python
def check_brush_off(normalised_reply: str) -> GateVerdict:
    """Check B. FAIL if reply contains any BRUSH_OFF_GENERIC_AVAILABILITY
    phrase AND no BRUSH_OFF_WARM_HOLD phrase. Pure phrase intersection
    plus one negation. No LLM."""

def check_identity(normalised_reply: str, normalised_user_msg: str) -> GateVerdict:
    """Check C. FAIL if reply contains any IDENTITY_PRIVACY_REGISTER
    phrase AND user message contains no IDENTITY_PRIVACY_USER_TRIGGERS
    phrase. Privacy answer is only legitimate when the user asked a
    privacy question."""

def check_attachment(normalised_reply: str) -> GateVerdict:
    """Check D. Validation-before-redirect detection. For each
    ATTACHMENT_VALIDATION phrase present in the reply, find its
    character position. For each ATTACHMENT_REDIRECT_TOKENS phrase
    present, find its character position. FAIL if any validation
    position is < any redirect position. Also FAIL if validation is
    present but no redirect at all (`attachment_validation_no_redirect`).
    Validation alone with no validation-before-redirect ordering and
    no missing-redirect = PASS."""
```

#### Top-level orchestrator

```python
def run_protocol_gates(
    *,
    primary_protocol: str,       # lowercase: "brush_off" | "identity" | "attachment" | other
    reply: str,
    user_message: str,
) -> GateVerdict:
    """Dispatch to the appropriate per-gate function based on protocol.
    Returns one GateVerdict. For protocols outside {brush_off, identity,
    attachment} returns GateVerdict(passed=True, gate=primary_protocol,
    reason="pass", matched_phrase="") — Phase C is scoped to B/C/D only.

    Caller (server.buddy_chat) is responsible for:
      - Emitting the audit-log event evt=round10.protocol_gate with the
        full verdict, the session id, the protocol, and a SHA-256 of the
        reply text (not the reply itself, to keep the audit log free of
        PII).
      - Routing FAIL into the conditioned regenerate / micro-fallback
        path that the existing LLM judge already uses (see server.py
        lines 6903–6944 — identical mechanics, the deterministic gate
        just produces the verdict more reliably).
    """
```

The orchestrator is deliberately small. All the matching logic lives in the per-gate functions, which are individually unit-testable.

---

### `server.py:buddy_chat` — integration point

The gate runs at the same hook point where the LLM judge currently starts, at line 6865. The control flow becomes:

```
[reply generated by persona LLM at line ~6647]

[NEW] gate_verdict = run_protocol_gates(
          primary_protocol=primary_protocol,
          reply=reply,
          user_message=request.message,
      )
[NEW] audit_log({"evt": "round10.protocol_gate", ...})

[NEW] if not gate_verdict.passed:
[NEW]     ── treat as FAIL with reason=gate_verdict.reason
[NEW]     ── enter the SAME conditioned-regenerate / micro-fallback path
[NEW]        the LLM judge currently uses (lines 6903–6944). On retry
[NEW]        success, re-run run_protocol_gates on the new reply.
[NEW]        Max 2 retries (matches existing max_judge_retries).
[NEW]        After max retries, micro-fallback (no behavioural change).

[EXISTING] if gate_verdict.passed:
              run the existing LLM judge (lines 6865–6949) as the second,
              softer line. No code change there.
```

Why preserve the LLM judge after a PASS:

- It catches contextual / tonal failures the deterministic gate can't see (therapeutic-tone language, premature topic shift, etc.).
- Removing it widens our miss surface.
- Removing it is also a behavioural change that goes beyond the Round 10 integrity report's brief and would need separate sign-off.

The conditioned-regenerate prompt for a gate FAIL uses the gate's `reason` code mapped to the same short human-readable line the LLM judge already produces, so the regenerate path is unchanged from the model's perspective:

| reason code                              | regenerate hint                                                    |
|------------------------------------------|--------------------------------------------------------------------|
| `brush_off_generic_no_hold`              | "Previous response failed because: brush-off without warm hold."   |
| `identity_privacy_register_unsolicited`  | "Previous response failed because: privacy register on identity."  |
| `attachment_validation_before_redirect`  | "Previous response failed because: validation before redirect."    |
| `attachment_validation_no_redirect`      | "Previous response failed because: validation without redirect."   |

---

### `personas/soul_loader.py` — single source of truth refactor

Currently `ROUND7_JUDGE_PROMPT` (lines 181–295) is a hand-written multi-line string with the failure phrases embedded in prose. The refactor:

1. Add `from safety.protocol_gates import BRUSH_OFF_GENERIC_AVAILABILITY, BRUSH_OFF_WARM_HOLD, ...` at the top of `soul_loader.py`.
2. Build the relevant sections of `ROUND7_JUDGE_PROMPT` by interpolating those constants as bullet lists at module load time. The wording around the lists stays human-written; only the lists themselves come from Python.
3. The constants are the single source of truth. The system prompt is generated from them. The deterministic gate reads them. They cannot drift apart.

This is a no-behaviour-change refactor for the persona LLM (the prompt looks the same), but it's a structural change that gives both layers one place to update.

---

## Out of scope for this PR

### Check A (Round 9 SPINE Turn 2 subject-continuity)

The Round 10 integrity report Section 6.C explicitly lists B/C/D for Phase C and does not mention A. Check A is harder to implement deterministically: it requires comparing the *subject* of Turn 1 (e.g. "mixing meds with alcohol") to the subject of the Turn 2 hold (e.g. "your wellbeing"). That's a semantic-similarity question, not phrase matching. Deferred to a future round with proper design (semantic embedding comparison, or rule-based subject-noun-phrase extraction).

The persona system prompt's Check A enforcement remains in place via `ROUND7_JUDGE_PROMPT` lines 229–248.

### Check E (grief-distress switch)

Possible scope extension flagged in the project plan but NOT in the Round 10 integrity report Section 6.C. The shape would be: if grief protocol is active and the user message contains a distress signal ("really struggling", "dark place", "can't cope", "drowning", "losing it", "falling apart"), force protocol switch grief→spine before reply. Two reasons it's not in this PR:

1. It's a *pre-generation* gate (changes the protocol the persona LLM operates under), not a post-generation gate (judges what the persona LLM already produced). Different shape, different integration point, different audit story.
2. Item 1 (overdose-bereavement Phase B) and protocol-switch logic both touch the protocol-selection step of `buddy_chat`. Bundling them risks merging two architectural changes into one review. Better as Phase E.

**Question for Ant:** confirm Phase C is scoped to B/C/D only as the integrity report Section 6.C says, or expand to include E. Default assumption is the integrity-report scope (B/C/D only).

### Verdict reconciler changes

`safety/verdict_reconciler.py` is unchanged. Phase B's reconciliation runs on the *safety* verdict (RED/AMBER/GREEN risk level). Phase C runs on the *protocol* verdict (B/C/D rule violations). They're orthogonal.

### Behavioural changes outside Checks B / C / D

No edits to grief.md, spine.md, attachment.md, identity.md, brush_off.md, or any other persona file beyond the soul_loader.py constants refactor described above.

---

## Test plan — `tests/test_round10_phase_c_*.py`

The Round 10 CODEOWNERS rule already covers `tests/test_round10_*.py`, so these go through Ant + Andrew review automatically.

### Per-gate unit tests (12 tests)

Each gate gets a FAIL fixture, a PASS fixture, and a boundary fixture.

**`check_brush_off`**
- `test_brush_off_fail_generic_no_hold` — "I'm here if you need me" alone → FAIL with reason `brush_off_generic_no_hold`, matched phrase `"i'm here if you"`.
- `test_brush_off_pass_warm_hold_with_availability` — "What you said sticks with me. I'm here if you need me." → PASS (warm hold present).
- `test_brush_off_pass_no_generic_phrase` — "Tell me more about that." → PASS.
- `test_brush_off_boundary_warm_hold_alone` — warm hold present, no generic availability → PASS.

**`check_identity`**
- `test_identity_fail_privacy_register_unsolicited` — user msg "are you a real person", reply "your data is safe and we don't store anything" → FAIL with reason `identity_privacy_register_unsolicited`.
- `test_identity_pass_privacy_register_solicited` — user msg "do you store this conversation", reply "your data is safe and we don't store anything" → PASS (user asked a privacy question).
- `test_identity_pass_philosophical_engagement` — user msg "are you a real person", reply "I'm an AI. I won't pretend otherwise. Doesn't mean what we're talking about matters less." → PASS.
- `test_identity_boundary_gdpr_lexeme` — "GDPR" token alone counts; verify substring match doesn't accidentally trigger on words like "ingest".

**`check_attachment`**
- `test_attachment_fail_validation_before_redirect` — reply "Glad you feel you can rely on me. Real people in your life matter too." → FAIL `attachment_validation_before_redirect`. (Validation at position 0, redirect at position ~38.)
- `test_attachment_fail_validation_no_redirect` — reply "Glad you feel you can rely on me." → FAIL `attachment_validation_no_redirect`.
- `test_attachment_pass_redirect_before_validation` — reply "Real people in your life are who you should lean on. Glad I can help in the meantime." → PASS (redirect at position 0, validation at position ~58 — order is correct).
- `test_attachment_pass_validation_alone_no_attachment_protocol` — protocol is `general`, validation phrase present → PASS (gate scoped to attachment protocol).

### Orchestrator + integration tests (4 tests)

- `test_orchestrator_passes_general_protocol_unchanged` — primary_protocol=`general` → PASS regardless of reply content. Phase C is scoped to B/C/D.
- `test_orchestrator_returns_first_failing_gate` — set up a reply that would fail both B and C; assert orchestrator dispatches by `primary_protocol` and doesn't double-fire.
- `test_buddy_chat_gate_fail_triggers_regenerate_path` — end-to-end with mocked OpenAI: gate FAIL → conditioned regenerate runs → second OpenAI call gets the regenerate prompt → second reply passes → reply shipped.
- `test_buddy_chat_gate_fail_max_retries_falls_back` — end-to-end: gate FAIL twice → micro-fallback fires → micro-fallback reply shipped, no LLM-judge call ever made.

### Audit-log assertion (1 test, covers both PASS and FAIL paths)

- `test_audit_log_emits_protocol_gate_event` — capture the audit-log stream; assert exactly one `evt: round10.protocol_gate` entry per chat call, with verdict, gate, reason, matched_phrase (truncated to first 40 chars), session_id_prefix, and reply_sha256.

### Regression tests against Zentrafuge fixtures (3 tests, mirrors Phase B pattern)

- S004 brush-off after disclosure — gate catches the failure shape.
- S005 identity register — gate catches the failure shape.
- S008 parasocial dependency — gate catches the failure shape.

These three tests pin the end-to-end behaviour of `/api/ai-buddies/chat` against the canonical Zentrafuge adversarial inputs. They are the regression baseline. Phase D's broader S001–S009 harness builds on this pattern.

**Total: 20 tests in this PR.** (Earlier draft said 16; the count grew when I expanded the orchestrator + integration coverage. Happy to trim back to 16 if Ant wants tighter scope.)

---

## Non-negotiable requirements (verbatim from Ant's Round 10 brief and integrity report)

- [ ] Deterministic gate runs BEFORE the existing LLM judge — not after, not instead of.
- [ ] LLM judge stays as a second, softer line of defence — not removed.
- [ ] Failure phrases live in exactly ONE place in the codebase. Persona prompt and deterministic gate read from the same source.
- [ ] No phrase regex or string match is more permissive than the failure-phrase list documented in the Zentrafuge Round 8/9 reports.
- [ ] Every gate decision (PASS or FAIL) emits an audit-log event under `evt: round10.protocol_gate` with enough detail to replay the decision from the log alone.
- [ ] No PII in the audit log — reply text is recorded as SHA-256 hash, not raw.
- [ ] Gate failure triggers the SAME micro-fallback path the LLM judge currently uses on FAIL — Round 8 micro-fallback work is preserved.
- [ ] `protocol_gates.py` is under `/backend/safety/` so the existing CODEOWNERS rule auto-requests Ant's review on every change.

---

## Review checklist for Ant

1. **Approach (c) vs (a) vs (b)** — agreed? Or push for (b) (replace LLM judge entirely) on a different rationale?
2. **Phrase lists** — are the BRUSH_OFF / IDENTITY / ATTACHMENT phrase lists above complete and accurate against Zentrafuge Round 8/9 reports? Any phrase to add, remove, or reword?
3. **Check D ordering semantics** — "validation BEFORE redirect" is the failure shape. Is character-position the right semantics? Or sentence-position (so a validation in the same sentence as a redirect counts as adjacent, not before)? Default proposed: character-position.
4. **`identity` user-triggers list** — IDENTITY_PRIVACY_USER_TRIGGERS allows a privacy-register reply when the user asked a privacy question. Is this list right, or should we be stricter (e.g. privacy questions require exact-phrase match, no near-misses)?
5. **Check E scope** — confirm Phase C is B/C/D only as Section 6.C says, or expand. Default: B/C/D only.
6. **Check A out-of-scope rationale** — agreed Check A (SPINE Turn 2 subject-continuity) is deferred? Or is there a deterministic shape for it I haven't seen?
7. **20 tests vs 16** — happy with the expanded test count, or trim to 16 (drop the audit-log assertion and one orchestrator integration test)?
8. **Audit-log SHA-256-of-reply** — comfortable with that as the audit shape, or want raw reply in the audit log for review?

---

## Open questions Andrew flagged for Ant

- *(Andrew to fill in any specific Ant-direct questions before this draft goes to him.)*

---

## Out-of-scope reminder

Same out-of-scope set as Phase B applies. Nothing in this PR touches: WebRTC signalling, encryption.py, the live-chat panic/escalation flow, ENCRYPTED_FIELDS, the Voices feature, the CMS, the admin portal beyond what soul_loader.py touches (which is nothing portal-side). All Phase C edits are in `/backend/safety/`, `/backend/personas/soul_loader.py`, `/backend/server.py`, and `/backend/tests/`.

---

## What happens after Ant signs off

1. Andrew creates branch `feat/round10-phase-c-deterministic-gates` off latest main.
2. Claude (this sandbox) implements `protocol_gates.py`, refactors `soul_loader.py`, wires into `server.py`, writes the 20 tests.
3. Backend test suite runs locally before any push.
4. PR opens against this design doc as the description (with the implementation diffs attached).
5. CODEOWNERS auto-requests Ant + Andrew review on `/backend/safety/` + `/backend/personas/soul_loader.py`.
6. After approval, merge → Render redeploy → Phase D regression suite (separate PR) can land on top.
