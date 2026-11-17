import { authClient } from '@/lib/auth';
import { useNavigationTheme } from '@/lib/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';

const queryClient = new QueryClient();

export default function Layout() {
  const theme = useNavigationTheme();

  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return null;
  }

  const signedIn = data !== null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <Stack>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name='index' options={{ title: 'Chats' }} />
            <Stack.Screen name='chats/[id]' options={{ title: '' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name='sign-in' options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
