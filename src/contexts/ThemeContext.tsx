import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Main backgrounds
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  
  // Canvas
  canvasBg: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Interactive elements
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Accent colors
  primary: string;
  primaryHover: string;
}

const lightTheme: ThemeColors = {
  bg: '#ffffff',
  bgSecondary: '#f1f5f9', // Slightly darker for better contrast
  bgTertiary: '#e2e8f0', // More contrast
  canvasBg: '#ffffff',
  text: '#0f172a', // Darker text for better contrast
  textSecondary: '#475569', // Better contrast
  textMuted: '#64748b',
  border: '#cbd5e1', // More visible border
  borderLight: '#e2e8f0',
  buttonBg: '#f1f5f9', // Better contrast
  buttonHover: '#e2e8f0', // More noticeable hover
  buttonText: '#334155', // Darker button text
  success: '#059669', // Slightly darker green
  warning: '#d97706', // Slightly darker orange  
  error: '#dc2626', // Slightly darker red
  info: '#2563eb', // Darker blue
  primary: '#2563eb', // Darker primary
  primaryHover: '#1d4ed8',
};

const darkTheme: ThemeColors = {
  bg: '#111827',
  bgSecondary: '#1f2937',
  bgTertiary: '#374151',
  canvasBg: '#1f2937',
  text: '#f9fafb',
  textSecondary: '#e5e7eb',
  textMuted: '#9ca3af',
  border: '#374151',
  borderLight: '#4b5563',
  buttonBg: '#374151',
  buttonHover: '#4b5563',
  buttonText: '#e5e7eb',
  success: '#10b981',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
};

const halloweenTheme: ThemeColors = {
  bg: '#1a0f1a', // Dark purple-black
  bgSecondary: '#2d1b2d', // Darker purple
  bgTertiary: '#4a2c4a', // Medium purple
  canvasBg: '#1a0f1a',
  text: '#ff6b35', // Bright orange
  textSecondary: '#ff8c42', // Lighter orange
  textMuted: '#b8860b', // Dark goldenrod
  border: '#ff6b35', // Orange border
  borderLight: '#ff8c42',
  buttonBg: '#2d1b2d',
  buttonHover: '#4a2c4a',
  buttonText: '#ff6b35',
  success: '#ff6b35', // Orange for success too
  warning: '#ffa500', // Pure orange
  error: '#ff4500', // Red-orange
  info: '#ff8c42',
  primary: '#ff6b35', // Halloween orange
  primaryHover: '#ff4500',
};

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark'; // resolved theme (system becomes light/dark)
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  showFPS: boolean;
  setShowFPS: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  halloweenMode: boolean;
  setHalloweenMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('collabcanvas-theme');
    return (saved as Theme) || 'system';
  });
  
  const [showFPS, setShowFPS] = useState(() => {
    const saved = localStorage.getItem('collabcanvas-show-fps');
    return saved !== null ? saved === 'true' : true; // Default to true if no saved preference
  });
  
  const [showGrid, setShowGrid] = useState(() => {
    const saved = localStorage.getItem('collabcanvas-show-grid');
    return saved === 'true';
  });
  
  const [snapToGrid, setSnapToGrid] = useState(() => {
    const saved = localStorage.getItem('collabcanvas-snap-to-grid');
    return saved === 'true';
  });
  
  const [halloweenMode, setHalloweenModeState] = useState(() => {
    const saved = localStorage.getItem('collabcanvas-halloween-mode');
    return saved === 'true';
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Resolve actual theme
  const actualTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;
  const colors = halloweenMode ? halloweenTheme : (actualTheme === 'dark' ? darkTheme : lightTheme);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', actualTheme);
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
  }, [actualTheme, colors]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('collabcanvas-theme', newTheme);
  };

  const handleSetShowFPS = (show: boolean) => {
    setShowFPS(show);
    localStorage.setItem('collabcanvas-show-fps', show.toString());
  };

  const handleSetShowGrid = (show: boolean) => {
    setShowGrid(show);
    localStorage.setItem('collabcanvas-show-grid', show.toString());
  };
  
  const handleSetSnapToGrid = (snap: boolean) => {
    setSnapToGrid(snap);
    localStorage.setItem('collabcanvas-snap-to-grid', snap.toString());
  };

  const setHalloweenMode = (enabled: boolean) => {
    setHalloweenModeState(enabled);
    localStorage.setItem('collabcanvas-halloween-mode', enabled.toString());
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        actualTheme,
        colors,
        setTheme,
        showFPS,
        setShowFPS: handleSetShowFPS,
        showGrid,
        setShowGrid: handleSetShowGrid,
        snapToGrid,
        setSnapToGrid: handleSetSnapToGrid,
        halloweenMode,
        setHalloweenMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
