// Staff portal panic button: request contract and success reporting.
//
//   node --test portal/tests/            (Node >= 22.6: strips the .ts types natively)
//
// The rule under test: the panic control must not tell a user an alert was sent
// unless the backend accepted AND persisted it. The backend half of the contract
// (the payload built here is accepted and stored by POST /api/panic-alert) is in
// backend/tests/test_staff_panic_alert_contract.py, which drives this same module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildStaffPanicRequest,
  submitStaffPanicAlert,
  STAFF_PANIC_PATH,
  DEFAULT_STAFF_PANIC_MESSAGE,
} from '../src/lib/staffPanic.ts';

const API = 'https://api.example.test';
const USER = { id: 'staff-1', name: 'A Peer', email: 'peer@radiocheck.me' };

// server.py PanicAlertCreate — the only fields the inline route accepts.
const SERVER_FIELDS = new Set(['user_name', 'user_phone', 'location', 'message']);

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  json: async () => {
    if (body instanceof Error) throw body;
    return body;
  },
});

function recordingFetch(result) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (result instanceof Error) throw result;
    return result;
  };
  return { impl, calls };
}

// --- request contract ---------------------------------------------------------

test('targets the inline panic route, not the router stub', () => {
  const { url } = buildStaffPanicRequest(API, 'tok', USER, 'help');
  assert.equal(STAFF_PANIC_PATH, '/api/panic-alert');
  assert.equal(url, `${API}/api/panic-alert`);
  assert.ok(!url.includes('/safeguarding/'), url);
});

test('sends only fields server.py PanicAlertCreate accepts', () => {
  const body = JSON.parse(buildStaffPanicRequest(API, 'tok', USER, 'help').init.body);
  for (const key of Object.keys(body)) assert.ok(SERVER_FIELDS.has(key), `unexpected field ${key}`);
  assert.deepEqual(body, { user_name: 'A Peer', location: 'staff_portal', message: 'help' });
});

test('falls back to email for the name and to the default message', () => {
  const body = JSON.parse(
    buildStaffPanicRequest(API, 'tok', { email: 'peer@radiocheck.me' }, '   ').init.body);
  assert.equal(body.user_name, 'peer@radiocheck.me');
  assert.equal(body.message, DEFAULT_STAFF_PANIC_MESSAGE);
});

test('is a JSON POST carrying the staff token', () => {
  const { init } = buildStaffPanicRequest(API, 'tok', USER, 'help');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.headers.Authorization, 'Bearer tok');
});

// --- success only after backend success ----------------------------------------

test('reports success when the backend accepted and returned the stored id', async () => {
  const f = recordingFetch(response(200, { id: 'a1b2', message: 'Alert sent.' }));
  assert.equal(await submitStaffPanicAlert(API, 'tok', USER, 'help', f.impl), true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `${API}/api/panic-alert`);
});

for (const [label, result] of [
  ['422 validation rejection (the shipped defect)', response(422, { detail: [{ msg: 'Field required' }] })],
  ['500 persistence failure', response(500, { detail: 'Alert system error.' })],
  ['401 refusal', response(401, { detail: 'Not authenticated' })],
  ['2xx without an alert id', response(200, { message: 'ok' })],
  ['2xx with an unreadable body', response(200, new SyntaxError('Unexpected token <'))],
  ['network failure', new TypeError('Failed to fetch')],
]) {
  test(`never reports success on ${label}`, async () => {
    const f = recordingFetch(result);
    assert.equal(await submitStaffPanicAlert(API, 'tok', USER, 'help', f.impl), false);
  });
}

// --- the page is wired to it ----------------------------------------------------

test('the staff page uses this module and shows success only after it returns true', () => {
  const page = readFileSync(
    fileURLToPath(new URL('../src/app/staff/page.tsx', import.meta.url)), 'utf8');
  const handler = page.slice(page.indexOf('const triggerPanicAlert'), page.indexOf('// Loading state'));
  assert.ok(handler.length > 0, 'triggerPanicAlert not found');
  assert.ok(!page.includes('/api/safeguarding/panic-alert'), 'page still posts to the router stub');
  assert.match(handler, /const sent = await submitStaffPanicAlert\(/);
  const guard = handler.indexOf('if (!sent)');
  const success = handler.indexOf("alert('Panic alert sent.')");
  assert.ok(guard > -1 && success > guard, 'success alert is not behind the !sent guard');
  assert.match(handler.slice(guard, success), /return;/, 'failure branch does not return before success');
});

test('the success message claims only what the response proves', () => {
  // submitStaffPanicAlert() establishes accepted + persisted, nothing more.
  // /api/panic-alert ignores send_panic_alert_to_counsellors()'s result, so a
  // 200 + id does NOT prove anyone was notified. The success wording must not
  // say otherwise.
  const page = readFileSync(
    fileURLToPath(new URL('../src/app/staff/page.tsx', import.meta.url)), 'utf8');
  const handler = page.slice(page.indexOf('const triggerPanicAlert'), page.indexOf('// Loading state'));
  const successMessages = [...handler.matchAll(/alert\('([^']*)'\)/g)]
    .map((m) => m[1])
    .filter((text) => !text.startsWith('Failed'));
  assert.deepEqual(successMessages, ['Panic alert sent.']);
  assert.doesNotMatch(handler, /notif|will be|on (its|the) way|counsellor/i,
    'the handler makes a delivery/notification claim the response does not prove');
});
