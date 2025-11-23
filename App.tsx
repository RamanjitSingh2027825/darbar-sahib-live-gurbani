import React from 'react';
import Header from './components/Header';
import AudioPlayer from './components/AudioPlayer';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const AppContent: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={`h-[100dvh] w-full relative overflow-hidden transition-colors duration-700 ${theme.colors.appBg} ${theme.colors.textMain}`}>
      
      {/* 1. Base Background Image (Slightly visible) */}
      <div 
        className={`absolute inset-0 z-0 transition-opacity duration-1000 ${theme.type === 'light' ? 'opacity-[0.03]' : 'opacity-[0.15]'}`}
        style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1564101169894-2c2d1a74523f?q=80&w=2574&auto=format&fit=crop')`, 
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) blur(2px)' // Grayscale to match theme colors better
        }}
      />
      
      {/* 2. Texture Overlay (Grain) - Adds "Paper/Fabric" feel */}
      <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

      {/* 3. Gradient Tint */}
      <div className={`absolute inset-0 z-0 bg-gradient-to-b from-transparent via-${theme.colors.appBg.split('-')[1]}/50 to-${theme.colors.appBg.split('-')[1]} pointer-events-none`} />

      <div className="relative z-10 flex flex-col h-full w-full">
        <div className="shrink-0">
            <Header />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full flex flex-col justify-center">
          <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-8">
            <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className={`text-3xl md:text-5xl font-serif font-medium leading-tight ${theme.colors.textMain}`}>
                    Connect with the <br/>
                    <span className={`italic ${theme.colors.accent}`}>Divine Spirit</span>
                </h2>
            </div>
            
            <AudioPlayer />
          </div>
        </main>

        <footer className={`shrink-0 pt-4 pb-8 text-center text-[10px] uppercase tracking-widest opacity-40 ${theme.colors.textMain}`}>
            <p>Darbar Sahib Live Viewer</p>
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;