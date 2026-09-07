# features/

Modules métier orientés fonctionnalité (écrans composites + hooks + logique
d'orchestration propres à une feature), qui consomment `services/`, `stores/`
et `lib/`.

Prévu :

- `features/conversation/` — écran de conversation, pipeline micro → IA → temps réel (Phase 6)
- `features/sessions/` — création de session, QR, lien d'invitation (Phase 3 / 7)
- `features/contacts/` — recherche, demandes, liste (Phase 8)
- `features/nearby/` — découverte de proximité opt-in (Phase 9)
- `features/auth/` — mode invité, connexion Google, profil (Phase 2)

Règle : pas de logique métier lourde dans `app/` (les écrans de routage restent
minces et délèguent à `features/`).
