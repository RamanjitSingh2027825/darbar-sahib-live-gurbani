import React, { useState } from 'react';
import { Palette, Moon, Sun, Smartphone, Trees } from 'lucide-react';
import { useTheme, themes } from '../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { theme, setThemeId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Visual config for each theme icon
  const themeIcons = {
    midnight: { icon: Moon, bg: 'bg-[#020617]', border: 'border-slate-700' },
    light:    { icon: Sun, bg: 'bg-slate-100', border: 'border-slate-300' },
    amoled:   { icon: Smartphone, bg: 'bg-black', border: 'border-neutral-800' },
    forest:   { icon: Trees, bg: 'bg-emerald-950', border: 'border-emerald-800' }
  };

  return (
    <div className="relative flex items-center z-50">
      
      {/* Animated Options Container */}
      <div 
        className={`absolute right-0 flex items-center gap-3 p-2 pr-14 rounded-full border backdrop-blur-xl transition-all duration-500 ease-out origin-right overflow-hidden z-20
          ${isOpen ? 'w-[220px] opacity-100 shadow-xl' : 'w-10 opacity-0 pointer-events-none'}
          ${theme.colors.cardBg} ${theme.colors.cardBorder}
        `}
      >
        {Object.entries(themes).map(([key, t]) => {
           // @ts-ignore
           const conf = themeIcons[key] || themeIcons.midnight;
           const Icon = conf.icon;
           const isActive = theme.id === key;
           
           // Safe dynamic ring color handling
           const ringColorClass = theme.colors.accent.includes('amber') ? 'ring-amber-500' :
                                  theme.colors.accent.includes('blue') ? 'ring-blue-600' :
                                  theme.colors.accent.includes('rose') ? 'ring-rose-500' :
                                  theme.colors.accent.includes('emerald') ? 'ring-emerald-500' : 'ring-slate-500';

           return (
             <button
               key={key}
               onClick={(e) => { 
                   e.stopPropagation(); // Prevent click bubbling
                   setThemeId(key as any); 
                   setIsOpen(false); 
               }}
               className={`relative group transition-all duration-300 ${isActive ? 'scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
               title={t.name}
             >
               {/* Theme Circle Preview */}
               <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-sm ${conf.bg} ${conf.border} ${isActive ? `ring-2 ring-offset-2 ${ringColorClass} ring-offset-slate-900` : ''}`}>
                  <Icon className={`w-4 h-4 ${key === 'light' ? 'text-slate-600' : 'text-slate-400'}`} />
               </div>
             </button>
           );
        })}
      </div>

      {/* Main Toggle Button (Always Visible) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full shadow-lg transition-all duration-500 z-10 
          ${isOpen ? 'rotate-180 bg-slate-800 text-white' : `${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}
        `}
      >
        <Palette className="w-5 h-5" />
      </button>

      {/* Invisible Backdrop to close when clicking outside */}
      {isOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default ThemeSwitcher;