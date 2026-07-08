import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  card: string;
  surface: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  separator: string;
};

export const LIGHT: ThemeColors = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#F1F5F9',
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  separator: '#F1F5F9',
};

export const DARK: ThemeColors = {
  bg: '#0F172A',
  card: '#1E293B',
  surface: '#0F172A',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  separator: '#1E293B',
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: LIGHT,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(v => {
      if (v === 'dark' || v === 'light') setMode(v);
    });
  }, []);

  function toggleTheme() {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    AsyncStorage.setItem('app_theme', next);
  }

  return (
    <ThemeContext.Provider value={{ mode, colors: mode === 'light' ? LIGHT : DARK, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
