/**
 * Config plugin Expo : configure la signature de release Android au prebuild.
 *
 * `android/` est régénéré à chaque `expo prebuild`, donc la config de signature
 * ne peut pas y vivre. Ce plugin réinjecte dans `android/app/build.gradle` :
 *   - un signingConfig `release` qui lit `credentials/keystore.properties` ;
 *   - le buildType `release` qui l'utilise SI le fichier existe, sinon retombe
 *     sur la clé debug (build de test possible sans keystore).
 *
 * Le keystore et `keystore.properties` ne sont pas versionnés
 * (voir credentials/keystore.properties.example).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'LINGOLINK_RELEASE_SIGNING';

const RELEASE_SIGNING_CONFIG = `
        // ${MARKER}
        release {
            def kFile = rootProject.file('../credentials/keystore.properties')
            if (kFile.exists()) {
                def kProps = new Properties()
                kFile.withInputStream { kProps.load(it) }
                storeFile rootProject.file('../credentials/' + kProps['RELEASE_STORE_FILE'])
                storePassword kProps['RELEASE_STORE_PASSWORD']
                keyAlias kProps['RELEASE_KEY_ALIAS']
                keyPassword kProps['RELEASE_KEY_PASSWORD']
            }
        }`;

function patchBuildGradle(contents) {
  if (contents.includes(MARKER)) return contents;

  // 1. Ajoute le signingConfig `release` juste après l'ouverture de `signingConfigs {`.
  let next = contents.replace(
    /(\n\s*signingConfigs\s*\{)/,
    `$1${RELEASE_SIGNING_CONFIG}`,
  );

  // 2. Le buildType `release` utilise la clé release si dispo, sinon debug.
  //    La ligne `signingConfig signingConfigs.debug` suivie de `enableShrinkResources`
  //    est unique au bloc release.
  next = next.replace(
    /signingConfig signingConfigs\.debug(\n\s*def enableShrinkResources)/,
    "signingConfig rootProject.file('../credentials/keystore.properties').exists() ? signingConfigs.release : signingConfigs.debug$1",
  );

  if (next === contents) {
    throw new Error(
      '[withAndroidReleaseSigning] motif introuvable dans app/build.gradle — le template Expo a changé.',
    );
  }
  return next;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('[withAndroidReleaseSigning] build.gradle non-groovy, non supporté.');
    }
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });
};
