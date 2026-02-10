import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'edutest-theme';

/**
 * Hook para gerenciar tema claro/escuro
 * 
 * @example
 * const { theme, toggleTheme, setTheme } = useTheme();
 * 
 * // Usar tema
 * <div className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>
 * 
 * // Alternar tema
 * <button onClick={toggleTheme}>Toggle Theme</button>
 */
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Verificar localStorage primeiro
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    
    // Verificar preferência do sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    // Padrão: light
    return 'light';
  });

  // Aplicar tema ao documento
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Salvar no localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Alternar entre temas
  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Definir tema específico
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
};

export default useTheme;
