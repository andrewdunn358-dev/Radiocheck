// #144 client contract: the chat clients never show generic reassurance or a
// retry-only message when /api/ai-buddies/chat fails. They show the approved
// crisis-support wording. Successful replies are unchanged.
//
//   node --experimental-strip-types --test frontend/tests/chatReply.test.mjs
//   (Node >= 22.6; type stripping is on by default from Node 22.18)
//
// The Expo app has no test runner; the logic is a pure module shared by
// app/chat/[characterId].tsx and app/grace-welcome.tsx, tested here with real
// fetch() calls against a local HTTP server that reproduces each failure, plus
// source checks that both screens use it. The portal has its own copy and test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readChatReply, chatFailureReply, CRISIS_SUPPORT_FALLBACK } from '../src/utils/chatReply.ts';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const NORMAL = { reply: 'Alright mate, how was the allotment?', sessionId: 's', character: 'tommy',
  characterName: 'Tommy', characterAvatar: '/images/tommy.png', safeguardingTriggered: false,
  safeguardingAlertId: null, riskLevel: 'GREEN', riskScore: 0 };
const CRISIS = { ...NORMAL, reply: 'Right. I\'m not going to leave you with that... Samaritans: 116 123 ... 999',
  safeguardingTriggered: true, safeguardingAlertId: 'alert-1', riskLevel: 'RED', riskScore: 95 };
const OUTAGE = { ...NORMAL, reply: CRISIS_SUPPORT_FALLBACK, riskLevel: 'UNKNOWN', outageReason: 'site_settings_timeout' };

// Each route reproduces one server behaviour.
const ROUTES = {
  '/normal': [200, 'application/json', JSON.stringify(NORMAL)],
  '/crisis': [200, 'application/json', JSON.stringify(CRISIS)],
  '/outage-holding': [200, 'application/json', JSON.stringify(OUTAGE)],
  '/500-text': [500, 'text/plain; charset=utf-8', 'Internal Server Error'],
  '/503-json': [503, 'application/json', JSON.stringify({ detail: 'AI Battle Buddies are currently unavailable - API key not configured' })],
  '/429-json': [429, 'application/json', JSON.stringify({ detail: 'Too many requests. Please wait a few minutes.' })],
  '/502-html': [502, 'text/html', '<html><body>Bad Gateway</body></html>'],
  '/200-not-json': [200, 'application/json', '{"reply": "trunc'],
  '/200-missing-reply': [200, 'application/json', JSON.stringify({ ...NORMAL, reply: undefined })],
  '/200-empty-reply': [200, 'application/json', JSON.stringify({ ...NORMAL, reply: '   ' })],
  '/200-null-reply': [200, 'application/json', JSON.stringify({ ...NORMAL, reply: null })],
  '/200-number-reply': [200, 'application/json', JSON.stringify({ ...NORMAL, reply: 42 })],
  '/200-array': [200, 'application/json', '[]'],
  '/200-null': [200, 'application/json', 'null'],
};

let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    const r = ROUTES[req.url];
    if (!r) { res.writeHead(404); return res.end(); }
    res.writeHead(r[0], { 'content-type': r[1] });
    res.end(r[2]);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// The exact flow both app screens now use.
async function clientFlow(url) {
  try {
    const response = await fetch(url, { method: 'POST', body: '{}' });
    const { data, reply } = await readChatReply(response);
    return { reply, modal: !!data?.safeguardingTriggered, alertId: data?.safeguardingAlertId ?? null };
  } catch {
    return { reply: chatFailureReply(), modal: false, alertId: null };
  }
}

test('wording is the approved F2 holding response (Samaritans 116 123, 999)', () => {
  assert.match(CRISIS_SUPPORT_FALLBACK, /Samaritans free on 116 123/);
  assert.match(CRISIS_SUPPORT_FALLBACK, /call 999\.$/);
  assert.equal(chatFailureReply(), CRISIS_SUPPORT_FALLBACK);
});

test('normal reply is shown unchanged, no modal', async () => {
  assert.deepEqual(await clientFlow(`${base}/normal`), { reply: NORMAL.reply, modal: false, alertId: null });
});

test('crisis reply unchanged and the safeguarding modal still opens', async () => {
  assert.deepEqual(await clientFlow(`${base}/crisis`), { reply: CRISIS.reply, modal: true, alertId: 'alert-1' });
});

test('server outage holding response is shown as sent', async () => {
  const r = await clientFlow(`${base}/outage-holding`);
  assert.equal(r.reply, CRISIS_SUPPORT_FALLBACK);
  assert.equal(r.modal, false);
});

for (const path of ['/500-text', '/503-json', '/429-json', '/502-html', '/200-not-json',
  '/200-missing-reply', '/200-empty-reply', '/200-null-reply', '/200-number-reply', '/200-array', '/200-null']) {
  test(`failure ${path} shows the crisis-support wording`, async () => {
    const r = await clientFlow(`${base}${path}`);
    assert.equal(r.reply, CRISIS_SUPPORT_FALLBACK);
    assert.equal(r.modal, false);
  });
}

test('network failure (connection refused) shows the crisis-support wording', async () => {
  const r = await clientFlow('http://127.0.0.1:1/api/ai-buddies/chat');
  assert.equal(r.reply, CRISIS_SUPPORT_FALLBACK);
});

test('readChatReply never throws, even on a broken response object', async () => {
  for (const bad of [null, undefined, {}, { ok: true, json: () => { throw new Error('x'); } },
    { ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } }]) {
    assert.equal((await readChatReply(bad)).reply, CRISIS_SUPPORT_FALLBACK);
  }
});

test('a modal-bearing body keeps its modal even if its reply is unusable', async () => {
  const r = await readChatReply({ ok: true, json: async () => ({ safeguardingTriggered: true, safeguardingAlertId: 'a', reply: '' }) });
  assert.equal(r.reply, CRISIS_SUPPORT_FALLBACK);
  assert.equal(r.data.safeguardingTriggered, true, 'existing safeguarding handling still sees the flag');
});

// Wiring: both app screens use the module; the old generic fallbacks are gone.
for (const [file, oldTexts] of [
  ['../app/chat/[characterId].tsx', ["I'm here for you. Sometimes it helps to just talk.",
    "I'm having trouble connecting right now. Please try again in a moment."]],
  ['../app/grace-welcome.tsx', ["I'm here. Take your time.",
    "Sorry, I'm having a bit of trouble right now. Try again in a moment."]],
]) {
  test(`${file} uses readChatReply and has no generic fallback`, () => {
    const src = readFileSync(here(file), 'utf8');
    assert.match(src, /import \{ readChatReply, chatFailureReply \} from '\.\.\/(\.\.\/)?src\/utils\/chatReply';/);
    assert.match(src, /await readChatReply\((response|resp)\)/);
    assert.match(src, /chatFailureReply\(\)/);
    for (const t of oldTexts) assert.ok(!src.includes(t), `old text still present: ${t}`);
    const chatCall = src.slice(src.indexOf('/api/ai-buddies/chat'));
    assert.ok(!/\b(response|resp)\.json\(\)/.test(chatCall.slice(0, 1200)), 'chat response parsed only via readChatReply');
  });
}

test('the app and portal copies of the module are identical', () => {
  assert.equal(readFileSync(here('../src/utils/chatReply.ts'), 'utf8'),
    readFileSync(here('../../portal/src/lib/chatReply.ts'), 'utf8'));
});
