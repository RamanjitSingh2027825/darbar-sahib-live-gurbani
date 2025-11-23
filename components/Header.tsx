import React from 'react';
import { Music } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

const Header: React.FC = () => {
  const { theme } = useTheme();

  return (
    <header className={`w-full pt-14 pb-4 px-6 backdrop-blur-md border-b sticky top-0 z-50 transition-colors duration-300 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        
        {/* Logo Area */}
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full transition-colors ${theme.colors.iconBg}`}>
            <Music className={`w-5 h-5 ${theme.colors.accent}`} />
          </div>
          <h1 className={`text-xl font-bold tracking-tight transition-colors ${theme.colors.textMain}`}>
            Darbar Sahib <span className={`font-light ${theme.colors.accent}`}>Live</span>
          </h1>
        </div>

        {/* New Animated Switcher */}
        <ThemeSwitcher />

      </div>
    </header>
  );
};

export default Header;