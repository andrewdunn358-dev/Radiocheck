// Staff AlertsTab panic button (peers only): request, success reporting, wording.
//
//   node --test portal/tests/alertsTabPanic.test.mjs
//
// Before 29 Sept 2026: staffApi.triggerPanic POSTed /api/panic-alert with NO
// body -> 422 every time (the UI did report the failure), and the success text
// read "Panic alert sent! Help is on the way." Now triggerPanic delegates to
// the same submitStaffPanicAlert() the staff panic modal uses, so the request
// contract and the success rule have ONE implementation, whose behaviour is
// pinned in staffPanic.test.mjs. The backend half (this exact request is
// accepted and stored) is backend/tests/test_staff_panic_alert_contract.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildStaffPanicRequest, submitStaffPanicAlert, DEFAULT_STAFF_PANIC_MESSAGE }
  from '../src/lib/staffPanic.ts';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const API = 'https://api.example.test';
// AlertsTab passes the staff user (lib/api.ts StaffUser) and no reason.
const PEER = { id: 'peer-1', email: 'peer@radiocheck.me', name: 'A Peer', role: 'peer' };

const handlerOf = (src) => {
  const start = src.indexOf('const handleTriggerPanic');
  assert.ok(start > -1, 'handleTriggerPanic not found');
  const end = src.indexOf('\n  };', start);
  return src.slice(start, end);
};

// --- the shared helper ------------------------------------------------------

test('staffApi.triggerPanic delegates to submitStaffPanicAlert with the staff user', () => {
  const api = read('../src/lib/api.ts');
  assert.match(api, /import \{ submitStaffPanicAlert, type StaffPanicUser \} from '\.\/staffPanic';/);
  assert.match(api,
    /triggerPanic: \(token: string, user\?: StaffPanicUser \| null\): Promise<boolean> =>\s*submitStaffPanicAlert\(API_URL, token, user, ''\),/);
  assert.doesNotMatch(api, /fetchAPI<[^>]*>\('\/panic-alert'/, 'a second, body-less panic request is back');
});

test('the request AlertsTab now sends has a body the endpoint accepts', () => {
  const { url, init } = buildStaffPanicRequest(API, 'tok', PEER, '');
  assert.equal(url, `${API}/api/panic-alert`);
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), {
    user_name: 'A Peer', location: 'staff_portal', message: DEFAULT_STAFF_PANIC_MESSAGE });
});

test('the AlertsTab call shape succeeds only on 2xx with a stored id', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ id: 'a1' }) });
  const rejected = async () => ({ ok: false, json: async () => ({ detail: [] }) });
  const down = async () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await submitStaffPanicAlert(API, 'tok', PEER, '', ok), true);
  assert.equal(await submitStaffPanicAlert(API, 'tok', PEER, '', rejected), false);
  assert.equal(await submitStaffPanicAlert(API, 'tok', PEER, '', down), false);
});

// --- the AlertsTab handler ----------------------------------------------------

test('AlertsTab reports success only after triggerPanic returns true', () => {
  const h = handlerOf(read('../src/components/staff/tabs/AlertsTab.tsx'));
  assert.match(h, /const sent = await staffApi\.triggerPanic\(token, user\);/);
  const guard = h.indexOf('if (!sent)');
  const success = h.indexOf("alert('Panic alert sent.')");
  assert.ok(guard > -1 && success > guard, 'success alert is not behind the !sent guard');
  assert.match(h.slice(guard, success), /return;/, 'failure branch does not return before success');
});

test('AlertsTab wording claims only what the response proves', () => {
  // Code only: comments explaining the rule are not user-facing text.
  const h = handlerOf(read('../src/components/staff/tabs/AlertsTab.tsx'))
    .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const successMessages = [...h.matchAll(/alert\('([^']*)'\)/g)]
    .map((m) => m[1])
    .filter((text) => !text.startsWith('Failed'));
  assert.deepEqual(successMessages, ['Panic alert sent.']);
  // Covers the confirm() prompt too, which used to promise "This will notify all
  // supervisors and counsellors immediately."
  assert.doesNotMatch(h, /notif|will be|on (its|the) way|help is|counsellor|supervisor/i,
    'the panic control makes a notification/help claim the response does not prove');
});
