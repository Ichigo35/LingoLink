import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionCard } from '@/components/ui/action-card';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, type LanguageCode } from '@/config/languages';
import { Spacing } from '@/constants/theme';
import { useNewConversationStore } from '@/stores/new-conversation-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ConnectionMethod } from '@/types';

export default function NewConversationScreen() {
  const router = useRouter();
  const { lastMyLanguage, lastOtherLanguage, setLastLanguages } = useSettingsStore();
  const { setLanguages, setMethod } = useNewConversationStore();

  const [step, setStep] = useState<'languages' | 'method'>('languages');
  const [myLang, setMyLang] = useState<LanguageCode | null>(lastMyLanguage);
  const [otherLang, setOtherLang] = useState<LanguageCode | null>(lastOtherLanguage);

  const canContinue = myLang != null && otherLang != null && myLang !== otherLang;

  function confirmLanguages() {
    if (!canContinue || !myLang || !otherLang) return;
    setLanguages(myLang, otherLang);
    setLastLanguages(myLang, otherLang);
    setStep('method');
  }

  function chooseMethod(method: ConnectionMethod) {
    setMethod(method);
    // Les écrans de connexion réels (génération QR, lien, etc.) arrivent en Phase 3+.
    // Pour l'instant on redirige vers l'écran placeholder le plus proche.
    const target = method === 'contact' ? '/contacts' : method === 'nearby' ? '/nearby' : '/scan';
    router.push(target);
  }

  if (step === 'languages') {
    return (
      <Screen scroll>
        <ThemedText style={styles.h1}>Choisissez les langues</ThemedText>
        <ThemedText themeColor="textSecondary">
          La détection automatique arrivera plus tard — pour l’instant, on choisit
          manuellement.
        </ThemedText>

        <View style={styles.block}>
          <LanguageSelector
            label="Ma langue"
            value={myLang}
            onChange={setMyLang}
            exclude={otherLang}
          />
        </View>
        <View style={styles.block}>
          <LanguageSelector
            label="Langue de l'autre personne"
            value={otherLang}
            onChange={setOtherLang}
            exclude={myLang}
          />
        </View>

        <Button
          label="Continuer"
          onPress={confirmLanguages}
          disabled={!canContinue}
          style={styles.cta}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ThemedText style={styles.h1}>Comment vous connecter ?</ThemedText>
      {myLang && otherLang ? (
        <ThemedText themeColor="textSecondary">
          {formatLanguage(myLang)} ↔ {formatLanguage(otherLang)}
        </ThemedText>
      ) : null}

      <View style={styles.grid}>
        <ActionCard
          icon="📷"
          title="Afficher un QR code"
          subtitle="L'autre personne le scanne"
          onPress={() => chooseMethod('qr')}
        />
        <ActionCard
          icon="🔗"
          title="Créer un lien d'invitation"
          subtitle="À partager sur WhatsApp, SMS, email…"
          onPress={() => chooseMethod('link')}
        />
        <ActionCard
          icon="👥"
          title="Choisir un contact"
          subtitle="Démarrage rapide avec un interlocuteur connu"
          onPress={() => chooseMethod('contact')}
        />
        <ActionCard
          icon="📍"
          title="Chercher à proximité"
          subtitle="Se connecter à quelqu'un tout près"
          onPress={() => chooseMethod('nearby')}
        />
      </View>

      <Button
        label="← Modifier les langues"
        variant="ghost"
        onPress={() => setStep('languages')}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 24,
    fontWeight: '700',
  },
  block: {
    gap: Spacing.two,
  },
  grid: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  cta: {
    marginTop: Spacing.four,
  },
});
