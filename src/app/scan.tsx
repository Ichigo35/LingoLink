import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { extractJoinToken } from '@/config/session';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { useSessionStore } from '@/stores/session-store';
import type { ConversationSession } from '@/types';

export default function ScanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const setSession = useSessionStore((s) => s.setSession);

  const [mode, setMode] = useState<'scan' | 'code'>('scan');
  const [code, setCode] = useState('');
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
      const msg = e instanceof ApiRequestError ? e.message : 'Impossible de rejoindre';
      Alert.alert('Connexion impossible', msg);
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
    if (trimmed.length < 6) {
      Alert.alert('Code invalide', 'Saisissez le code affiché sous le QR (ex. 7F29-KP42).');
      return;
    }
    join(() => conversationsService.joinByCode(trimmed));
  }

  if (mode === 'code') {
    return (
      <Screen scroll>
        <ThemedText style={styles.h1}>Saisir un code</ThemedText>
        <ThemedText themeColor="textSecondary">
          Le code s’affiche sous le QR sur l’autre téléphone.
        </ThemedText>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="7F29-KP42"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        />
        <Button label="Rejoindre" onPress={submitCode} loading={busy} style={styles.cta} />
        <Button label="Scanner un QR à la place" variant="ghost" onPress={() => setMode('scan')} />
      </Screen>
    );
  }

  if (!permission) {
    return <Screen center><ThemedText themeColor="textSecondary">Préparation de la caméra…</ThemedText></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen center>
        <ThemedText style={styles.h1}>Caméra requise</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Autorisez la caméra pour scanner un QR code, ou saisissez le code manuellement.
        </ThemedText>
        <Button label="Autoriser la caméra" onPress={requestPermission} style={styles.cta} />
        <Button label="Saisir un code" variant="secondary" onPress={() => setMode('code')} />
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
        Visez le QR code affiché sur l’autre téléphone.
      </ThemedText>
      <Button label="Saisir un code à la place" variant="secondary" onPress={() => setMode('code')} />
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
    fontSize: 20,
    letterSpacing: 2,
    marginTop: Spacing.three,
  },
  cta: { marginTop: Spacing.four },
});
