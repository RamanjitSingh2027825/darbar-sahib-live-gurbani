import React, { createContext, useContext, useState, useEffect } from 'react';

// Define available themes and their Tailwind classes
export const themes = {
  midnight: {
    id: 'midnight',
    name: 'Midnight (Default)',
    type: 'dark',
    colors: {
      appBg: 'bg-[#020617]',
      textMain: 'text-slate-200',
      textSub: 'text-slate-500',
      cardBg: 'bg-slate-900/80',
      cardBorder: 'border-slate-800',
      accent: 'text-amber-400',
      accentBg: 'bg-amber-500',
      iconBg: 'bg-slate-800/50',
      hover: 'hover:bg-slate-800',
      sliderTrack: 'bg-slate-700'
    }
  },
  light: {
    id: 'light',
    name: 'Daylight',
    type: 'light',
    colors: {
      appBg: 'bg-slate-50',
      textMain: 'text-slate-900',
      textSub: 'text-slate-500',
      cardBg: 'bg-white/80',
      cardBorder: 'border-slate-200',
      accent: 'text-blue-600',
      accentBg: 'bg-blue-600',
      iconBg: 'bg-slate-200/50',
      hover: 'hover:bg-slate-200',
      sliderTrack: 'bg-slate-200'
    }
  },
  amoled: {
    id: 'amoled',
    name: 'Amoled Black',
    type: 'dark',
    colors: {
      appBg: 'bg-black',
      textMain: 'text-white',
      textSub: 'text-neutral-500',
      cardBg: 'bg-neutral-900/90',
      cardBorder: 'border-neutral-800',
      accent: 'text-rose-500',
      accentBg: 'bg-rose-600',
      iconBg: 'bg-neutral-800',
      hover: 'hover:bg-neutral-800',
      sliderTrack: 'bg-neutral-800'
    }
  },
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    type: 'dark',
    colors: {
      appBg: 'bg-emerald-950',
      textMain: 'text-emerald-100',
      textSub: 'text-emerald-600/70',
      cardBg: 'bg-emerald-900/60',
      cardBorder: 'border-emerald-800',
      accent: 'text-emerald-400',
      accentBg: 'bg-emerald-500',
      iconBg: 'bg-emerald-900',
      hover: 'hover:bg-emerald-800',
      sliderTrack: 'bg-emerald-900'
    }
  }
};

export type ThemeConfig = typeof themes.midnight;

interface ThemeContextType {
  theme: ThemeConfig;
  setThemeId: (id: keyof typeof themes) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themes.midnight);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved && saved in themes) {
      // @ts-ignore
      setCurrentTheme(themes[saved]);
    }
  }, []);

  const setThemeId = (id: keyof typeof themes) => {
    const newTheme = themes[id];
    setCurrentTheme(newTheme);
    localStorage.setItem('app_theme', id);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newTheme.type === 'dark' ? '#020617' : '#ffffff');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};