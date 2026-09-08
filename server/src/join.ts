import { Hono } from 'hono';

import type { AppEnv } from './context';

/**
 * Liens de jointure « cliquables » et App Links Android.
 *
 * Le scheme `lingolink://` n'est pas transformé en lien par WhatsApp & co.
 * On expose donc une URL HTTPS (`/join/<token>`) :
 *  - cliquable partout,
 *  - sur Android (App Links vérifiés via /.well-known/assetlinks.json) l'OS
 *    ouvre directement l'app,
 *  - ailleurs, une page légère rebondit vers `lingolink://join/<token>` avec un
 *    bouton de secours.
 */

const ANDROID_PACKAGE = 'com.ichigo35.lingolink';
/** Empreinte SHA-256 du keystore de release (cf. CLAUDE.md § Builds). */
const ANDROID_SHA256 =
  '55:A8:0A:07:D4:FE:E3:1F:00:E4:F4:78:84:E5:E4:A8:DB:06:0A:DB:D9:84:B7:4E:21:CD:8B:F3:E6:78:A6:7C';

const TOKEN_RE = /^[A-Za-z0-9_-]{10,64}$/;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function bouncePage(scheme: string, token: string): string {
  const deep = `${scheme}://join/${encodeURIComponent(token)}`;
  const safeDeep = escapeHtml(deep);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rejoindre une conversation Lingo Link</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:#2F6BFF; color:#fff; padding:24px; box-sizing:border-box; text-align:center; }
  .card { max-width:360px; }
  h1 { font-size:1.4rem; margin:0 0 8px; }
  p { opacity:.9; line-height:1.5; margin:0 0 24px; }
  a.btn { display:inline-block; background:#fff; color:#2F6BFF; font-weight:700;
    text-decoration:none; padding:14px 24px; border-radius:14px; font-size:1.05rem; }
  .hint { margin-top:20px; font-size:.85rem; opacity:.75; }
</style>
</head>
<body>
  <div class="card">
    <h1>Lingo Link</h1>
    <p>Ouverture de la conversation dans l'application…</p>
    <a class="btn" href="${safeDeep}">Ouvrir dans Lingo Link</a>
    <p class="hint">Si rien ne se passe, installez Lingo Link puis rouvrez ce lien.</p>
  </div>
  <script>
    setTimeout(function () { window.location.href = ${JSON.stringify(deep)}; }, 300);
  </script>
</body>
</html>`;
}

export function registerJoinRoutes(app: Hono<AppEnv>) {
  // Vérification App Links Android.
  app.get('/.well-known/assetlinks.json', (c) =>
    c.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: [ANDROID_SHA256],
        },
      },
    ]),
  );

  // Page de rebond / cible App Links.
  app.get('/join/:token', (c) => {
    const token = c.req.param('token');
    if (!token || !TOKEN_RE.test(token)) {
      return c.text('Lien de conversation invalide.', 400);
    }
    return c.html(bouncePage(c.env.APP_SCHEME || 'lingolink', token), 200, {
      'Cache-Control': 'no-store',
    });
  });
}
