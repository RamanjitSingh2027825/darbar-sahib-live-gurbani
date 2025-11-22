import React from 'react';
import Header from './components/Header';
import AudioPlayer from './components/AudioPlayer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 relative selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Background Abstract Image */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1564101169894-2c2d1a74523f?q=80&w=2574&auto=format&fit=crop')`, // Golden Temple abstract/night shot
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) saturate(0)' // Desaturated blur for focus
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 md:py-12 flex flex-col items-center gap-12">
          
          {/* Main Content Area */}
          <section className="w-full max-w-2xl flex flex-col gap-8 items-center">
            <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-100 leading-tight">
                    Connect with the <br/>
                    <span className="text-amber-400">Divine Spirit</span>
                </h2>
                <p className="text-slate-400 text-lg font-light max-w-md mx-auto">
                    Experience the peace of Sri Darbar Sahib, Amritsar. Listen to the continuous stream of Gurbani Kirtan.
                </p>
            </div>
            
            <AudioPlayer />
          </section>

        </main>

        <footer className="py-6 text-center text-slate-600 text-xs relative z-10">
            <p>© {new Date().getFullYear()} Darbar Sahib Live Viewer. Unofficial App.</p>
            <p className="mt-1">Stream source: SGPC.net</p>
        </footer>
      </div>
    </div>
  );
};

export default App;