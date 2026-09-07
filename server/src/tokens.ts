/** Génération et normalisation des tokens / codes courts de session. */

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token opaque de session (32 octets aléatoires -> ~43 caractères). */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Code court 8 caractères sans ambiguïté (saisie manuelle). */
export function randomShortCode(): string {
  const buf = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (const b of buf) out += SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length];
  return out;
}

export function normalizeShortCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "ABCD1234" -> "ABCD-1234". */
export function formatShortCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
