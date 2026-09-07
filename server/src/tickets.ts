/**
 * Tickets courts (60 s) signés HMAC-SHA256 pour l'authentification des
 * connexions WebSocket : le cookie de session ne peut pas être envoyé
 * simplement lors de l'upgrade WS, l'app obtient donc d'abord un ticket via un
 * endpoint HTTP authentifié.
 *
 * `scope` restreint l'usage : `s:<sessionId>` (room de conversation) ou `inbox`
 * (boîte de réception personnelle).
 */

export interface Ticket {
  sub: string; // user id
  scope: string; // 's:<sessionId>' | 'inbox'
  role?: 'creator' | 'participant';
  exp: number; // epoch seconds
}

const TICKET_TTL_SECONDS = 60;

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function mintTicket(
  secret: string,
  claims: Omit<Ticket, 'exp'>,
): Promise<string> {
  const full: Ticket = { ...claims, exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifyTicket(
  secret: string,
  ticket: string | undefined | null,
): Promise<Ticket | null> {
  if (!ticket || !ticket.includes('.')) return null;
  const [payload, sig] = ticket.split('.');
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(sig),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as Ticket;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
