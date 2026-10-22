import { AuthContext } from '@/providers/auth-provider';
import { useContext } from 'react';

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth requires AuthProvider');
  }

  return context;
}
