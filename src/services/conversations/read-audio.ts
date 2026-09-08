/**
 * Lecture d'un segment audio enregistré → base64 + type MIME, pour l'upload.
 * Version native : `expo-audio` écrit un fichier local, lu via `expo-file-system`.
 * (La version web `read-audio.web.ts` gère le cas `blob:` du navigateur.)
 */

import * as FileSystem from 'expo-file-system/legacy';

function mimeForUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'caf') return 'audio/x-caf';
  if (ext === 'aac') return 'audio/aac';
  return 'audio/mp4';
}

export async function readAudioForUpload(
  uri: string,
): Promise<{ audioBase64: string; mimeType: string }> {
  const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return { audioBase64, mimeType: mimeForUri(uri) };
}
