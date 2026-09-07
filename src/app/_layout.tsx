import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useResolvedScheme } from '@/hooks/use-theme';

export default function RootLayout() {
  const scheme = useResolvedScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { flex: 1 },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="new-conversation"
              options={{ title: 'Nouvelle conversation', presentation: 'modal' }}
            />
            <Stack.Screen name="scan" options={{ title: 'Scanner un QR' }} />
            <Stack.Screen name="contacts" options={{ title: 'Mes contacts' }} />
            <Stack.Screen name="nearby" options={{ title: 'Personnes à proximité' }} />
            <Stack.Screen name="profile" options={{ title: 'Profil' }} />
            <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />
            <Stack.Screen name="conversation/[id]" options={{ title: 'Conversation' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
