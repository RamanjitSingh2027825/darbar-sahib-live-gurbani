import React, { useEffect, useState } from 'react';
import { X, Heart, Play, Trash2, Radio, Globe, FileAudio } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext'; // IMPORT THEME

export interface FavoriteItem {
  id: string;
  title: string;
  type: 'live' | 'local' | 'remote';
  url: string;
  date: number;
}

interface FavoritesListProps {
  onClose: () => void;
  onPlay: (item: FavoriteItem) => void;
}

const FavoritesList: React.FC<FavoritesListProps> = ({ onClose, onPlay }) => {
  const { theme } = useTheme(); // USE THEME
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => { loadFavorites(); }, []);

  const loadFavorites = () => {
    try {
      const stored = localStorage.getItem('darbar_favorites');
      if (stored) {
          const parsed = JSON.parse(stored) as FavoriteItem[];
          setFavorites(parsed.sort((a, b) => b.date - a.date));
      }
    } catch (e) { console.error(e); }
  };

  const removeFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('darbar_favorites', JSON.stringify(updated));
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'live': return <Radio className="w-4 h-4" />;
          case 'local': return <FileAudio className="w-4 h-4" />;
          case 'remote': return <Globe className="w-4 h-4" />;
          default: return <Play className="w-4 h-4" />;
      }
  };

  return (
    <div className={`absolute inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 ${theme.colors.appBg}`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
        <h2 className={`text-lg font-bold flex items-center gap-2 ${theme.colors.textMain}`}>
           <Heart className="w-5 h-5 text-red-500 fill-current" />
           Liked Items
        </h2>
        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {favorites.length === 0 ? (
            <div className={`text-center p-12 text-sm flex flex-col items-center gap-2 ${theme.colors.textSub}`}>
                <Heart className="w-8 h-8 opacity-50" />
                <p>No liked items yet.</p>
            </div>
        ) : (
            favorites.map((item) => (
                <div key={item.id} onClick={() => onPlay(item)} className={`w-full flex items-center gap-3 p-3 rounded-xl border active:scale-[0.98] transition-transform cursor-pointer group ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
                    <div className={`p-3 rounded-full ${item.type === 'live' ? 'bg-red-500/10 text-red-500' : `${theme.colors.iconBg} ${theme.colors.accent}`}`}>
                        {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-medium truncate ${theme.colors.textMain}`}>{item.title}</p>
                        <div className={`flex items-center gap-2 text-[10px] uppercase tracking-wider ${theme.colors.textSub}`}>
                            <span>{item.type}</span>
                            <span>•</span>
                            <span>{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={(e) => removeFavorite(e, item.id)} className={`p-2 transition-colors ${theme.colors.textSub} hover:text-red-400`}>
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default FavoritesList;