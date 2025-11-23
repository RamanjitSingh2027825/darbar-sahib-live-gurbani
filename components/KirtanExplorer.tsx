import React, { useEffect, useState } from 'react';
import { 
  Folder, Music, ArrowLeft, Loader2, X, 
  Calendar, User, Play, Search 
} from 'lucide-react';
import { fetchDirectory, KIRTAN_BASE, RAGIWISE_BASE, DirectoryEntry } from '../services/sgpcService';

interface KirtanExplorerProps {
  onClose: () => void;
  onPlayTrack: (trackUrl: string, trackName: string, playlist: DirectoryEntry[]) => void;
}

type Tab = 'years' | 'ragis';

const KirtanExplorer: React.FC<KirtanExplorerProps> = ({ onClose, onPlayTrack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('years');
  const [currentPath, setCurrentPath] = useState<string>(KIRTAN_BASE);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Load
  useEffect(() => {
    loadPath(activeTab === 'years' ? KIRTAN_BASE : RAGIWISE_BASE);
    setHistory([]);
    setSearchQuery(''); // Clear search on tab change
  }, [activeTab]);

  // Clear search when navigating folders
  useEffect(() => {
      setSearchQuery('');
  }, [currentPath]);

  const loadPath = async (url: string) => {
    setLoading(true);
    const data = await fetchDirectory(url);
    // Sort: Folders first, then files
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
        // Pass the filtered list (or full list) as playlist? 
        // Usually full list of current directory is better for "Next" button context
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

  // Filter Entries based on Search
  const filteredEntries = entries.filter(entry => {
      if (!searchQuery) return true;
      const displayName = decodeURIComponent(entry.name).replace('.mp3', '');
      return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
           <Music className="w-5 h-5 text-amber-500" />
           Past Kirtan
        </h2>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tabs (Only show at root) */}
      {history.length === 0 && (
        <div className="flex p-2 gap-2 bg-slate-900/50">
          <button 
            onClick={() => setActiveTab('years')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'years' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
          >
            <Calendar className="w-4 h-4" /> By Year
          </button>
          <button 
            onClick={() => setActiveTab('ragis')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'ragis' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}
          >
            <User className="w-4 h-4" /> By Ragi
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-3 py-2 bg-slate-900/30 border-b border-slate-800">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                  type="text"
                  placeholder={`Search ${activeTab === 'ragis' && history.length === 0 ? 'Ragis' : 'tracks'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-sm rounded-full py-2 pl-9 pr-4 focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600"
              />
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-slate-700 rounded-full text-slate-300"
                  >
                      <X className="w-3 h-3" />
                  </button>
              )}
          </div>
      </div>

      {/* Breadcrumb / Back Navigation */}
      {history.length > 0 && (
         <div className="px-4 py-2 bg-slate-900/30 flex items-center gap-2 border-b border-slate-800">
            <button onClick={handleBack} className="p-1 rounded hover:bg-slate-800 text-amber-400">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs text-slate-500 truncate font-mono">
                .../{decodeURIComponent(currentPath.split('/').filter(Boolean).pop() || '')}
            </span>
         </div>
      )}

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-xs">Fetching from SGPC...</p>
            </div>
        ) : (
            <div className="space-y-1">
                {filteredEntries.map((entry, idx) => (
                    <button
                        key={idx + entry.name}
                        onClick={() => handleEntryClick(entry)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all group text-left"
                    >
                        <div className={`p-2 rounded-full ${entry.is_file ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'}`}>
                            {entry.is_file ? <Play className="w-4 h-4 fill-current" /> : <Folder className="w-4 h-4 fill-current" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                                {/* Display Name Cleaned up */}
                                {decodeURIComponent(entry.name).replace('.mp3', '')}
                            </p>
                            <p className="text-[10px] text-slate-500">
                                {entry.is_file ? 'Audio File' : 'Folder'}
                            </p>
                        </div>
                    </button>
                ))}
                
                {filteredEntries.length === 0 && !loading && (
                    <div className="text-center p-8 text-slate-500 text-sm flex flex-col items-center">
                        {searchQuery ? (
                            <>
                                <span className="mb-1">No results found for "{searchQuery}"</span>
                                <button onClick={() => setSearchQuery('')} className="text-amber-500 text-xs underline">Clear Search</button>
                            </>
                        ) : (
                           "Empty Directory"
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default KirtanExplorer;