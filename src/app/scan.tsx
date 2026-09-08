import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { extractJoinToken } from '@/config/session';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { useSessionStore } from '@/stores/session-store';
import type { ConversationSession } from '@/types';

export default function ScanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const setSession = useSessionStore((s) => s.setSession);

  // Web : pas de scan caméra fiable → saisie du code directement.
  const isWeb = Platform.OS === 'web';
  const [mode, setMode] = useState<'scan' | 'code'>(isWeb ? 'code' : 'scan');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  async function join(fn: () => Promise<ConversationSession>) {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      const session = await fn();
      setSession(session);
      router.replace(`/conversation/${session.id}`);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : t('scan.cannotJoin');
      setCodeError(msg);
      if (Platform.OS !== 'web') Alert.alert(t('scan.connectionFailed'), msg);
      lockRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  function onBarcode(data: string) {
    const token = extractJoinToken(data);
    if (!token) return;
    join(() => conversationsService.joinByToken(token));
  }

  function submitCode() {
    const trimmed = code.trim();
    setCodeError(null);
    const token = extractJoinToken(trimmed);
    if (token) {
      join(() => conversationsService.joinByToken(token));
      return;
    }
    if (trimmed.length < 6) {
      setCodeError(t('scan.invalidCodeText'));
      return;
    }
    join(() => conversationsService.joinByCode(trimmed));
  }

  if (mode === 'code') {
    return (
      <Screen scroll>
        <ThemedText style={styles.h1}>{t('scan.enterCodeTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('scan.enterCodeSub')}</ThemedText>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            if (codeError) setCodeError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('scan.codePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        />
        {codeError ? (
          <ThemedText style={[styles.error, { color: theme.danger }]}>{codeError}</ThemedText>
        ) : null}
        <Button label={t('scan.join')} onPress={submitCode} loading={busy} style={styles.cta} />
        {!isWeb ? (
          <Button label={t('scan.scanInstead')} variant="ghost" onPress={() => setMode('scan')} />
        ) : null}
      </Screen>
    );
  }

  if (!permission) {
    return <Screen center><ThemedText themeColor="textSecondary">{t('scan.preparingCamera')}</ThemedText></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen center>
        <ThemedText style={styles.h1}>{t('scan.cameraRequired')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {t('scan.cameraRequiredText')}
        </ThemedText>
        <Button label={t('scan.allowCamera')} onPress={requestPermission} style={styles.cta} />
        <Button label={t('scan.enterCode')} variant="secondary" onPress={() => setMode('code')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.cameraWrap, { borderColor: theme.border }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy ? undefined : ({ data }) => onBarcode(data)}
        />
      </View>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {t('scan.aim')}
      </ThemedText>
      <Button label={t('scan.enterCodeInstead')} variant="secondary" onPress={() => setMode('code')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '700' },
  center: { textAlign: 'center' },
  cameraWrap: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.three,
    minHeight: 320,
  },
  input: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    fontSize: 17,
    marginTop: Spacing.three,
  },
  error: { marginTop: Spacing.two, fontSize: 14 },
  cta: { marginTop: Spacing.four },
});
