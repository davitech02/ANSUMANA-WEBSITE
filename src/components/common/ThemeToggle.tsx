import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

interface ThemeToggleProps {
  /** 'dark' matches the public homepage navbar; 'light' matches the portal header. */
  variant?: 'dark' | 'light';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'light' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;

  if (variant === 'dark') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        className="p-2.5 rounded-xl border border-[#D4AF37]/40 bg-[#1A4A3A]/40 hover:bg-[#1A4A3A] text-[#D4AF37] transition-all flex items-center justify-center shadow-xs hover:scale-105"
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-[#0A2E24] hover:bg-gray-100 dark:border-gray-300 dark:text-gray-300 dark:hover:text-[#D4AF37] dark:hover:bg-gray-200 transition-all flex items-center justify-center shadow-2xs"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};