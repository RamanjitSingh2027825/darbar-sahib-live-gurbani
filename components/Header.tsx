import React from 'react';
import { Music, Info } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-4 px-6 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <Music className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Darbar Sahib <span className="text-amber-400 font-light">Live</span>
          </h1>
        </div>
        <button 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-amber-200"
            title="About"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;