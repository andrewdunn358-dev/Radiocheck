/**
 * Staff portal panic button -> POST /api/panic-alert (server.py, inline route).
 *
 * Why this endpoint: it is the established panic-alert contract. It is the
 * route that persists the alert AND emails every counsellor, supervisor and
 * admin (send_panic_alert_to_counsellors), records user-initiated provenance,
 * and it is the route the app's peer portal (frontend/app/peer-portal.tsx) and
 * the staff AlertsTab (staffApi.triggerPanic) already call. Its input model,
 * server.py PanicAlertCreate, accepts user_name, user_phone, location and
 * message, all optional.
 *
 * Until 29 September 2026 the staff page posted staff_id/staff_name/reason/
 * location/risk_level to /api/safeguarding/panic-alert instead: the router
 * stub whose schema requires user_id (models/schemas.py) and which carries
 * "TODO: Send notifications to staff". Every press was rejected with 422, and
 * because the page never looked at the response it told the user the alert had
 * been sent.
 *
 * The rule enforced here: report success ONLY when the backend accepted AND
 * persisted the alert. The inline route returns 2xx with the alert's `id` only
 * after insert_one has succeeded; any failure is a 500. So success requires
 * response.ok and an `id` in the body. Everything else, including a network
 * error, is a failure.
 */

export const STAFF_PANIC_PATH = '/api/panic-alert';
export const DEFAULT_STAFF_PANIC_MESSAGE = 'Staff member triggered panic button';

export interface StaffPanicUser {
  name?: string | null;
  email?: string | null;
}

export interface StaffPanicRequest {
  url: string;
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  };
}

type FetchLike = (url: string, init: StaffPanicRequest['init']) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export function buildStaffPanicRequest(
  apiUrl: string,
  token: string,
  user: StaffPanicUser | null | undefined,
  reason: string,
): StaffPanicRequest {
  // Field names are server.py PanicAlertCreate's. Undefined values are dropped
  // by JSON.stringify, which the model accepts (every field is optional).
  const payload = {
    user_name: user?.name || user?.email || undefined,
    location: 'staff_portal',
    message: (reason || '').trim() || DEFAULT_STAFF_PANIC_MESSAGE,
  };
  return {
    url: `${apiUrl}${STAFF_PANIC_PATH}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    },
  };
}

/** Returns true only if the backend accepted and persisted the alert. */
export async function submitStaffPanicAlert(
  apiUrl: string,
  token: string,
  user: StaffPanicUser | null | undefined,
  reason: string,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<boolean> {
  const { url, init } = buildStaffPanicRequest(apiUrl, token, user, reason);
  try {
    const response = await fetchImpl(url, init);
    if (!response.ok) return false;
    const data = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return typeof data?.id === 'string' && data.id.length > 0;
  } catch {
    return false;
  }
}
