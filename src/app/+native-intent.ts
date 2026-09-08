/**
 * Normalise les liens entrants avant qu'expo-router ne les route.
 *
 * Les liens de partage sont des URL HTTPS (`https://<api>/join/<token>`) pour
 * être cliquables dans WhatsApp & co. Sur Android, les App Links vérifiés font
 * arriver cette URL telle quelle : on la ramène au chemin interne `/join/<token>`
 * (identique au deep link `lingolink://join/<token>`).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path);
    const m = url.pathname.match(/\/join\/([A-Za-z0-9_-]+)/);
    if (m) return `/join/${m[1]}`;
  } catch {
    /* `path` n'est pas une URL absolue (deep link scheme déjà résolu) — on laisse */
  }
  return path;
}
