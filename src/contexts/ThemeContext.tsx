
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type ThemeSetting = 'system' | 'light' | 'dark' | 'forest-light' | 'forest-dark' | 'ocean-light' | 'ocean-dark';

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
  storageKey = 'sohbet-kuresi-theme', // Updated storage key
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

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;
    
    const allThemeClasses = ['light', 'dark', 'theme-forest-light', 'theme-forest-dark', 'theme-ocean-light', 'theme-ocean-dark'];
    root.classList.remove(...allThemeClasses);

    let currentResolvedMode: 'light' | 'dark';
    let classToApplyToRoot: string;

    if (theme === 'system') {
      const systemMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      currentResolvedMode = systemMode;
      classToApplyToRoot = systemMode; 
    } else if (theme === 'light' || theme === 'dark') {
      currentResolvedMode = theme;
      classToApplyToRoot = theme; 
    } else { 
      classToApplyToRoot = theme; 
      if (theme.endsWith('-dark')) {
        currentResolvedMode = 'dark';
        root.classList.add('dark'); 
      } else { // ends with '-light'
        currentResolvedMode = 'light';
        root.classList.add('light'); 
      }
    }
    
    root.classList.add(classToApplyToRoot);
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

  // Handle system theme changes
  useEffect(() => {
    if (theme !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Re-evaluate system theme by setting it to 'system', which triggers the main useEffect
      setThemeState('system'); 
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]); // Only re-run if theme itself changes to/from system
  

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
