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
    assert.match(src, /import \{ readChatReply, chatFailureReply(, contextEligibleHistory)? \} from '\.\.\/(\.\.\/)?src\/utils\/chatReply';/);
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

// ---------------------------------------------------------------------------
// #144 correction (Ant, 23 Oct 2026): the crisis-support fallback stays visible
// and stored on the device, but unsuccessful / unassessed assistant replies
// never enter the conversation_context sent back to /api/ai-buddies/chat.
// These tests run the REAL buildConversationContext from
// app/chat/[characterId].tsx (its body is extracted from the source and
// executed against device-stored history), not a copy of it.
// ---------------------------------------------------------------------------
import { contextEligibleHistory, isUnassessedAssistantReply } from '../src/utils/chatReply.ts';

const CHAT_SRC = readFileSync(here('../app/chat/[characterId].tsx'), 'utf8');

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

// eslint-disable-next-line no-new-func
const appBuild = new Function('previousConversations', 'character', 'contextEligibleHistory',
  extractBody(CHAT_SRC, 'const buildConversationContext = () => {'));
const build = (history) => appBuild(history, { name: 'Tommy' }, contextEligibleHistory);
const WINDOW = 15;

let n = 0;
const u = (text) => ({ id: `u${n++}`, text, sender: 'user', timestamp: new Date() });
const b = (text) => ({ id: `b${n++}`, text, sender: 'buddy', timestamp: new Date() });
const transcriptOf = (msgs) => msgs.map(m => `${m.sender === 'user' ? 'User' : 'Tommy'}: ${m.text}`).join('\n');

test('context: the crisis-support fallback is excluded, user turns and normal replies are kept', () => {
  const ctx = build([u('rough week'), b('Sounds heavy, mate. What happened?'),
    u('cannot sleep'), b(CRISIS_SUPPORT_FALLBACK)]);
  assert.ok(ctx.includes('User: rough week'));
  assert.ok(ctx.includes('Tommy: Sounds heavy, mate. What happened?'));
  assert.ok(ctx.includes('User: cannot sleep'), 'the veteran\'s own words are still context');
  assert.ok(!ctx.includes(CRISIS_SUPPORT_FALLBACK), 'fallback must not reach the AI');
  assert.ok(!ctx.includes('116 123'));
});

test('context: normal history (no failures) is exactly what it was before', () => {
  const history = [u('hiya'), b('Alright. How was the allotment?'), u('grand'),
    b('Right. I\'m not going to leave you with that... Samaritans: 116 123 ... 999')];
  const ctx = build(history);
  assert.ok(ctx.includes(`last time:\n\n${transcriptOf(history)}\n\n`), 'transcript unchanged');
  assert.ok(ctx.startsWith('\n\n[RETURNING MATE'));
});

test('context: a real crisis reply that mentions Samaritans is NOT excluded', () => {
  const crisis = b('Right. I\'m not going to leave you with that. Samaritans free on 116 123, or 999.');
  assert.ok(build([u('x'), crisis]).includes(crisis.text));
  // A normal reply that merely starts like the fallback is kept (exact match only).
  const lookalike = b('Sorry, something went wrong with your day? Tell me about it, mate.');
  assert.ok(build([u('x'), lookalike]).includes(`Tommy: ${lookalike.text}`));
});

test('context: history that is only failed turns produces no context block', () => {
  assert.equal(build([b(CRISIS_SUPPORT_FALLBACK), b(CRISIS_SUPPORT_FALLBACK)]), '');
  assert.equal(build([]), '');
});

test('context: failed turns do not use up the 15-message window', () => {
  const normal = [];
  for (let i = 0; i < WINDOW; i++) normal.push(i % 2 ? b(`reply ${i}`) : u(`msg ${i}`));
  const mixed = [];
  normal.forEach((m, i) => { mixed.push(m); if (i % 3 === 0) mixed.push(b(CRISIS_SUPPORT_FALLBACK)); });
  assert.ok(build(mixed).includes(`last time:\n\n${transcriptOf(normal)}\n\n`));
});

test('context: a user who types the fallback wording is still context (only buddy turns are filtered)', () => {
  assert.ok(build([u(CRISIS_SUPPORT_FALLBACK)]).includes(`User: ${CRISIS_SUPPORT_FALLBACK}`));
});

test('end to end: outage, HTTP failure and network failure replies are shown, stored, and kept out of the next context', async () => {
  const stored = [u('first message')];
  for (const url of [`${base}/outage-holding`, `${base}/500-text`, 'http://127.0.0.1:1/x']) {
    const { reply } = await clientFlow(url);
    assert.equal(reply, CRISIS_SUPPORT_FALLBACK, 'veteran still sees the approved wording');
    stored.push(u('are you there?'), b(reply)); // the screen stores exactly this on the device
  }
  const { reply } = await clientFlow(`${base}/normal`);
  stored.push(u('back again'), b(reply));
  // Round-trip through device storage as the screen does (JSON, dates revived).
  const reloaded = JSON.parse(JSON.stringify(stored)).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  assert.equal(reloaded.filter(m => m.text === CRISIS_SUPPORT_FALLBACK).length, 3, 'stored history unchanged');
  const ctx = build(reloaded);
  assert.ok(!ctx.includes(CRISIS_SUPPORT_FALLBACK));
  assert.ok(ctx.includes('Tommy: Alright mate'));
  assert.equal((ctx.match(/User: are you there\?/g) || []).length, 3);
});

test('helper: exact (trimmed) assistant match only; never throws', () => {
  assert.equal(isUnassessedAssistantReply(true, CRISIS_SUPPORT_FALLBACK), true);
  assert.equal(isUnassessedAssistantReply(true, ` ${CRISIS_SUPPORT_FALLBACK} `), true);
  assert.equal(isUnassessedAssistantReply(false, CRISIS_SUPPORT_FALLBACK), false);
  assert.equal(isUnassessedAssistantReply(true, 'Lost you for a second there'), false);
  assert.deepEqual(contextEligibleHistory(undefined, () => true), []);
});

test('wiring: only the context builder filters; display and storage paths are untouched', () => {
  assert.equal((CHAT_SRC.match(/contextEligibleHistory\(/g) || []).length, 1);
  assert.match(CHAT_SRC, /const allMessages = \[\.\.\.previousConversations, \.\.\.currentNewMessages\];/, 'stored as before');
  assert.match(CHAT_SRC, /conversation_context: conversationContext,/);
  const grace = readFileSync(here('../app/grace-welcome.tsx'), 'utf8');
  assert.ok(!grace.includes('conversation_context'), 'Grace sends no history, so needs no filter');
});
