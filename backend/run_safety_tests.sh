#!/usr/bin/env bash
# Offline safety suite — every safety test that runs without a live server.
cd "$(dirname "$0")"
python -m pytest \
  tests/test_age_gate_screen_consistency.py \
  tests/test_decision_provenance.py \
  tests/test_differential_harness.py \
  tests/test_fallback_validation.py \
  tests/test_grief_gate_person_reference.py \
  tests/test_grief_gate_two_tier.py \
  tests/test_grief_state_cleardown.py \
  tests/test_judge_prompt_single_source.py \
  tests/test_means_detector.py \
  tests/test_micro_fallback_refusal.py \
  tests/test_negation_mood_phrases.py \
  tests/test_negation_word_boundary.py \
  tests/test_privacy_protocol_wording.py \
  tests/test_round10_phase_c_gates.py \
  tests/test_round9_items3_4_5_signals_judge.py \
  tests/test_under18_thresholds.py \
  tests/test_unified_safeguarding.py \
  tests/test_critical_keyword_coverage.py \
  tests/test_overdose_bereavement_word_boundary.py \
  -q "$@" 2>&1 | tail -3
