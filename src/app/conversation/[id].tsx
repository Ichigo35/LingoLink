import { useLocalSearchParams } from 'expo-router';

import { ComingSoon } from '@/components/ui/coming-soon';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ComingSoon
      icon="🎤"
      title="Conversation en direct"
      description={`Écran principal de l'app (session ${id ?? '—'}) : transcription et traduction en direct des deux côtés, résultats progressifs, bouton micro Push-to-Talk.`}
      phase="Phase 6"
    />
  );
}
