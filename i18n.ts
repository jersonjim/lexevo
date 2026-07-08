import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

export const LANG_KEY = 'app_language';
export type Lang = 'es' | 'en' | 'pt';

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'es';
const defaultLang: Lang = deviceLang === 'en' ? 'en' : deviceLang === 'pt' ? 'pt' : 'es';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    pt: { translation: pt },
  },
  lng: defaultLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export async function applyStoredLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(LANG_KEY);
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
}

export async function setLanguage(lang: Lang): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
