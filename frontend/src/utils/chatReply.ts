// #144 (Ant, 23 Oct 2026): what a chat client shows when /api/ai-buddies/chat
// does not return a usable reply.
//
// HTTP errors (500, 503, 429, ...), non-JSON bodies (the framework's
// "Internal Server Error"), a missing / empty / non-string `reply`, and network
// failures all show the approved fixed crisis-support wording (the F2 holding
// response, PD-2) instead of generic reassurance or a retry-only message.
//
// Successful responses are unchanged: a 2xx JSON body with a non-empty string
// `reply` shows that reply exactly. The parsed body is returned whenever there
// is one, so each client's existing safeguarding handling
// (`data.safeguardingTriggered` -> modal) behaves exactly as before.
//
// This module is pure and imports nothing, so it runs under the app (Metro),
// the portal (Next.js) and `node --experimental-strip-types --test` (Node >= 22.6;
// type stripping is on by default from Node 22.18).
// Identical copies: frontend/src/utils/chatReply.ts and portal/src/lib/chatReply.ts
// (backend/tests/test_144_pre_assessment_outage.py checks they match each other
// and the server's F2_HOLDING_RESPONSE).

export const CRISIS_SUPPORT_FALLBACK =
  "Sorry, something went wrong and I couldn't process your message properly. " +
  "Please try sending it again. If you need someone to talk to now, you can call " +
  "Samaritans free on 116 123. If you or someone else is in immediate danger, call 999.";

export interface ChatReplyResult {
  /** true only for a 2xx JSON body with a non-empty string reply */
  ok: boolean;
  /** the server's reply, or CRISIS_SUPPORT_FALLBACK */
  reply: string;
  /** the parsed JSON body if there was one (any status), else null */
  data: any;
}

interface ResponseLike {
  ok: boolean;
  json: () => Promise<any>;
}

/** Interpret a fetch() Response from /api/ai-buddies/chat. Never throws. */
export async function readChatReply(response: ResponseLike | null | undefined): Promise<ChatReplyResult> {
  let data: any = null;
  try {
    if (response) {
      data = await response.json();
    }
  } catch {
    data = null;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    data = null;
  }
  const reply = data ? data.reply : undefined;
  const usable = !!response && response.ok === true && typeof reply === 'string' && reply.trim() !== '';
  return { ok: usable, reply: usable ? reply : CRISIS_SUPPORT_FALLBACK, data };
}

/** For a request that never produced a response (network failure, abort). */
export function chatFailureReply(): string {
  return CRISIS_SUPPORT_FALLBACK;
}
