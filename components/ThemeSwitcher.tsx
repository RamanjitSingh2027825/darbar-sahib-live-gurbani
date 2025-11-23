import React, { useState } from 'react';
import { Palette, Crown, Sun, Moon, Flame } from 'lucide-react'; // Crown for Royal, Flame for Harmandir
import { useTheme, themes } from '../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { theme, setThemeId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themeIcons = {
    royal:     { icon: Crown, bg: 'bg-[#0b1221]', border: 'border-amber-900' },
    bliss:     { icon: Sun, bg: 'bg-[#fffbf2]', border: 'border-orange-200' },
    harmandir: { icon: Flame, bg: 'bg-[#1a1408]', border: 'border-yellow-900' },
    midnight:  { icon: Moon, bg: 'bg-slate-950', border: 'border-slate-800' }
  };

  return (
    <div className="relative flex items-center z-50">
      <div 
        className={`absolute right-0 flex items-center gap-3 p-2 pr-14 rounded-full border backdrop-blur-xl transition-all duration-500 ease-out origin-right overflow-hidden z-20
          ${isOpen ? 'w-[220px] opacity-100 shadow-xl' : 'w-10 opacity-0 pointer-events-none'}
          ${theme.colors.cardBg} ${theme.colors.cardBorder}
        `}
      >
        {Object.entries(themes).map(([key, t]) => {
           // @ts-ignore
           const conf = themeIcons[key] || themeIcons.royal;
           const Icon = conf.icon;
           const isActive = theme.id === key;
           
           return (
             <button
               key={key}
               onClick={(e) => { e.stopPropagation(); setThemeId(key as any); setIsOpen(false); }}
               className={`relative group transition-all duration-300 ${isActive ? 'scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
               title={t.name}
             >
               <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-sm ${conf.bg} ${conf.border} ${isActive ? `ring-2 ring-offset-2 ring-${theme.colors.accent.split('-')[1]}-500 ring-offset-black` : ''}`}>
                  <Icon className={`w-4 h-4 ${theme.colors.textMain}`} />
               </div>
             </button>
           );
        })}
      </div>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full shadow-lg transition-all duration-500 z-10 
          ${isOpen ? 'rotate-180 bg-slate-800 text-white' : `${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}
        `}
      >
        <Palette className="w-5 h-5" />
      </button>

      {isOpen && <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default ThemeSwitcher;