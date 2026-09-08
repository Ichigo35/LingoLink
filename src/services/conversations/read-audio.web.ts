/**
 * Version web : `expo-audio` produit un `blob:` URL (conteneur webm/opus sur
 * Chrome/Firefox, mp4/aac sur Safari) et `expo-file-system` n'existe pas ici.
 * On récupère le blob directement et on lit son vrai type MIME (`blob.type`)
 * au lieu de le deviner depuis l'extension — c'est la cause des échecs de
 * traduction depuis le web (audio webm envoyé étiqueté `audio/mp4`).
 * Gemini accepte audio/webm, audio/ogg, audio/mp4…
 */

/** Type MIME de MediaRecorder (souvent suffixé `;codecs=…`) → base accepté par Gemini. */
function geminiMime(blobType: string): string {
  const base = (blobType || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp4' || base === 'video/mp4') return 'audio/mp4';
  if (base === 'audio/webm' || base === 'video/webm') return 'audio/webm';
  if (base === 'audio/ogg' || base === 'video/ogg') return 'audio/ogg';
  return base || 'audio/webm';
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readAudioForUpload(
  uri: string,
): Promise<{ audioBase64: string; mimeType: string }> {
  const blob = await (await fetch(uri)).blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { audioBase64: base64FromBytes(bytes), mimeType: geminiMime(blob.type) };
}
