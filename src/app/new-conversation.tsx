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
import { useConversationGuard } from '@/features/conversation/conversation-guard';
import { useT } from '@/i18n';
import { useNewConversationStore } from '@/stores/new-conversation-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ConnectionMethod } from '@/types';

export default function NewConversationScreen() {
  const router = useRouter();
  const t = useT();
  const guard = useConversationGuard();
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

  function chooseMethod(nextMethod: ConnectionMethod) {
    setMethod(nextMethod);
    const target =
      nextMethod === 'contact'
        ? '/contacts'
        : nextMethod === 'nearby'
          ? '/nearby'
          : '/session/host'; // 'qr' et 'link' : même écran hôte
    // 'qr'/'link' créent la session au montage de l'écran hôte → garde ici.
    // 'contact'/'nearby' ne font que naviguer vers un écran de choix (garde en aval).
    if (nextMethod === 'qr' || nextMethod === 'link') {
      guard(() => router.push(target));
    } else {
      router.push(target);
    }
  }

  if (step === 'languages') {
    return (
      <Screen scroll>
        <ThemedText style={styles.h1}>{t('new.chooseLanguages')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('new.autoDetectHint')}</ThemedText>

        <View style={styles.block}>
          <LanguageSelector
            label={t('common.myLanguage')}
            value={myLang}
            onChange={setMyLang}
            exclude={otherLang}
          />
        </View>
        <View style={styles.block}>
          <LanguageSelector
            label={t('common.theirLanguage')}
            value={otherLang}
            onChange={setOtherLang}
            exclude={myLang}
          />
        </View>

        <Button
          label={t('common.continue')}
          onPress={confirmLanguages}
          disabled={!canContinue}
          style={styles.cta}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ThemedText style={styles.h1}>{t('new.howToConnect')}</ThemedText>
      {myLang && otherLang ? (
        <ThemedText themeColor="textSecondary">
          {formatLanguage(myLang)} ↔ {formatLanguage(otherLang)}
        </ThemedText>
      ) : null}

      <View style={styles.grid}>
        <ActionCard
          icon="📷"
          title={t('new.showQr')}
          subtitle={t('new.showQr.sub')}
          onPress={() => chooseMethod('qr')}
        />
        <ActionCard
          icon="🔗"
          title={t('new.createLink')}
          subtitle={t('new.createLink.sub')}
          onPress={() => chooseMethod('link')}
        />
        <ActionCard
          icon="👥"
          title={t('new.pickContact')}
          subtitle={t('new.pickContact.sub')}
          onPress={() => chooseMethod('contact')}
        />
        <ActionCard
          icon="📍"
          title={t('new.searchNearby')}
          subtitle={t('new.searchNearby.sub')}
          onPress={() => chooseMethod('nearby')}
        />
      </View>

      <Button
        label={t('new.editLanguages')}
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
    lineHeight: 30,
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
