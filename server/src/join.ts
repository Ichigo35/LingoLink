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
 *
 * La page est traduite dans les 8 langues d'UI de l'app, à partir de l'en-tête
 * `Accept-Language` du navigateur. La langue retenue est aussi passée au web
 * (`?hl=<code>`) pour que la version web s'affiche dans la même langue — plus
 * fiable que `navigator.language` sur certains navigateurs mobiles.
 */

const ANDROID_PACKAGE = 'com.ichigo35.lingolink';
/** Empreinte SHA-256 du keystore de release (cf. CLAUDE.md § Builds). */
const ANDROID_SHA256 =
  '55:A8:0A:07:D4:FE:E3:1F:00:E4:F4:78:84:E5:E4:A8:DB:06:0A:DB:D9:84:B7:4E:21:CD:8B:F3:E6:78:A6:7C';

const TOKEN_RE = /^[A-Za-z0-9_-]{10,64}$/;

/** Langues d'UI de l'app (miroir de `UI_LANGUAGES` côté client). */
const UI_LANGS = ['fr', 'en', 'lo', 'th', 'zh', 'ja', 'ko', 'hi'] as const;
type UiLang = (typeof UI_LANGS)[number];

interface Strings {
  htmlLang: string;
  join: string;
  openApp: string;
  openWeb: string;
  hintNoApp: string;
  hintSlow: string;
}

const T: Record<UiLang, Strings> = {
  fr: {
    htmlLang: 'fr',
    join: 'Rejoindre la conversation',
    openApp: "Ouvrir dans l'application",
    openWeb: 'Continuer dans le navigateur',
    hintNoApp: "L'app n'est pas installée ? Continuez dans le navigateur.",
    hintSlow: 'Le chargement peut prendre quelques secondes selon la connexion.',
  },
  en: {
    htmlLang: 'en',
    join: 'Join the conversation',
    openApp: 'Open in the app',
    openWeb: 'Continue in the browser',
    hintNoApp: "App not installed? Continue in the browser.",
    hintSlow: 'Loading can take a few seconds depending on your connection.',
  },
  lo: {
    htmlLang: 'lo',
    join: 'ເຂົ້າຮ່ວມການສົນທະນາ',
    openApp: 'ເປີດໃນແອັບ',
    openWeb: 'ດຳເນີນຕໍ່ໃນຕົວທ່ອງເວັບ',
    hintNoApp: 'ຍັງບໍ່ໄດ້ຕິດຕັ້ງແອັບບໍ? ດຳເນີນຕໍ່ໃນຕົວທ່ອງເວັບ.',
    hintSlow: 'ການໂຫຼດອາດໃຊ້ເວລາສອງສາມວິນາທີ ຂຶ້ນກັບການເຊື່ອມຕໍ່.',
  },
  th: {
    htmlLang: 'th',
    join: 'เข้าร่วมการสนทนา',
    openApp: 'เปิดในแอป',
    openWeb: 'ดำเนินการต่อในเบราว์เซอร์',
    hintNoApp: 'ยังไม่ได้ติดตั้งแอปใช่ไหม? ดำเนินการต่อในเบราว์เซอร์',
    hintSlow: 'การโหลดอาจใช้เวลาสองสามวินาที ขึ้นอยู่กับการเชื่อมต่อ',
  },
  zh: {
    htmlLang: 'zh',
    join: '加入对话',
    openApp: '在应用中打开',
    openWeb: '在浏览器中继续',
    hintNoApp: '未安装应用？请在浏览器中继续。',
    hintSlow: '加载可能需要几秒钟，取决于你的网络连接。',
  },
  ja: {
    htmlLang: 'ja',
    join: '会話に参加',
    openApp: 'アプリで開く',
    openWeb: 'ブラウザで続ける',
    hintNoApp: 'アプリが未インストールですか？ブラウザで続けてください。',
    hintSlow: '通信状況により、読み込みに数秒かかることがあります。',
  },
  ko: {
    htmlLang: 'ko',
    join: '대화 참가',
    openApp: '앱에서 열기',
    openWeb: '브라우저에서 계속',
    hintNoApp: '앱이 설치되지 않았나요? 브라우저에서 계속하세요.',
    hintSlow: '연결 상태에 따라 로딩에 몇 초가 걸릴 수 있습니다.',
  },
  hi: {
    htmlLang: 'hi',
    join: 'बातचीत में शामिल हों',
    openApp: 'ऐप में खोलें',
    openWeb: 'ब्राउज़र में जारी रखें',
    hintNoApp: 'ऐप इंस्टॉल नहीं है? ब्राउज़र में जारी रखें।',
    hintSlow: 'कनेक्शन के आधार पर लोड होने में कुछ सेकंड लग सकते हैं।',
  },
};

/** Choisit la meilleure langue d'UI à partir de l'en-tête `Accept-Language`. */
function pickLang(header: string | null | undefined): UiLang {
  if (!header) return 'en';
  const wanted = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { code: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.code)
    .sort((a, b) => b.q - a.q);
  for (const { code } of wanted) {
    if ((UI_LANGS as readonly string[]).includes(code)) return code as UiLang;
  }
  return 'en';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Navigateurs intégrés (WhatsApp, Instagram, Facebook, Line, …) : ces WebViews
 * bloquent souvent la navigation vers un scheme personnalisé non enregistré et
 * affichent une alerte native « adresse invalide » — y compris pour une simple
 * redirection JS automatique. Dans ce contexte on ne tente PAS le lien
 * `lingolink://` et on met en avant le bouton web (navigation HTTPS normale,
 * toujours fiable).
 */
function isInAppBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /WhatsApp|FBAN|FBAV|Instagram|Line\//i.test(ua);
}

function bouncePage(
  scheme: string,
  webUrl: string | undefined,
  token: string,
  lang: UiLang,
  inApp: boolean,
): string {
  const s = T[lang];
  const deep = `${scheme}://join/${encodeURIComponent(token)}`;
  const web = webUrl
    ? `${webUrl.replace(/\/$/, '')}/join/${encodeURIComponent(token)}?hl=${lang}`
    : null;
  const appBtnCls = inApp ? 'btn ghost' : 'btn';
  const webBtnCls = inApp ? 'btn' : 'btn ghost';
  const appBtn = `<a class="${appBtnCls}" href="${escapeHtml(deep)}">${escapeHtml(s.openApp)}</a>`;
  const webBtn = web
    ? `<a class="${webBtnCls}" href="${escapeHtml(web)}">${escapeHtml(s.openWeb)}</a>`
    : '';
  // Dans un navigateur intégré, le bouton web passe en premier (action recommandée).
  const buttons = inApp ? `${webBtn}${appBtn}` : `${appBtn}${webBtn}`;
  return `<!doctype html>
<html lang="${s.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lingo Link</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:#2F6BFF; color:#fff; padding:24px; box-sizing:border-box; text-align:center; }
  .card { max-width:360px; display:flex; flex-direction:column; gap:12px; }
  h1 { font-size:1.4rem; margin:0 0 4px; }
  p { opacity:.9; line-height:1.5; margin:0 0 12px; }
  a.btn { display:block; background:#fff; color:#2F6BFF; font-weight:700;
    text-decoration:none; padding:14px 24px; border-radius:14px; font-size:1.05rem; }
  a.btn.ghost { background:transparent; color:#fff; border:1.5px solid rgba(255,255,255,.6); }
  .hint { margin-top:12px; font-size:.85rem; opacity:.75; }
</style>
</head>
<body>
  <div class="card">
    <h1>Lingo Link</h1>
    <p>${escapeHtml(s.join)}</p>
    ${buttons}
    <p class="hint">${escapeHtml(s.hintNoApp)}<br />${escapeHtml(s.hintSlow)}</p>
  </div>
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
      return c.text('Lien de conversation invalide. / Invalid conversation link.', 400);
    }
    const lang = pickLang(c.req.header('accept-language'));
    const inApp = isInAppBrowser(c.req.header('user-agent'));
    return c.html(
      bouncePage(c.env.APP_SCHEME || 'lingolink', c.env.WEB_APP_URL, token, lang, inApp),
      200,
      { 'Cache-Control': 'no-store', 'Content-Language': T[lang].htmlLang },
    );
  });
}
