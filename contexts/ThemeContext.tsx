import React, { createContext, useContext, useState, useEffect } from 'react';

export const themes = {
  royal: {
    id: 'royal',
    name: 'Khalsa (Royal)',
    type: 'dark',
    colors: {
      appBg: 'bg-[#0b1221]', // Deep Navy
      textMain: 'text-amber-50', // Cream Text
      textSub: 'text-slate-400',
      cardBg: 'bg-[#131c31]/90',
      cardBorder: 'border-amber-900/30',
      accent: 'text-amber-400', // Gold
      accentBg: 'bg-amber-500',
      iconBg: 'bg-[#1e293b]',
      hover: 'hover:bg-[#1e293b]',
      sliderTrack: 'bg-[#1e293b]'
    }
  },
  bliss: {
    id: 'bliss',
    name: 'Sahaj (Peace)',
    type: 'light',
    colors: {
      appBg: 'bg-[#fffbf2]', // Warm Cream
      textMain: 'text-[#4a4036]', // Deep Brown
      textSub: 'text-[#8c8273]',
      cardBg: 'bg-[#ffffff]/80',
      cardBorder: 'border-orange-100',
      accent: 'text-orange-600', // Saffron
      accentBg: 'bg-orange-500',
      iconBg: 'bg-orange-50',
      hover: 'hover:bg-orange-100',
      sliderTrack: 'bg-stone-200'
    }
  },
  harmandir: {
    id: 'harmandir',
    name: 'Harmandir (Gold)',
    type: 'dark',
    colors: {
      appBg: 'bg-[#1a1408]', // Deep Brown-Black
      textMain: 'text-amber-100',
      textSub: 'text-amber-800/60',
      cardBg: 'bg-[#292010]/90',
      cardBorder: 'border-amber-900/50',
      accent: 'text-yellow-400',
      accentBg: 'bg-yellow-500',
      iconBg: 'bg-[#3d301a]',
      hover: 'hover:bg-[#3d301a]',
      sliderTrack: 'bg-[#3d301a]'
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight (Simple)',
    type: 'dark',
    colors: {
      appBg: 'bg-[#020617]',
      textMain: 'text-slate-200',
      textSub: 'text-slate-500',
      cardBg: 'bg-slate-900/80',
      cardBorder: 'border-slate-800',
      accent: 'text-indigo-400',
      accentBg: 'bg-indigo-500',
      iconBg: 'bg-slate-800/50',
      hover: 'hover:bg-slate-800',
      sliderTrack: 'bg-slate-700'
    }
  }
};

export type ThemeConfig = typeof themes.royal;

interface ThemeContextType {
  theme: ThemeConfig;
  setThemeId: (id: keyof typeof themes) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themes.royal); // Default to Royal

  useEffect(() => {
    const saved = localStorage.getItem('app_theme');
    // @ts-ignore
    if (saved && themes[saved]) setCurrentTheme(themes[saved]);
  }, []);

  const setThemeId = (id: keyof typeof themes) => {
    setCurrentTheme(themes[id]);
    localStorage.setItem('app_theme', id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themes[id].type === 'dark' ? '#000000' : '#ffffff');
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