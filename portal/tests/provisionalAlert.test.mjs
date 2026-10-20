// F2 provisional alerts in every staff view (Ant, 20 Oct 2026, items 1 and 2).
//
//   node --test portal/tests/provisionalAlert.test.mjs
//
// An alert raised on an INCOMPLETE safety evaluation carries the existing
// "evaluation_incomplete" indicator. Staff must see it labelled EVALUATION
// INCOMPLETE wherever they meet it, an unavailable score must read as
// unavailable (never 0), and definitive alerts keep their existing look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isProvisional, hasAssessedScore, provisionalScoreLine, scoreCell, provisionalSummary, exportRow,
  PROVISIONAL_LABEL, SCORE_NOT_AVAILABLE,
} from '../src/lib/provisionalAlert.ts';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const DEFINITIVE = { risk_level: 'RED', risk_score: 95, triggered_indicators: ['explicit_intent'] };
const PROV_SCORED = {
  risk_level: 'RED', risk_score: 120,
  triggered_indicators: ['evaluation_incomplete', 'provisional_alert', 'risk_score_source:legacy_scorer',
    'failed_component:analyze_message_unified'],
};
const PROV_NO_SCORE = {
  risk_level: 'RED', risk_score: 0,
  triggered_indicators: ['evaluation_incomplete', 'provisional_alert', 'risk_score_not_available',
    'failed_component:analyze_message_unified'],
};

test('provisional alerts are recognised from the existing indicator only', () => {
  assert.equal(isProvisional(PROV_SCORED), true);
  assert.equal(isProvisional(PROV_NO_SCORE), true);
  assert.equal(isProvisional(DEFINITIVE), false);
  assert.equal(isProvisional({}), false);
  assert.equal(isProvisional(null), false);
  assert.equal(isProvisional({ triggered_indicators: null }), false);
});

test('an unavailable score is never shown as 0', () => {
  assert.equal(hasAssessedScore(PROV_NO_SCORE), false);
  assert.equal(provisionalScoreLine(PROV_NO_SCORE), 'Risk score: not available — evaluation incomplete');
  assert.equal(provisionalScoreLine(PROV_NO_SCORE), SCORE_NOT_AVAILABLE);
  assert.equal(scoreCell(PROV_NO_SCORE), 'not available — incomplete');
  assert.doesNotMatch(provisionalSummary(PROV_NO_SCORE), /score: 0\b/i);
});

test('a genuine surviving score is shown with its source and incomplete status', () => {
  assert.equal(provisionalScoreLine(PROV_SCORED), 'Risk score: 120 (legacy scorer only — evaluation incomplete)');
  assert.equal(scoreCell(PROV_SCORED), '120 (legacy only, incomplete)');
  assert.match(provisionalSummary(PROV_SCORED), /Not a completed safeguarding assessment/);
});

test('definitive alerts keep their existing score cell', () => {
  assert.equal(scoreCell(DEFINITIVE), '95');
  assert.equal(scoreCell({ risk_level: 'AMBER' }), '-');
  assert.equal(scoreCell({ score: 40 }), '40');
});

test('label text', () => {
  assert.equal(PROVISIONAL_LABEL, 'PROVISIONAL — EVALUATION INCOMPLETE');
});

// --- the three staff views use the shared helper -----------------------------

test('Alerts tab: provisional badge replaces "RED RISK"; summary box shown; definitive badge unchanged', () => {
  const src = read('../src/components/staff/tabs/AlertsTab.tsx');
  assert.match(src, /from '@\/lib\/provisionalAlert'/);
  assert.match(src, /isProvisional\(alert\) \? \(\s*<span data-testid="provisional-badge"[^>]*>\s*\{PROVISIONAL_LABEL\}/);
  assert.match(src, /\{\(alert\.risk_level \|\| 'UNKNOWN'\)\.toUpperCase\(\)\} RISK/, 'definitive badge text unchanged');
  assert.match(src, /data-testid="provisional-summary"[^>]*>\s*\{provisionalSummary\(alert\)\}/);
});

test('Dashboard: provisional badge replaces the bare risk level', () => {
  const src = read('../src/components/staff/tabs/DashboardTab.tsx');
  assert.match(src, /from '@\/lib\/provisionalAlert'/);
  assert.match(src, /isProvisional\(alert\) \? \(\s*<span data-testid="provisional-badge"[^>]*>PROVISIONAL — EVALUATION INCOMPLETE<\/span>/);
  assert.match(src, /\{alert\.risk_level\.toUpperCase\(\)\}/, 'definitive badge unchanged');
});

test('Admin safeguarding log: provisional badge and score cell', () => {
  const src = read('../src/components/admin/tabs/LogsTab/SafeguardingSubTab.tsx');
  assert.match(src, /from '@\/lib\/provisionalAlert'/);
  assert.match(src, /isProvisional\(alert\) && \(\s*<span data-testid="provisional-badge"[^>]*>PROVISIONAL — EVALUATION INCOMPLETE<\/span>/);
  assert.match(src, /\{scoreCell\(alert\)\}/);
  assert.doesNotMatch(src, /\{alert\.risk_score \|\| alert\.score \|\| '-'\}/, 'raw score cell replaced by scoreCell');
});

test('Admin detail modal: provisional badge and score cell', () => {
  const src = read('../src/components/admin/tabs/LogsTab/SafeguardingSubTab.tsx');
  assert.match(src, /isProvisional\(selectedSafeguardingAlert\) && \(\s*<span data-testid="provisional-detail-badge"/);
  assert.match(src, /\{scoreCell\(selectedSafeguardingAlert\)\}/);
  assert.doesNotMatch(src, /selectedSafeguardingAlert\.risk_score \|\| selectedSafeguardingAlert\.score/);
});

test('CSV export: provisional rows marked, unavailable score not exported as 0, definitive rows untouched', () => {
  assert.equal(exportRow(DEFINITIVE), DEFINITIVE, 'same object for definitive alerts');
  const noScore = exportRow(PROV_NO_SCORE);
  assert.equal(noScore.evaluation_status, PROVISIONAL_LABEL);
  assert.equal(noScore.risk_score, 'not available');
  const scored = exportRow(PROV_SCORED);
  assert.equal(scored.risk_score, 120);
  assert.equal(scored.evaluation_status, PROVISIONAL_LABEL);
  const src = read('../src/components/admin/tabs/LogsTab/index.tsx');
  assert.match(src, /data = safeguardingAlerts\.map\(exportRow\);/);
});
