/**
 * Service de découverte de proximité (§4 — Méthode 4).
 *
 * Architecture abstraite : le MVP (Phase 9) utilisera une découverte serveur
 * avec opt-in explicite et localisation approximative. Aucune visibilité sans
 * accord, aucune coordonnée GPS exacte exposée. BLE / découverte locale
 * pourront être ajoutés derrière la même interface plus tard.
 */

import type { NearbyUser } from '@/types';

export interface NearbyDiscoveryService {
  enableDiscovery(): Promise<void>;
  disableDiscovery(): Promise<void>;
  getNearbyUsers(): Promise<NearbyUser[]>;
  requestConversation(profileId: string): Promise<{ requestId: string }>;
}

export const NEARBY_NOT_IMPLEMENTED = 'nearby_service_phase_9' as const;
