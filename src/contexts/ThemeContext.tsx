
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeSetting = 'system' | 'light' | 'dark';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeSetting;
  storageKey?: string;
}

interface ThemeContextType {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'hiwewalk-theme', // Updated storage key
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeSetting>(() => {
    if (typeof window !== 'undefined') {
      try {
        return (localStorage.getItem(storageKey) as ThemeSetting) || defaultTheme;
      } catch (e) {
        console.error('Error reading theme from localStorage', e);
        return defaultTheme;
      }
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light'; // SSR fallback for system
    }
    return theme;
  });


  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');

    let currentResolvedMode: 'light' | 'dark';

    if (theme === 'system') {
      currentResolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      currentResolvedMode = theme;
    }
    
    root.classList.add(currentResolvedMode);
    setResolvedTheme(currentResolvedMode);

  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeSetting) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch (e) {
        console.error('Error saving theme to localStorage', e);
      }
    }
    setThemeState(newTheme);
  }, [storageKey]);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // When system theme changes, re-trigger the effect that applies the correct class
      setThemeState('system'); 
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
