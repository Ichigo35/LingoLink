import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConversationInviteModal } from '@/components/conversation-invite-modal';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/offline-banner';
import { extractJoinToken } from '@/config/session';
import { useAppRealtime } from '@/hooks/use-app-realtime';
import { useAuth } from '@/hooks/use-auth';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { usePendingJoinStore } from '@/stores/pending-join-store';

const PUBLIC_SEGMENTS = ['welcome'];

/**
 * Capture un deep link `lingolink://join/<token>` reçu alors que l'utilisateur
 * n'est pas connecté : le token est mémorisé pour reprendre après auth.
 * (Quand l'utilisateur est déjà connecté, expo-router route directement.)
 */
function useDeepLinkCapture(isAuthenticated: boolean) {
  const incomingUrl = Linking.useURL();
  const setPending = usePendingJoinStore((s) => s.set);
  useEffect(() => {
    if (!incomingUrl || isAuthenticated) return;
    const token = extractJoinToken(incomingUrl);
    if (token) setPending(token);
  }, [incomingUrl, isAuthenticated, setPending]);
}

function useAuthRouting() {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingToken = usePendingJoinStore((s) => s.token);

  useDeepLinkCapture(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;
    const current = segments[0];
    const inPublic = PUBLIC_SEGMENTS.includes(current ?? '');

    if (!isAuthenticated && !inPublic) {
      router.replace('/welcome');
    } else if (isAuthenticated && needsOnboarding && current !== 'onboarding') {
      router.replace('/onboarding');
    } else if (isAuthenticated && !needsOnboarding && pendingToken && current !== 'join') {
      router.replace(`/join/${pendingToken}`);
    } else if (isAuthenticated && inPublic) {
      router.replace(needsOnboarding ? '/onboarding' : '/');
    }
  }, [isLoading, isAuthenticated, needsOnboarding, pendingToken, segments, router]);

  return { isLoading };
}

function RootNavigator() {
  const theme = useTheme();
  const t = useT();
  const { isLoading } = useAuthRouting();
  const { isAuthenticated } = useAuth();
  useAppRealtime(isAuthenticated);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600' },
        }}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="new-conversation"
          options={{ title: t('nav.newConversation'), presentation: 'modal' }}
        />
        <Stack.Screen name="session/host" options={{ title: t('nav.invite'), presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ title: t('nav.scan') }} />
        <Stack.Screen name="join/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="contacts" options={{ title: t('nav.contacts') }} />
        <Stack.Screen name="nearby" options={{ title: t('nav.nearby') }} />
        <Stack.Screen name="profile" options={{ title: t('nav.profile') }} />
        <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
        <Stack.Screen name="ai-test" options={{ title: t('nav.aiTest') }} />
        <Stack.Screen
          name="conversation/[id]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack>
      <ConversationInviteModal />
    </>
  );
}

export default function RootLayout() {
  const scheme = useResolvedScheme();

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
            <OfflineBanner />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
