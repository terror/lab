import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

const origin = process.env.EXPO_PUBLIC_LAB_ORIGIN;

if (!origin) {
  throw new Error('Set `EXPO_PUBLIC_LAB_ORIGIN` to the Lab server origin');
}

export { origin };

export const authClient = createAuthClient({
  baseURL: origin,
  plugins: [expoClient({ storage: SecureStore, storagePrefix: 'lab' })],
});
