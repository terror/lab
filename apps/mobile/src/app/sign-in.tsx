import { authClient } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import { useMutation } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function SignIn() {
  const colors = useColors();

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });

      if (error) {
        throw new Error(error.message ?? 'Sign in failed');
      }
    },
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Lab</Text>
      <Pressable
        accessibilityRole='button'
        disabled={signIn.isPending}
        onPress={() => signIn.mutate()}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.label, { color: colors.primaryForeground }]}>
          Continue with Google
        </Text>
      </Pressable>
      {signIn.error && (
        <Text style={{ color: colors.mutedForeground }}>
          {signIn.error.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    gap: 24,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
});
