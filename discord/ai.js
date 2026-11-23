// Appel à l'API Claude (Messages) pour l'assistant des tickets.
export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || '').trim();

export async function askClaude({ system, messages, maxTokens = 900 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2026-10-21',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `API Claude ${res.status}`);
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}
