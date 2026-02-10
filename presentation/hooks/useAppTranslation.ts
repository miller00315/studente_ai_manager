import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { 
  changeLanguage, 
  getCurrentLanguage, 
  getLanguageInfo, 
  SUPPORTED_LANGUAGES,
  type SupportedLanguage 
} from '../../i18n';

/**
 * Custom hook for translations with additional helpers
 * 
 * @example
 * const { t, language, setLanguage, languages } = useAppTranslation();
 * 
 * // Use translations
 * <h1>{t('test.title')}</h1>
 * 
 * // Change language
 * setLanguage('en');
 * 
 * // Get current language info
 * // Example: language.name returns "English"
 */
export const useAppTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  // Current language info
  const language = getLanguageInfo(i18n.language as SupportedLanguage);
  const currentLanguageCode = getCurrentLanguage();

  // Change language handler
  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
  }, []);

  // Get all supported languages as array
  const languages = Object.values(SUPPORTED_LANGUAGES);

  // Check if current language matches
  const isLanguage = useCallback((lang: SupportedLanguage) => {
    return currentLanguageCode === lang;
  }, [currentLanguageCode]);

  return {
    // Core translation function
    t,
    
    // i18n instance for advanced usage
    i18n,
    
    // Current language info
    language,
    currentLanguageCode,
    
    // Language management
    setLanguage,
    languages,
    isLanguage,
    
    // Constants
    SUPPORTED_LANGUAGES,
  };
};

export default useAppTranslation;

