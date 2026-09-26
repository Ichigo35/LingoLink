/**
 * Retour sonore du bouton micro (§8) : un bip au début de l'enregistrement,
 * un autre légèrement plus grave à la fin. Sons synthétisés (pas de fichier
 * tiers), très courts (~150 ms). Suit le mode audio courant — pas de
 * `playsInSilentMode` forcé ici : comme les sons système, ils restent
 * silencieux si le téléphone est en mode silencieux.
 */

import { useAudioPlayer } from 'expo-audio';
import { useCallback } from 'react';

const START_SOUND = require('@/assets/sounds/record-start.wav');
const STOP_SOUND = require('@/assets/sounds/record-stop.wav');

export function useRecordingSounds() {
  const startPlayer = useAudioPlayer(START_SOUND);
  const stopPlayer = useAudioPlayer(STOP_SOUND);

  const playStart = useCallback(() => {
    startPlayer.seekTo(0).catch(() => {});
    startPlayer.play();
  }, [startPlayer]);

  const playStop = useCallback(() => {
    stopPlayer.seekTo(0).catch(() => {});
    stopPlayer.play();
  }, [stopPlayer]);

  return { playStart, playStop };
}
