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
| 3 | 6568 | `risk_level = "RED"` (also sets `should_escalate = True`) | `elif unified_risk == "IMMINENT" and risk_level != "RED":`. Runs after the negation/identity/B³ elifs (6542, 6548, 6555) have all been evaluated. | **Latent split-authority bug** (see §3) | Not gated by `failsafe_should_fire`. Currently *appears* safe only because of an upstream invariant in `safety/unified_safety.py` (see Latent Bugs §3.1) — that invariant is in a separate file with no test asserting it, and the B³.5 audit is meant to flag exactly this kind of reliance-by-coincidence. |
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

**Why it appears not to fire today (read carefully — this is the part the audit is meant to catch):**

By the upstream invariant in `backend/safety/unified_safety.py:288–290`, `unified_result["risk_level"] == "IMMINENT"` requires `unified_result["failsafe_triggered"] == True`. That invariant is then propagated by `extract_verdicts_from_unified()` (`reconciler.py:557, 564–568`), which copies `unified.failsafe_triggered` to `keyword.failsafe_triggered` verbatim. With `keyword.failsafe_triggered == True`, the reconciler can only return one of: `CONTEXT_OVERRIDE` (caught by B³ elif), `KEYWORD_FAILSAFE` (failsafe=True, B³ elif doesn't apply but `failsafe_should_fire=True` so the upgrade branch is harmless because `risk_level != "RED"` may already be False), or `CLASSIFIER_UNAVAILABLE`-with-`keyword.failsafe=True` (failsafe=True, same as KEYWORD_FAILSAFE).

**Why it is still latent split-authority:**

1. The "safety" of this branch depends on a cross-file invariant — `unified.risk_level == "IMMINENT" ⟺ unified.failsafe_triggered == True` — that lives in `safety/unified_safety.py`, has no test asserting it, and is not documented as a contract that callers can rely on.
2. The negation/identity-guard adjustments at `server.py:6399–6445` can flip `failsafe_should_fire` from True → False *without* mutating `unified_safety["risk_level"]`. So under `KEYWORD_FAILSAFE + identity_active + unified_risk == "IMMINENT"`, the `identity_active` elif at line 6548 does NOT fire (its guard is `unified_risk not in ["IMMINENT"]`), the B³ elif at 6555 does NOT fire (rule isn't CONTEXT_OVERRIDE), and execution reaches line 6567 with `failsafe_should_fire == False AND unified_risk == "IMMINENT"`. The `risk_level != "RED"` half of the guard determines whether the write actually executes — and `risk_level` at this point is whatever line 6334 set it to from `check_safeguarding()`. If `check_safeguarding()` returned anything other than RED, this branch DOES fire and the overlay leaks.
3. Therefore: a future refactor of `unified_safety.py` (or a new condition that flips `failsafe_should_fire` without flipping `unified["risk_level"]`) silently re-opens the same overlay leak the original Round-10 bug demonstrated. There is no test gating this assumption.

**Minimum gate that would close it (description only, no code per §5):** add `failsafe_should_fire and ` to the surrounding condition, or add a sibling elif that suppresses the upgrade when `not failsafe_should_fire` regardless of precedence rule (i.e. the same shape as the B³ elif but generalised away from `precedence_rule_fired == "CONTEXT_OVERRIDE"` specifically).

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

**Per §5 of the brief: this latent-bug count > 0, so audit is stopping here for Andrew/Anthony review before B³.5 is scoped.** Anthony's scoping decision now has the full leak surface in front of it, not just the line-6334 vector.

---

## §5 — Open Questions / Uncertainty

1. **Is the cross-file invariant in §3.1 considered a contract?** I.e. is `unified_safety.py:288–290` (`final_risk_level == "IMMINENT" ⟺ failsafe_triggered`) something the project commits to as an enduring property, or an implementation detail of the current `analyze_message_unified()`? If it's a documented contract with a regression test asserting it, §3.1 could be downgraded from "Latent split-authority bug" to "Out of scope, currently safe" with the contract as the gating mechanism. If it's not, the latent-bug classification stands. Cannot resolve from inside this audit; needs Anthony's scoping intent.

2. **B³.5 scope decision: surgical (line 6334 only) vs broad (line 6334 + IMMINENT/HIGH/MEDIUM branches).** The brief's §6.3 says "Anthony scopes Phase B³.5 from the audit findings. If the audit shows only line 6334 as a leak vector (plus latent bugs of zero), B³.5 stays narrow as planned. If latent bugs are found, scope expands and Anthony decides whether to bundle into B³.5 or split further." Three latent bugs are found, so this is now Anthony's call. The architectural twin of B³ (one generalised reconciler-suppress elif above the IMMINENT/HIGH/MEDIUM chain) would close all three latent bugs in one stroke and leave the line-6334 vector as a separately-shaped fix; alternatively, line 6334 can be closed first and the upgrade-block latents addressed in B³.6.

3. **No genuinely ambiguous classifications were left unresolved.** Each entry was placed using the criterion in §2. The latent-vs-out-of-scope-currently-safe decision for IMMINENT/HIGH/MEDIUM is articulated explicitly in §3 rather than guessed.

---

## §6 — Methodology Notes

- Grep was scoped to `buddy_chat()` only (lines 6161–7069); the audit window 6320–7028 sits entirely inside that function. Confirmed via `grep -n "^async def buddy_chat\|^@api_router" server.py`. No other function's writes are in scope.
- Helper-function inspection: no helper called between 6320 and 7028 takes `risk_level` and returns a modified version that gets reassigned to the local. (`check_safeguarding()` returns a `risk_data` dict from which `risk_level` is read at line 6334; that's entry 1.) Strings are immutable in Python, so no by-reference mutation is possible — the only way `risk_level` can change is via direct rebinding at one of the 6 sites in the inventory.
- Constructor-kwarg uses (`risk_level=...` as a keyword arg into `SafeguardingAlert(...)` at lines 6465, 6987 and into `BuddyChatResponse(...)` at line 7016, plus `risk_level="RED"` into `audit_safeguarding_alert(...)` at line 6493) were excluded as not-writes-to-the-local-variable per §3.1.
- Writes to `db_risk_level` (lines 6967, 6971) are writes to a different local introduced by Phase B² and are out of scope for this audit (§3.1: only writes to `risk_level` itself).
- Line numbers are post-PR #9 merge state. They may shift by 1–2 lines if WatchFiles auto-reload reformats anything; the snippets are the authoritative anchors.
- Per §1 of the brief, this audit was preceded by a deliberate enumeration of `precedence_rule_fired` values and which produce `failsafe_should_fire == False` (see §0 above). That enumeration drives the latent-bug findings rather than living implicitly inside any single table entry.
