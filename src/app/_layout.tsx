import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';

const PUBLIC_SEGMENTS = ['welcome'];

function useAuthRouting() {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const current = segments[0];
    const inPublic = PUBLIC_SEGMENTS.includes(current ?? '');

    if (!isAuthenticated && !inPublic) {
      router.replace('/welcome');
    } else if (isAuthenticated && inPublic) {
      router.replace(needsOnboarding ? '/onboarding' : '/');
    } else if (isAuthenticated && needsOnboarding && current !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [isLoading, isAuthenticated, needsOnboarding, segments, router]);

  return { isLoading };
}

function RootNavigator() {
  const theme = useTheme();
  const { isLoading } = useAuthRouting();

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
        options={{ title: 'Nouvelle conversation', presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/host"
        options={{ title: 'Inviter', presentation: 'modal' }}
      />
      <Stack.Screen name="scan" options={{ title: 'Scanner un QR' }} />
      <Stack.Screen name="contacts" options={{ title: 'Mes contacts' }} />
      <Stack.Screen name="nearby" options={{ title: 'Personnes à proximité' }} />
      <Stack.Screen name="profile" options={{ title: 'Profil' }} />
      <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />
      <Stack.Screen name="ai-test" options={{ title: 'Test IA' }} />
      <Stack.Screen name="conversation/[id]" options={{ title: 'Conversation' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useResolvedScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
