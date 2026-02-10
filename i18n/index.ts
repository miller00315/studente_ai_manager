import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { ptBR, en, es } from './locales';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = {
  'pt-BR': {
    code: 'pt-BR',
    name: 'Português (Brasil)',
    flag: '🇧🇷',
    shortName: 'PT',
  },
  'en': {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
    shortName: 'EN',
  },
  'es': {
    code: 'es',
    name: 'Español',
    flag: '🇪🇸',
    shortName: 'ES',
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'pt-BR';

// Local storage key for language preference
const LANGUAGE_STORAGE_KEY = 'edutest_language';

// Get stored language or detect from browser
const getInitialLanguage = (): SupportedLanguage => {
  // Check localStorage first
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && stored in SUPPORTED_LANGUAGES) {
    return stored as SupportedLanguage;
  }
  
  // Detect from browser
  const browserLang = navigator.language;
  
  // Check for exact match
  if (browserLang in SUPPORTED_LANGUAGES) {
    return browserLang as SupportedLanguage;
  }
  
  // Check for partial match (e.g., 'pt' matches 'pt-BR')
  const langPrefix = browserLang.split('-')[0];
  if (langPrefix === 'pt') return 'pt-BR';
  if (langPrefix === 'en') return 'en';
  if (langPrefix === 'es') return 'es';
  
  return DEFAULT_LANGUAGE;
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'en': { translation: en },
      'es': { translation: es },
    },
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    
    // Detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // React-specific options
    react: {
      useSuspense: false, // Disable suspense for simpler setup
    },

    // Debug mode (only in development)
    debug: import.meta.env.DEV,
  });

// Helper function to change language
export const changeLanguage = (language: SupportedLanguage): Promise<void> => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  return i18n.changeLanguage(language);
};

// Helper to get current language
export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language || DEFAULT_LANGUAGE) as SupportedLanguage;
};

// Helper to get language info
export const getLanguageInfo = (code?: SupportedLanguage) => {
  const lang = code || getCurrentLanguage();
  return SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
};

// Export configured i18n instance
export default i18n;

