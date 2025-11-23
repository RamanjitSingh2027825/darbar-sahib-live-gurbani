import React from 'react';
import Header from './components/Header';
import AudioPlayer from './components/AudioPlayer';

const App: React.FC = () => {
  return (
    // 1. LOCK THE WINDOW: Use h-[100dvh] to fit mobile screen exactly (no URL bar scroll issues)
    // 2. PREVENT SCROLL: overflow-hidden stops the "bounce" effect
    <div className="h-[100dvh] w-full bg-[#020617] text-slate-200 relative overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Fixed Background (Will not scroll anymore) */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1564101169894-2c2d1a74523f?q=80&w=2574&auto=format&fit=crop')`, 
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) saturate(0)' 
        }}
      />
      
      {/* Fixed Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 pointer-events-none" />

      {/* Flex Layout: Header Top, Footer Bottom, Content Middle */}
      <div className="relative z-10 flex flex-col h-full w-full">
        
        {/* Fixed Header */}
        <div className="shrink-0">
            <Header />
        </div>

        {/* Scrollable Main Content Area 
            - flex-1: Takes all available space
            - overflow-y-auto: Allows ONLY this middle part to scroll if player is too big
            - scrollbar-hide: Cleaner look
        */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          <div className="container mx-auto px-4 py-4 min-h-full flex flex-col items-center justify-center gap-6">
            
            <section className="w-full max-w-2xl flex flex-col gap-6 items-center py-4">
                <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl md:text-4xl font-serif font-bold text-slate-100 leading-tight">
                        Connect with the <br/>
                        <span className="text-amber-400">Divine Spirit</span>
                    </h2>
                    <p className="text-slate-400 text-sm md:text-base font-light max-w-xs mx-auto">
                        Live Gurbani Kirtan from Sri Harmandir Sahib.
                    </p>
                </div>
                
                <AudioPlayer />
            </section>

          </div>
        </main>

        {/* Fixed Footer */}
        <footer className="shrink-0 pt-4 pb-8 text-center text-slate-600 text-[10px] relative z-10 bg-gradient-to-t from-[#020617] to-transparent">
            <p>© {new Date().getFullYear()} Darbar Sahib Live Kirtan. By Ramanjit Singh.</p>
            <p className="mt-1">Stream source: SGPC.net</p>
        </footer>

      </div>
    </div>
  );
};

export default App;