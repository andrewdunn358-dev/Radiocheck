// #144 client contract: the chat clients never show generic reassurance or a
// retry-only message when /api/ai-buddies/chat fails. They show the approved
// crisis-support wording. Successful replies are unchanged.
//
//   node --experimental-strip-types --test portal/tests/chatReply.test.mjs
//   (Node >= 22.6; type stripping is on by default from Node 22.18)
//
// Portal copy: src/lib/chatReply.ts, used by src/app/police/page.tsx. Tested
// with real fetch() calls against a local HTTP server that reproduces each
// failure, plus a source check that the police chat uses it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readChatReply, chatFailureReply, CRISIS_SUPPORT_FALLBACK } from '../src/lib/chatReply.ts';

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

// The exact flow the police chat now uses.
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

// Wiring: the police chat uses the module; the old generic fallbacks are gone.
test('src/app/police/page.tsx uses readChatReply and has no generic fallback', () => {
  const src = readFileSync(here('../src/app/police/page.tsx'), 'utf8');
  assert.match(src, /import \{ readChatReply, chatFailureReply(, contextEligibleHistory)? \} from '@\/lib\/chatReply';/);
  assert.match(src, /await readChatReply\(res\)/);
  assert.match(src, /chatFailureReply\(\)/);
  for (const t of ["'Sorry, something went wrong.'", "'Connection error. Please try again.'"]) {
    assert.ok(!src.includes(t), `old text still present: ${t}`);
  }
  const chatCall = src.slice(src.indexOf('/api/ai-buddies/chat'));
  assert.ok(!/\bres\.json\(\)/.test(chatCall.slice(0, 1200)), 'chat response parsed only via readChatReply');
});

test('the app and portal copies of the module are identical', () => {
  assert.equal(readFileSync(here('../src/lib/chatReply.ts'), 'utf8'),
    readFileSync(here('../../frontend/src/utils/chatReply.ts'), 'utf8'));
});

// ---------------------------------------------------------------------------
// #144 correction (Ant, 23 Oct 2026): the crisis-support fallback stays visible
// and stored, but unsuccessful / unassessed assistant replies never enter the
// conversation_context sent back to /api/ai-buddies/chat. These tests run the
// REAL buildConversationContext from src/app/police/page.tsx (its body is
// extracted from the source and executed), not a copy of it.
// ---------------------------------------------------------------------------
import { contextEligibleHistory, isUnassessedAssistantReply } from '../src/lib/chatReply.ts';

const POLICE_SRC = readFileSync(here('../src/app/police/page.tsx'), 'utf8');

function extractBody(src, signature) {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `not found: ${signature}`);
  const open = src.indexOf('{', start + signature.length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  throw new Error('unbalanced braces');
}

const MAX_CONTEXT = Number(POLICE_SRC.match(/const MAX_CONTEXT_MESSAGES = (\d+)/)[1]);
// eslint-disable-next-line no-new-func
const policeBuild = new Function('history', 'personaName', 'contextEligibleHistory', 'MAX_CONTEXT_MESSAGES',
  extractBody(POLICE_SRC, 'function buildConversationContext(history: Msg[], personaName: string): string {'));
const build = (history) => policeBuild(history, 'Sam', contextEligibleHistory, MAX_CONTEXT);

const u = (text) => ({ role: 'user', text, ts: '2026-10-23T22:00:00.000Z' });
const a = (text) => ({ role: 'assistant', text, ts: '2026-10-23T22:00:01.000Z' });
// What the pre-#144-correction builder sent: the same transcript, unfiltered.
const transcriptOf = (msgs) => msgs.map(m => `${m.role === 'user' ? 'User' : 'Sam'}: ${m.text}`).join('\n');

test('context: the crisis-support fallback is excluded, user turns and normal replies are kept', () => {
  const ctx = build([u('rough week on shift'), a('Sounds heavy, mate. What happened?'),
    u('cannot sleep after the RTC'), a(CRISIS_SUPPORT_FALLBACK)]);
  assert.ok(ctx.includes('User: rough week on shift'));
  assert.ok(ctx.includes('Sam: Sounds heavy, mate. What happened?'));
  assert.ok(ctx.includes('User: cannot sleep after the RTC'), 'the veteran\'s own words are still context');
  assert.ok(!ctx.includes(CRISIS_SUPPORT_FALLBACK), 'fallback must not reach the AI');
  assert.ok(!ctx.includes('116 123'));
});

test('context: normal history (no failures) is exactly what it was before', () => {
  const history = [u('hiya'), a('Alright. How was the shift?'), u('long'),
    a('Right. I\'m not going to leave you with that... Samaritans: 116 123 ... 999')];
  const ctx = build(history);
  assert.ok(ctx.includes(`last time:\n\n${transcriptOf(history)}\n\n`), 'transcript unchanged');
  assert.ok(ctx.startsWith('\n\n[RETURNING MATE'));
});

test('context: a real crisis reply that mentions Samaritans is NOT excluded', () => {
  const crisis = a('Right. I\'m not going to leave you with that. Samaritans free on 116 123, or 999.');
  assert.ok(build([u('x'), crisis]).includes(crisis.text));
  // A normal reply that merely starts like the fallback is kept (exact match only).
  const lookalike = a('Sorry, something went wrong with your day? Tell me about it, mate.');
  assert.ok(build([u('x'), lookalike]).includes(`Sam: ${lookalike.text}`));
});

test('context: history that is only failed turns produces no context block', () => {
  assert.equal(build([a(CRISIS_SUPPORT_FALLBACK), a(CRISIS_SUPPORT_FALLBACK)]), '');
  assert.equal(build([]), '');
});

test('context: failed turns do not use up the recent-message window', () => {
  const normal = [];
  for (let i = 0; i < MAX_CONTEXT; i++) normal.push(i % 2 ? a(`reply ${i}`) : u(`msg ${i}`));
  const mixed = [];
  normal.forEach((m, i) => { mixed.push(m); if (i % 3 === 0) mixed.push(a(CRISIS_SUPPORT_FALLBACK)); });
  assert.ok(build(mixed).includes(`last time:\n\n${transcriptOf(normal)}\n\n`));
});

test('context: a user who types the fallback wording is still context (only assistant turns are filtered)', () => {
  assert.ok(build([u(CRISIS_SUPPORT_FALLBACK)]).includes(`User: ${CRISIS_SUPPORT_FALLBACK}`));
});

test('end to end: outage, HTTP failure and network failure replies are shown, stored, and kept out of the next context', async () => {
  const stored = [u('first message')];
  for (const url of [`${base}/outage-holding`, `${base}/500-text`, 'http://127.0.0.1:1/x']) {
    const { reply } = await clientFlow(url);
    assert.equal(reply, CRISIS_SUPPORT_FALLBACK, 'veteran still sees the approved wording');
    stored.push(u('are you there?'), a(reply)); // the police page saves exactly this
  }
  const { reply } = await clientFlow(`${base}/normal`);
  stored.push(u('back again'), a(reply));
  assert.equal(stored.filter(m => m.text === CRISIS_SUPPORT_FALLBACK).length, 3, 'stored history unchanged');
  const ctx = build(stored);
  assert.ok(!ctx.includes(CRISIS_SUPPORT_FALLBACK));
  assert.ok(ctx.includes(`Sam: ${NORMAL.reply}`));
  assert.equal((ctx.match(/User: are you there\?/g) || []).length, 3);
});

test('helper: exact (trimmed) assistant match only; never throws', () => {
  assert.equal(isUnassessedAssistantReply(true, CRISIS_SUPPORT_FALLBACK), true);
  assert.equal(isUnassessedAssistantReply(true, `  ${CRISIS_SUPPORT_FALLBACK}\n`), true);
  assert.equal(isUnassessedAssistantReply(false, CRISIS_SUPPORT_FALLBACK), false);
  assert.equal(isUnassessedAssistantReply(true, CRISIS_SUPPORT_FALLBACK.slice(0, -1)), false);
  assert.equal(isUnassessedAssistantReply(true, null), false);
  assert.deepEqual(contextEligibleHistory(null, () => true), []);
  assert.deepEqual(contextEligibleHistory([null, u('x')], m => m.role === 'assistant'), [null, u('x')]);
  const throwing = [u('x')];
  assert.deepEqual(contextEligibleHistory(throwing, () => { throw new Error('boom'); }), throwing);
});

test('wiring: only the context builder filters; display and storage paths are untouched', () => {
  assert.equal((POLICE_SRC.match(/contextEligibleHistory\(/g) || []).length, 1);
  assert.match(POLICE_SRC, /setMessages\(\[\.\.\.history, returning\]\)/, 'stored history still shown in full');
  assert.match(POLICE_SRC, /freshStored\[persona\.id\] = updated;/, 'stored as before');
  assert.match(POLICE_SRC, /const conversation_context = buildConversationContext\(priorHistory, persona\.name\);/);
});
