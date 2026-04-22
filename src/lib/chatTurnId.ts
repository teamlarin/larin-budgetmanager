/**
 * Generates a stable, deterministic id for an assistant turn in the AI chat.
 *
 * The id depends ONLY on:
 *  - the conversation id (assigned once when the widget mounts)
 *  - the user prompt that triggered the assistant turn
 *  - the turn index within the same conversation (to handle the rare case of the
 *    same prompt being asked twice in a row)
 *
 * It does NOT depend on the assistant content, so it stays stable while the
 * response is streaming and across pagination/re-renders.
 *
 * Format: `<conversationId>:turn_<index>:<promptHash>`
 *
 * The hash is a simple FNV-1a 32-bit hash, sufficient for grouping feedback
 * (no cryptographic guarantees needed).
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildChatTurnId(conversationId: string, turnIndex: number, prompt: string | undefined): string {
  const promptHash = fnv1aHash((prompt ?? '').trim().toLowerCase());
  return `${conversationId}:turn_${turnIndex}:${promptHash}`;
}

export function parseChatTurnId(turnId: string): { conversationId: string; turnIndex: number; promptHash: string } | null {
  // conversationId can contain ':' (rare) — split from the right on ':turn_'
  const match = turnId.match(/^(.*):turn_(\d+):([0-9a-f]+)$/i);
  if (!match) return null;
  return { conversationId: match[1], turnIndex: parseInt(match[2], 10), promptHash: match[3] };
}
