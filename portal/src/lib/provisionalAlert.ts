// F2 (Ant, 20 Oct 2026, items 1 and 2): alerts raised on an INCOMPLETE safety
// evaluation carry the existing "evaluation_incomplete" indicator. Staff must
// never mistake one for a completed RED assessment, and an unavailable score
// must be shown as unavailable, never as 0.
//
// One implementation used by every staff view (Alerts tab, Dashboard, Admin
// safeguarding log). Pinned by portal/tests/provisionalAlert.test.mjs.
// Presentation only: no new alert classification.

export const PROVISIONAL_LABEL = 'PROVISIONAL — EVALUATION INCOMPLETE';
export const SCORE_NOT_AVAILABLE = 'Risk score: not available — evaluation incomplete';

type AlertLike = {
  triggered_indicators?: string[] | null;
  risk_score?: number | null;
  risk_level?: string | null;
} | null | undefined;

const indicators = (alert: AlertLike): string[] =>
  Array.isArray(alert?.triggered_indicators) ? (alert!.triggered_indicators as string[]) : [];

export function isProvisional(alert: AlertLike): boolean {
  return indicators(alert).includes('evaluation_incomplete');
}

/** A genuine surviving score exists only when its source is recorded. */
export function hasAssessedScore(alert: AlertLike): boolean {
  const ind = indicators(alert);
  return ind.includes('risk_score_source:legacy_scorer')
    && !ind.includes('risk_score_not_available')
    && Number.isInteger(alert?.risk_score);
}

/** Full sentence for the Alerts tab and the email. */
export function provisionalScoreLine(alert: AlertLike): string {
  return hasAssessedScore(alert)
    ? `Risk score: ${alert!.risk_score} (legacy scorer only — evaluation incomplete)`
    : SCORE_NOT_AVAILABLE;
}

/** Compact score cell for tables (Admin log). Definitive alerts unchanged. */
export function scoreCell(alert: AlertLike & { score?: number | null }): string {
  if (!isProvisional(alert)) {
    // Existing presentation, exactly as before.
    return String(alert?.risk_score || (alert as any)?.score || '-');
  }
  return hasAssessedScore(alert) ? `${alert!.risk_score} (legacy only, incomplete)` : 'not available — incomplete';
}

/** The surviving-evidence sentence shown above the trigger message. */
export function provisionalSummary(alert: AlertLike): string {
  const level = (alert?.risk_level || 'unknown').toUpperCase();
  return `Safety evaluation incomplete: part of it failed. Surviving evidence: ${level} from the legacy scorer only. `
    + `${provisionalScoreLine(alert)}. Not a completed safeguarding assessment. `
    + 'The user was shown a "something went wrong" message with Samaritans (116 123) and 999.';
}

/**
 * Safeguarding CSV export row. Definitive alerts are returned unchanged (same
 * object). A provisional alert gets an explicit evaluation_status column, and
 * an unavailable score is exported as "not available", never as 0.
 */
export function exportRow<T extends Record<string, any>>(alert: T): T | (T & { evaluation_status: string }) {
  if (!isProvisional(alert)) return alert;
  return {
    ...alert,
    evaluation_status: PROVISIONAL_LABEL,
    risk_score: hasAssessedScore(alert) ? alert.risk_score : 'not available',
  };
}
