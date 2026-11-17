import { DarkTheme, DefaultTheme } from 'expo-router';
import { useColorScheme } from 'react-native';

const palettes = {
  dark: {
    background: '#0a0a0a',
    border: '#262626',
    foreground: '#fafafa',
    muted: '#262626',
    mutedForeground: '#a1a1a1',
    primary: '#e5e5e5',
    primaryForeground: '#171717',
  },
  light: {
    background: '#ffffff',
    border: '#e5e5e5',
    foreground: '#0a0a0a',
    muted: '#f5f5f5',
    mutedForeground: '#696969',
    primary: '#171717',
    primaryForeground: '#fafafa',
  },
};

export function useColors() {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function useNavigationTheme() {
  const dark = useColorScheme() === 'dark';

  const base = dark ? DarkTheme : DefaultTheme;

  const colors = palettes[dark ? 'dark' : 'light'];

  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      border: colors.border,
      card: colors.background,
      primary: colors.foreground,
      text: colors.foreground,
    },
  };
}
