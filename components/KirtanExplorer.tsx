import React, { useEffect, useState } from 'react';
import {
  Folder, Music, ArrowLeft, Loader2, X,
  Calendar, User, Play, Search
} from 'lucide-react';
import { fetchDirectory, KIRTAN_BASE, RAGIWISE_BASE, CLASSIFICATION_BASE, DirectoryEntry } from '../services/sgpcService';
import { useTheme } from '../contexts/ThemeContext'; // IMPORT THEME

interface KirtanExplorerProps {
  onClose: () => void;
  onPlayTrack: (trackUrl: string, trackName: string, playlist: DirectoryEntry[]) => void;
}

type Tab = 'years' | 'ragis' | 'classification';

const KirtanExplorer: React.FC<KirtanExplorerProps> = ({ onClose, onPlayTrack }) => {
  const { theme } = useTheme(); // USE THEME
  const [activeTab, setActiveTab] = useState<Tab>('years');
  const [currentPath, setCurrentPath] = useState<string>(KIRTAN_BASE);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeTab === 'years') loadPath(KIRTAN_BASE);
    else if (activeTab === 'ragis') loadPath(RAGIWISE_BASE);
    else loadPath(CLASSIFICATION_BASE);
    setHistory([]);
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => { setSearchQuery(''); }, [currentPath]);

  const loadPath = async (url: string) => {
    setLoading(true);
    const data = await fetchDirectory(url);
    const sorted = data.sort((a, b) => {
      if (a.is_file === b.is_file) return a.name.localeCompare(b.name);
      return a.is_file ? 1 : -1;
    });
    setEntries(sorted);
    setCurrentPath(url);
    setLoading(false);
  };

  const handleEntryClick = (entry: DirectoryEntry) => {
    if (entry.is_file) {
      if (entry.is_mp3) {
        const playlist = entries.filter(e => e.is_mp3);
        onPlayTrack(entry.url, entry.name, playlist);
      }
    } else {
      setHistory([...history, currentPath]);
      loadPath(entry.url);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      loadPath(prev);
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const displayName = decodeURIComponent(entry.name).replace('.mp3', '');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className={`absolute inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 ${theme.colors.appBg}`}>

      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
        <h2 className={`text-lg font-bold flex items-center gap-2 ${theme.colors.textMain}`}>
          <Music className={`w-5 h-5 ${theme.colors.accent}`} />
          Past Kirtan
        </h2>
        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      {history.length === 0 && (
        <div className={`flex p-2 gap-2 ${theme.colors.cardBg}`}>
          <button
            onClick={() => setActiveTab('years')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'years' ? `${theme.colors.accentBg} text-white` : `${theme.colors.iconBg} ${theme.colors.textSub}`}`}
          >
            <Calendar className="w-4 h-4" /> By Year
          </button>
          <button
            onClick={() => setActiveTab('ragis')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'ragis' ? `${theme.colors.accentBg} text-white` : `${theme.colors.iconBg} ${theme.colors.textSub}`}`}
          >
            <User className="w-4 h-4" /> By Ragi
          </button>
          <button
            onClick={() => setActiveTab('classification')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'classification' ? `${theme.colors.accentBg} text-white` : `${theme.colors.iconBg} ${theme.colors.textSub}`}`}
          >
            <Folder className="w-4 h-4" /> Classification
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className={`px-3 py-2 border-b ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.colors.textSub}`} />
          <input
            type="text"
            placeholder={`Search...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none placeholder:opacity-50 ${theme.colors.appBg} ${theme.colors.cardBorder} ${theme.colors.textMain}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${theme.colors.iconBg} ${theme.colors.textSub}`}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Back Nav */}
      {history.length > 0 && (
        <div className={`px-4 py-2 flex items-center gap-2 border-b ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
          <button onClick={handleBack} className={`p-1 rounded hover:opacity-80 ${theme.colors.accent}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className={`text-xs truncate font-mono ${theme.colors.textSub}`}>
            .../{decodeURIComponent(currentPath.split('/').filter(Boolean).pop() || '')}
          </span>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className={`flex flex-col items-center justify-center h-48 gap-3 ${theme.colors.textSub}`}>
            <Loader2 className={`w-8 h-8 animate-spin ${theme.colors.accent}`} />
            <p className="text-xs">Fetching...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredEntries.map((entry, idx) => (
              <button
                key={idx + entry.name}
                onClick={() => handleEntryClick(entry)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all group text-left ${theme.colors.hover}`}
              >
                <div className={`p-2 rounded-full ${entry.is_file ? `${theme.colors.iconBg} ${theme.colors.textMain}` : `${theme.colors.accent} bg-opacity-10`}`}>
                  {entry.is_file ? <Play className="w-4 h-4 fill-current" /> : <Folder className="w-4 h-4 fill-current" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate transition-colors ${theme.colors.textMain} group-hover:${theme.colors.accent}`}>
                    {decodeURIComponent(entry.name).replace('.mp3', '')}
                  </p>
                  <p className={`text-[10px] ${theme.colors.textSub}`}>
                    {entry.is_file ? 'Audio File' : 'Folder'}
                  </p>
                </div>
              </button>
            ))}
            {filteredEntries.length === 0 && !loading && (
              <div className={`text-center p-8 text-sm ${theme.colors.textSub}`}>
                {searchQuery ? "No results found" : "Empty Directory"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KirtanExplorer;