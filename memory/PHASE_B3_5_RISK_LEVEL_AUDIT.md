# Phase B³.5 Pre-Scoping Audit — `risk_level` Mutation Inventory

> **Method.** Read-only grep + trace against `main` post-PR #9 (B³) merge. No code changes, no fix proposals. Enumeration of every write to the local `risk_level` variable in `buddy_chat()` between lines 6320 and 7028, classified by gating mechanism. Per Andrew's §1 sharpening, the reconciler's `precedence_rule_fired` value space is enumerated as a deliberate finding before classification, not assumed inside any single entry.

---

## §0 — Pre-classification finding: `precedence_rule_fired` value space and which produce `failsafe_should_fire == False`

The reconciler at `backend/safety/verdict_reconciler.py` returns one of exactly **five** values for `final_verdict.precedence_rule_fired`. The mapping to `failsafe_triggered` is:

| Precedence rule | `failsafe_triggered` | Source line(s) | Notes |
|---|---|---|---|
| `CLASSIFIER_UNAVAILABLE` | **inherits** `keyword.failsafe_triggered` (so True or False) | reconciler.py:254–261 | Returns when classifier didn't run / errored; defers to keyword pipeline. |
| `CONTEXT_OVERRIDE` | **False** | reconciler.py:291–302 | Keyword fired solely on a reconcilable trigger + classifier disagrees + context detector matches. |
| `KEYWORD_FAILSAFE` | **True** | reconciler.py:312–323 | Keyword pipeline fired the failsafe and no override applies. |
| `CLASSIFIER_ESCALATION` | **True** | reconciler.py:336–349 | Keyword silent, classifier authoritatively says imminent + intent + confidence. |
| `DEFAULT` | **False** | reconciler.py:354–365 | Neither pipeline escalates. |

The local `failsafe_should_fire` variable is initialised at `server.py:6397` from `final_verdict.failsafe_triggered`, then **finalised through line 6445** by the negation- and identity-guard adjustment blocks, which can flip True → False (never False → True).

So `failsafe_should_fire == False` at line 6555 (where the B³ elif sits) arises from any of:

1. **`CONTEXT_OVERRIDE`** — caught by the B³ elif.
2. **`DEFAULT`** — **not caught** by the B³ elif. The B³ elif's condition is `not failsafe_should_fire AND final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE"`, which is False under DEFAULT.
3. **`CLASSIFIER_UNAVAILABLE` with `keyword.failsafe_triggered == False`** — **not caught** by the B³ elif.
4. **`KEYWORD_FAILSAFE` / `CLASSIFIER_ESCALATION` flipped to False by `negation_confirmed`** — caught upstream by the `negation_confirmed` branch of the same if/elif chain (line 6542), which fires before the B³ elif.
5. **`KEYWORD_FAILSAFE` / `CLASSIFIER_ESCALATION` flipped by `identity_active`** — partially caught. The `identity_active` branch (line 6548) fires only when `unified_risk not in ["IMMINENT"]`, so an IMMINENT message under identity-active flow falls through to the B³ elif and the upgrade branches below.

**Implication:** the B³ elif intercepts case (1) only. Cases (2), (3), and the IMMINENT-under-identity-active corner of (5) all reach the IMMINENT/HIGH/MEDIUM upgrade branches at 6568/6572/6576 with `failsafe_should_fire == False`. Whether that produces a user-visible leak depends on (a) whether `unified_safety["risk_level"]` can take the relevant value under each rule, and (b) whether the resulting `risk_level` write reaches a user-visible field.

These reachability questions are answered per-entry in the table below.

---

## §1 — Inventory Table

Audit window: `backend/server.py` lines **6320–7028**, function `buddy_chat()` (which spans 6161–7069 — the audit window is fully inside it). Only **writes** to the local `risk_level` are listed; reads (e.g. line 6602 `if safety_wrapper_data and risk_level == "RED":`, line 6699 `is_high_risk = risk_data.get('risk_level') == 'RED'`, line 7029, 7041, 7043) are excluded per §3.1. Constructor-kwarg uses (e.g. line 6465 `risk_level="RED"` to `SafeguardingAlert(...)`, line 6987 `risk_level=db_risk_level`, line 7016 `risk_level=risk_level`) are excluded — they pass values into other objects without rebinding the local. Writes to `db_risk_level` (lines 6967, 6971) are excluded — they target a different local.

| # | Approx Line | Code Snippet (one line) | Surrounding Condition (paraphrased) | Classification | Gating Mechanism |
|---|---|---|---|---|---|
| 1 | 6334 | `risk_level = risk_data["risk_level"]` | Initial assignment after `check_safeguarding()` returns. Runs unconditionally — no surrounding `if`. | **In scope for B³.5** | None — pre-reconciler. The reconciler hasn't run yet at this point (it runs at line 6371). The legacy keyword verdict from `check_safeguarding()` is written directly. This is the leak vector that surfaced via the B³ failing test. |
| 2 | 6555–6566 (no write) | `elif not failsafe_should_fire and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE": logging.info(...)` | The new B³ elif in the negation/identity suppression chain. Falls through; **does not write to `risk_level`.** Listed for completeness only. | **In scope for B³ (already shipped)** | `failsafe_should_fire` + `final_verdict.precedence_rule_fired` direct read. This is the gate, not a leak. |
| 3 | 6568 | `risk_level = "RED"` (also sets `should_escalate = True`) | `elif unified_risk == "IMMINENT" and risk_level != "RED":`. Runs after the negation/identity/B³ elifs (6542, 6548, 6555) have all been evaluated. | **Latent split-authority bug — LIVE LEAK VECTOR** (see §3.1, corrected) | Not gated by `failsafe_should_fire`. Reachable in production today via the score-only IMMINENT path in `unified_safety.py:291–292` → `keyword.failsafe=False` → reconciler `DEFAULT` → B³ elif misses (rule isn't `CONTEXT_OVERRIDE`) → IMMINENT branch fires → `risk_level="RED"` → overlay leaks at line 7041. Phase B² gate suppresses the alert side, but the user-facing overlay leaks. Same shape as the original Round-10 S009 bug, different reachability path. |
| 4 | 6572 | `risk_level = "AMBER"` (also sets `should_escalate = True`) | `elif unified_risk == "HIGH" and risk_level not in ["RED", "AMBER"]:`. Same chain position as entry 3. | **Latent split-authority bug** (see §3) | Not gated by `failsafe_should_fire`. Reachable when reconciler fires DEFAULT or CLASSIFIER_UNAVAILABLE-no-fs with `unified.risk_level == "HIGH"`. Currently produces no user-visible leak (see §3.2 for downstream-gate analysis), but the write is not reconciler-aware. |
| 5 | 6576 | `risk_level = "YELLOW"` | `elif unified_risk == "MEDIUM" and risk_level == "GREEN":`. Same chain position. | **Latent split-authority bug** (see §3) | Not gated by `failsafe_should_fire`. Same reachability as entry 4 with `unified.risk_level == "MEDIUM"`. Currently produces no user-visible leak (see §3.3), but the write is not reconciler-aware. |
| 6 | 6584 | `risk_level = "AMBER" if risk_level == "GREEN" else risk_level` (also sets `should_escalate = True`) | `if not negation_confirmed and not identity_active and failsafe_should_fire and unified_safety.get("rapid_escalation") and not should_escalate:` | **In scope for B³ (already shipped)** | `failsafe_should_fire` directly in surrounding condition, added by B³ change 2. |
| 7 | 6592 | `risk_level = "AMBER"` (also sets `should_escalate = True`) | Inside `if not negation_confirmed and not identity_active and failsafe_should_fire and unified_safety.get("detected_patterns"):` and `if any(p in unified_safety.get("detected_patterns", []) for p in concerning_patterns):` and `if risk_level == "GREEN":` | **In scope for B³ (already shipped)** | `failsafe_should_fire` directly in outer surrounding condition, added by B³ change 3. |

---

## §2 — Classification Definitions Used

- **In scope for B³ (already shipped)** — write site already gated by the B³ fix; included for completeness, no further action.
- **In scope for B³.5** — leak vector that B³.5 must close. Line 6334 is the known one.
- **Out of scope, currently safe** — write site exists but is gated upstream in a way that keeps it consistent with the reconciler. Note the upstream gate explicitly. (Not used in this audit; nothing fits this category cleanly.)
- **Latent split-authority bug** — write site is not gated by the reconciler at the write site itself. Per Andrew's §1 sharpening, this audit treats *write-site reconciler-awareness* as the criterion, not downstream consequence. Latent bugs are surfaced for Anthony to decide whether to fold into B³.5's scope.

---

## §3 — Latent Split-Authority Bugs (3 found)

**STOPPING after the table per §5 of the brief. Surfacing these to Andrew before continuing past the summary.**

### §3.1 — IMMINENT branch at server.py:6568

**Snippet:**
```python
elif unified_risk == "IMMINENT" and risk_level != "RED":
    risk_level = "RED"
    should_escalate = True
    logging.warning(f"Unified safety escalated to RED (IMMINENT) - Session: ...")
```

**Path to user-facing payload (does it leak?):**
- Direct path to overlay: `risk_level = "RED"` → line 7041 `safeguardingTriggered=(risk_level == "RED")` → True → frontend renders `SafeguardingCallModal`.
- Direct path to alert: `should_escalate = True` → line 6932+ alert insert → Phase B² gate → `status="audit_only"` (because `failsafe_should_fire == False`) → suppressed from default queue.
- **Net user-visible effect today: overlay LEAKS** if this branch fires under `failsafe_should_fire == False`. Same shape as the original Round-10 S009 bug, just one branch over.

**Why it appears not to fire today (CORRECTED 2026-05-04 after Andrew's pre-design check):**

**This subsection's prior version cited a non-existent invariant.** It claimed `unified_result["risk_level"] == "IMMINENT"` requires `unified_result["failsafe_triggered"] == True`, citing `unified_safety.py:288–290`. That was wrong: lines 288–290 are only the `if failsafe_triggered:` branch of an if/elif chain. **Line 291–292 is `elif final_score >= UNIFIED_THRESHOLD_IMMINENT: final_risk_level = "IMMINENT"`** — a score-only path that produces IMMINENT without `failsafe_triggered` being set. Verified by direct grep of `unified_safety.py:280–300` post-PR #9.

**The correct leak path is reachable in production today, not contingent on a future refactor:**

1. Message produces moderate signals across multiple safety layers — none individually fire `failsafe_triggered`, but the weighted combination crosses `UNIFIED_THRESHOLD_IMMINENT` (the score-only IMMINENT path at `unified_safety.py:291–292`).
2. `analyze_message_unified()` returns `unified_result["risk_level"] == "IMMINENT"` and `unified_result["failsafe_triggered"] == False`.
3. `extract_verdicts_from_unified()` (`reconciler.py:557`) copies `unified.failsafe_triggered` directly to `keyword.failsafe_triggered` — so `keyword.failsafe_triggered == False`.
4. With `keyword.failsafe_triggered == False`, the reconciler skips Rule 1 (CONTEXT_OVERRIDE — requires kw.failsafe=True), Rule 2 (KEYWORD_FAILSAFE — same). It evaluates Rule 3 (CLASSIFIER_ESCALATION — requires `classifier.risk_level == "imminent" AND contains_self_harm_intent AND confidence ≥ threshold`); if any of those fail it falls through. Otherwise it returns Rule 4 (DEFAULT) with `failsafe_triggered=False`. CLASSIFIER_UNAVAILABLE-with-no-keyword-failsafe is the same shape.
5. In `buddy_chat()`: `failsafe_should_fire = final_verdict.failsafe_triggered = False` (line 6397). Negation/identity guards don't flip False → True (only True → False). So `failsafe_should_fire` arrives at line 6555 as False.
6. The if/elif chain at line 6542:
   - `negation_confirmed` branch: doesn't fire (no negation in a moderate-signal message).
   - `identity_active` branch (6548): guarded by `unified_risk not in ["IMMINENT"]` — doesn't fire because `unified_risk == "IMMINENT"`.
   - **B³ elif (6555): doesn't fire because `final_verdict.precedence_rule_fired == "DEFAULT"` (or `"CLASSIFIER_UNAVAILABLE"`), not `"CONTEXT_OVERRIDE"`.**
   - **IMMINENT branch (6568) fires: `unified_risk == "IMMINENT" AND risk_level != "RED"` is True (assuming `check_safeguarding()` at line 6334 returned anything other than RED, which is plausible for a moderate-signal message — keyword layer alone doesn't see the cross-layer combination).**
7. `risk_level = "RED"`, `should_escalate = True`.
8. Downstream:
   - **Overlay: line 7041 `safeguardingTriggered=(risk_level == "RED") == True` → frontend renders `SafeguardingCallModal`. ✗ LEAK.**
   - Alert: Phase B² gate at line 6932 sees `failsafe_should_fire == False` and writes `status="audit_only"` → suppressed from default queue. ✓
9. **Net production effect: the user sees the crisis overlay (Samaritans 116 123, "I need to be straight with you" preamble, etc.) on a message the reconciler authoritatively decided was non-critical. The staff queue stays clean. Same user-visible shape as the original Round-10 S009 bug.**

**Why this is unambiguously split authority (not "currently safe by upstream invariant"):**

The previous version of this subsection treated the IMMINENT branch as a future-proof concern. The corrected analysis shows it is a live vector reachable in production today. The reconciler said `failsafe_triggered=False` (DEFAULT or CLASSIFIER_UNAVAILABLE-no-fs), the upgrade block ignored that, and the overlay fires. There is no upstream gate that prevents it; the previous "safety" claim was based on a misread of the unified_safety chain.

**Reproduction shape (description only, no test code per §5):** any message that produces moderate signals across keyword, semantic, conversation, and AI-classifier layers — where the weighted score crosses `UNIFIED_THRESHOLD_IMMINENT` (currently 80 per `unified_safety.py` constants) but no individual layer trips a failsafe condition AND the AI classifier does not return `risk_level=="imminent"+contains_self_harm_intent==True+confidence>=0.7` — will land in DEFAULT with `unified_risk=="IMMINENT"` and demonstrate the leak. The brief asks for description only; if Anthony wants a regression test fixture before B³.5 ships, that's a follow-up step.

**Minimum gate that would close it (description only, per §5):** unchanged from prior version — extend the surrounding condition with `failsafe_should_fire and ...`, or add a generalised reconciler-suppress elif above the IMMINENT/HIGH/MEDIUM chain that catches all `not failsafe_should_fire` cases (not just `CONTEXT_OVERRIDE`). The same gate closes §3.2 and §3.3 in one stroke.

---

### §3.2 — HIGH branch at server.py:6572

**Snippet:**
```python
elif unified_risk == "HIGH" and risk_level not in ["RED", "AMBER"]:
    risk_level = "AMBER"
    should_escalate = True
    logging.info(f"Unified safety upgraded risk to AMBER (HIGH)")
```

**Path to user-facing payload (does it leak?):**
- Overlay: `risk_level = "AMBER"` → line 7041 `safeguardingTriggered=(risk_level == "RED")` → False → overlay does NOT render. ✓ no overlay leak.
- Alert: `should_escalate = True` → Phase B² gate → `status="audit_only"` because `failsafe_should_fire == False` → suppressed from default queue. ✓ no staff-queue leak.
- `riskLevel="AMBER"` field on the response payload → frontend currently does not consume this field for any user-visible behaviour (per Phase B³ investigation Q1).

**Net user-visible effect today: NONE.**

**Why it is still latent split-authority:**

1. The write to `risk_level` is not reconciler-aware. The branch fires whenever `unified_risk == "HIGH"`, which can occur under reconciler `DEFAULT` or `CLASSIFIER_UNAVAILABLE`-no-fs (both `failsafe_should_fire == False`). The branch elevates the local risk classification despite the reconciler having authoritatively decided no failsafe.
2. Safety today is a **downstream** consequence: the overlay is RED-only (line 7041), and the alert is gated by Phase B²'s `failsafe_should_fire` check at the alert-write site (line ~6932). Either gate could be removed or weakened by a future change without touching the upgrade block, and this branch would silently re-open as a leak vector.
3. Per Andrew's §1 sharpening, the audit treats *write-site reconciler-awareness* as the criterion, not downstream consequence. By that criterion, this is split authority.

**Minimum gate that would close it (description only, per §5):** same as §3.1 — extend the surrounding condition with `failsafe_should_fire and ...`, or add a generalised reconciler-suppress elif above the IMMINENT/HIGH/MEDIUM chain that catches all `not failsafe_should_fire` cases (not just `CONTEXT_OVERRIDE`).

---

### §3.3 — MEDIUM branch at server.py:6576

**Snippet:**
```python
elif unified_risk == "MEDIUM" and risk_level == "GREEN":
    risk_level = "YELLOW"
    logging.info(f"Unified safety upgraded risk to YELLOW (MEDIUM)")
```

**Path to user-facing payload (does it leak?):**
- Overlay: not RED → False. ✓ no overlay leak.
- Alert: this branch does NOT set `should_escalate = True`, so the alert path is not entered from this branch. ✓ no alert leak.
- `riskLevel="YELLOW"` field on response payload → frontend doesn't consume.

**Net user-visible effect today: NONE.**

**Why it is still latent split-authority:**

Same reasoning as §3.2. The write is not reconciler-aware at the write site. Reachable when reconciler fires DEFAULT or CLASSIFIER_UNAVAILABLE-no-fs with `unified.risk_level == "MEDIUM"`. Currently safe only because (a) YELLOW doesn't trigger any user-facing path, and (b) `should_escalate` isn't set so no alert is written. Future change to either property — e.g. a UI feature that surfaces a YELLOW indicator, or a refactor that consolidates `should_escalate` setting — turns this into a live bug.

The user's §1 sharpening explicitly named this branch as a candidate. Surfacing per the same logic.

**Minimum gate that would close it (description only, per §5):** same as §3.1 / §3.2.

---

## §4 — Summary

- Total write sites found between 6320 and 7028: **6** (entries 1, 3, 4, 5, 6, 7 in the inventory table; entry 2 is the B³ elif and does not write).
- In scope for B³ (already shipped): **3** (entries 2, 6, 7 — entry 2 included for completeness).
- In scope for B³.5 (must close, already known): **1** (entry 1, line 6334).
- Out of scope, currently safe: **0**.
- **Latent split-authority bugs: 3** (entries 3, 4, 5 — IMMINENT/HIGH/MEDIUM upgrade branches at lines 6568/6572/6576).
  - **Of those 3, entry 3 (IMMINENT branch, line 6568) is a LIVE LEAK VECTOR reachable in production today** via the score-only IMMINENT path corrected in §3.1. The "Latent split-authority bug" classification is preserved per the brief's vocabulary, but operationally entry 3 sits at the same severity tier as entry 1 (line 6334) — both produce the user-facing overlay leak the original Round-10 bug demonstrated, both reachable on real messages.
  - Entries 4 and 5 (HIGH and MEDIUM branches) remain latent in the strict sense — write site is not reconciler-aware, but downstream gates (RED-only overlay, Phase B² alert gate) prevent user-visible regression today. These would surface if a future change weakened either downstream gate.

**Per §5 of the brief: latent-bug count > 0, and one of them is a live leak vector — audit is stopping here for Andrew/Anthony review before B³.5 is scoped.** Anthony's scoping decision now has the full leak surface in front of it; in particular, the question of whether B³.5 closes line 6334 + line 6568 together (both live overlay-leak paths) or splits them is on the table.

---

## §5 — Open Questions / Uncertainty

1. **(Resolved by Andrew's pre-design check, 2026-05-04.)** Prior version of this audit cited a non-existent invariant in `unified_safety.py:288–290` to justify entry 3 as latent-by-coincidence. Andrew flagged the factual error during pre-design review; the score-only IMMINENT path at `unified_safety.py:291–292` makes entry 3 a live leak vector, not a future-proof concern. §3.1 has been rewritten with the correct leak path; this open question is closed and recorded for audit-trail purposes.

2. **B³.5 scope decision is now wider than the original brief assumed.** With entry 3 elevated from latent to live leak vector, B³.5 has **two** live overlay-leak vectors to close:
   - Entry 1 (`server.py:6334`, the initial assignment from `check_safeguarding()`).
   - Entry 3 (`server.py:6568`, the IMMINENT upgrade branch, reachable via score-only IMMINENT + DEFAULT precedence rule).
   Plus two genuinely latent bugs (entries 4 and 5, HIGH and MEDIUM branches).

   Three structural options for Anthony to choose between, listed neutrally without recommendation per the brief's "no fix proposals" constraint:
   - **Option α — Surgical B³.5, line 6334 only.** Closes one of the two live vectors. Entry 3 is left for B³.6. S009 retest may pass (depending on which path the production fixture exercises) but the broader leak surface remains. Adheres most strictly to the original B³.5 framing.
   - **Option β — Combined B³.5, lines 6334 + 6568 + 6572 + 6576 (one generalised reconciler-suppress elif).** Closes both live vectors and both remaining latents in one PR. The architectural twin of B³ — same shape, broader scope. Largest single safety-layer PR in Round 10.
   - **Option γ — Two-PR sequence, B³.5 closes line 6334 + entry 3 (both live), B³.6 closes entries 4 and 5 (latent).** Splits live-vs-latent rather than per-write-site. Each PR stays narrow but carries enough scope to cleanly close a distinct severity tier.

3. **Production fixture S009_B specifically — does it exercise entry 3?** The original Round-10 S009_B fixture is keyword-driven (`"lost my brother to an overdose"`), which produces `keyword.failsafe=True` → `CONTEXT_OVERRIDE` → caught by the B³ elif. So the existing failing end-to-end test (`test_phase_b3_context_override_suppresses_overlay_upgrade`) exercises entry 1 (line 6334), NOT entry 3. A separate fixture would be needed to exercise entry 3 — a moderate-signal cross-layer message that crosses `UNIFIED_THRESHOLD_IMMINENT` without any single failsafe trigger firing AND without keyword.failsafe=True. Anthony may want a B³.5 retest fixture that covers entry 3 specifically; flagging as a follow-up consideration, not a fix proposal.

4. **No genuinely ambiguous classifications were left unresolved.** Each entry was placed using the criterion in §2. The latent-vs-out-of-scope-currently-safe decision for IMMINENT/HIGH/MEDIUM is articulated explicitly in §3.

---

## §6 — Methodology Notes

- Grep was scoped to `buddy_chat()` only (lines 6161–7069); the audit window 6320–7028 sits entirely inside that function. Confirmed via `grep -n "^async def buddy_chat\|^@api_router" server.py`. No other function's writes are in scope.
- Helper-function inspection: no helper called between 6320 and 7028 takes `risk_level` and returns a modified version that gets reassigned to the local. (`check_safeguarding()` returns a `risk_data` dict from which `risk_level` is read at line 6334; that's entry 1.) Strings are immutable in Python, so no by-reference mutation is possible — the only way `risk_level` can change is via direct rebinding at one of the 6 sites in the inventory.
- Constructor-kwarg uses (`risk_level=...` as a keyword arg into `SafeguardingAlert(...)` at lines 6465, 6987 and into `BuddyChatResponse(...)` at line 7016, plus `risk_level="RED"` into `audit_safeguarding_alert(...)` at line 6493) were excluded as not-writes-to-the-local-variable per §3.1.
- Writes to `db_risk_level` (lines 6967, 6971) are writes to a different local introduced by Phase B² and are out of scope for this audit (§3.1: only writes to `risk_level` itself).
- Line numbers are post-PR #9 merge state. They may shift by 1–2 lines if WatchFiles auto-reload reformats anything; the snippets are the authoritative anchors.
- Per §1 of the brief, this audit was preceded by a deliberate enumeration of `precedence_rule_fired` values and which produce `failsafe_should_fire == False` (see §0 above). That enumeration drives the latent-bug findings rather than living implicitly inside any single table entry.
