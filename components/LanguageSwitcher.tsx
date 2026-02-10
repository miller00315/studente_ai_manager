import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import type { SupportedLanguage } from '../i18n';

interface LanguageSwitcherProps {
  /** Display style variant */
  variant?: 'default' | 'compact' | 'minimal';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Language Switcher Component
 * 
 * Provides a dropdown to switch between supported languages.
 * The selected language is persisted in localStorage.
 * 
 * @example
 * // Default style with full names
 * <LanguageSwitcher />
 * 
 * // Compact style with short names
 * <LanguageSwitcher variant="compact" />
 * 
 * // Minimal style with just the flag
 * <LanguageSwitcher variant="minimal" />
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'default',
  className = ''
}) => {
  const { language, languages, setLanguage, t } = useAppTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLanguageChange = async (langCode: SupportedLanguage) => {
    await setLanguage(langCode);
    setIsOpen(false);
  };

  // Render button content based on variant
  const renderButtonContent = () => {
    switch (variant) {
      case 'minimal':
        return (
          <span className="text-lg">{language.flag}</span>
        );
      case 'compact':
        return (
          <>
            <span className="text-lg">{language.flag}</span>
            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{language.shortName}</span>
          </>
        );
      default:
        return (
          <>
            <Globe size={18} className="text-slate-500 dark:text-slate-400" />
            <span className="text-lg">{language.flag}</span>
            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{language.name}</span>
          </>
        );
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 
          hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600
          focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-1 dark:focus:ring-offset-slate-800
          ${isOpen ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-1 dark:ring-offset-slate-800' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('settings.language')}
      >
        {renderButtonContent()}
        <ChevronDown 
          size={16} 
          className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
          role="listbox"
          aria-label={t('settings.language')}
        >
          <div className="py-1">
            {languages.map((lang) => {
              const isSelected = lang.code === language.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleLanguageChange(lang.code as SupportedLanguage)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="flex-1 font-medium">{lang.name}</span>
                  {isSelected && (
                    <Check size={16} className="text-indigo-600 dark:text-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;

