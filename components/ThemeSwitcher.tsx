import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../presentation/hooks/useTheme';

interface ThemeSwitcherProps {
  variant?: 'compact' | 'full';
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'compact', className = '' }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} ${className}`}
        title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${isDark ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} ${className}`}
    >
      {isDark ? (
        <>
          <Sun size={18} />
          <span>Tema Claro</span>
        </>
      ) : (
        <>
          <Moon size={18} />
          <span>Tema Escuro</span>
        </>
      )}
    </button>
  );
};

export default ThemeSwitcher;
