/**
 * Traductions de l'interface (§18). Le français est la langue de référence ;
 * l'anglais complète le parcours principal. Ajouter une clé = l'ajouter dans
 * `fr` (obligatoire) et idéalement `en`.
 */

export const TRANSLATIONS = {
  fr: {
    'common.cancel': 'Annuler',
    'common.continue': 'Continuer',
    'common.retry': 'Réessayer',
    'common.back': 'Retour',
    'common.home': 'Accueil',
    'common.close': 'Fermer',
    'common.myLanguage': 'Ma langue',
    'common.theirLanguage': 'Langue de l’autre personne',

    'home.tagline': 'Parlez naturellement.\nComprenez-vous instantanément.',
    'home.newConversation': 'Nouvelle conversation',
    'home.newConversation.sub': 'Créer une session et inviter quelqu’un',
    'home.scan': 'Scanner un QR',
    'home.scan.sub': 'Rejoindre une conversation existante',
    'home.contacts': 'Mes contacts',
    'home.contacts.sub': 'Vos interlocuteurs réguliers',
    'home.nearby': 'Personnes à proximité',
    'home.nearby.sub': 'Découvrir qui est disponible autour de vous',
    'home.footer': 'Ouvrir → Connecter → Parler',
    'home.guest': 'Compte invité',

    'welcome.tagline': 'Parlez naturellement.\nComprenez-vous instantanément.',
    'welcome.google': 'Continuer avec Google',
    'welcome.guest': 'Continuer en invité',
    'welcome.note':
      'En invité, vous pouvez rejoindre et tester des conversations. Créez un compte plus tard pour garder vos contacts et votre historique.',

    'new.chooseLanguages': 'Choisissez les langues',
    'new.autoDetectHint':
      'La détection automatique arrivera plus tard — pour l’instant, on choisit manuellement.',
    'new.howToConnect': 'Comment vous connecter ?',
    'new.showQr': 'Afficher un QR code',
    'new.showQr.sub': 'L’autre personne le scanne',
    'new.createLink': 'Créer un lien d’invitation',
    'new.createLink.sub': 'À partager sur WhatsApp, SMS, email…',
    'new.pickContact': 'Choisir un contact',
    'new.pickContact.sub': 'Démarrage rapide avec un interlocuteur connu',
    'new.searchNearby': 'Chercher à proximité',
    'new.searchNearby.sub': 'Se connecter à quelqu’un tout près',
    'new.editLanguages': '← Modifier les langues',

    'conv.hold': '🎤 Maintenir pour parler',
    'conv.release': '● Relâchez pour envoyer',
    'conv.translating': 'Traduction…',
    'conv.listening': 'Écoute…',
    'conv.online': 'En ligne',
    'conv.waiting': 'En attente…',
    'conv.connecting': 'Connexion…',
    'conv.ended': 'Terminée',
    'conv.leave': 'Quitter',
    'conv.end': 'Terminer',
    'conv.emptyHint': 'Maintenez le bouton et parlez.',

    'scan.title': 'Scanner un QR code',
    'scan.aim': 'Visez le QR code affiché sur l’autre téléphone.',
    'scan.enterCode': 'Saisir un code à la place',
    'scan.cameraRequired': 'Caméra requise',
  },
  en: {
    'common.cancel': 'Cancel',
    'common.continue': 'Continue',
    'common.retry': 'Retry',
    'common.back': 'Back',
    'common.home': 'Home',
    'common.close': 'Close',
    'common.myLanguage': 'My language',
    'common.theirLanguage': 'Their language',

    'home.tagline': 'Speak naturally.\nUnderstand each other instantly.',
    'home.newConversation': 'New conversation',
    'home.newConversation.sub': 'Create a session and invite someone',
    'home.scan': 'Scan a QR code',
    'home.scan.sub': 'Join an existing conversation',
    'home.contacts': 'My contacts',
    'home.contacts.sub': 'People you talk to regularly',
    'home.nearby': 'People nearby',
    'home.nearby.sub': 'Discover who is available around you',
    'home.footer': 'Open → Connect → Talk',
    'home.guest': 'Guest account',

    'welcome.tagline': 'Speak naturally.\nUnderstand each other instantly.',
    'welcome.google': 'Continue with Google',
    'welcome.guest': 'Continue as guest',
    'welcome.note':
      'As a guest you can join and try conversations. Create an account later to keep your contacts and history.',

    'new.chooseLanguages': 'Choose the languages',
    'new.autoDetectHint':
      'Automatic detection will come later — for now, pick manually.',
    'new.howToConnect': 'How do you want to connect?',
    'new.showQr': 'Show a QR code',
    'new.showQr.sub': 'The other person scans it',
    'new.createLink': 'Create an invite link',
    'new.createLink.sub': 'Share via WhatsApp, SMS, email…',
    'new.pickContact': 'Pick a contact',
    'new.pickContact.sub': 'Quick start with a known person',
    'new.searchNearby': 'Search nearby',
    'new.searchNearby.sub': 'Connect with someone close by',
    'new.editLanguages': '← Change languages',

    'conv.hold': '🎤 Hold to talk',
    'conv.release': '● Release to send',
    'conv.translating': 'Translating…',
    'conv.listening': 'Listening…',
    'conv.online': 'Online',
    'conv.waiting': 'Waiting…',
    'conv.connecting': 'Connecting…',
    'conv.ended': 'Ended',
    'conv.leave': 'Leave',
    'conv.end': 'End',
    'conv.emptyHint': 'Hold the button and speak.',

    'scan.title': 'Scan a QR code',
    'scan.aim': 'Point at the QR code shown on the other phone.',
    'scan.enterCode': 'Enter a code instead',
    'scan.cameraRequired': 'Camera required',
  },
} as const;

export type TranslationKey = keyof (typeof TRANSLATIONS)['fr'];
