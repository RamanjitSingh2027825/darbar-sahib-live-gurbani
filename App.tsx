import React from 'react';
import Header from './components/Header';
import AudioPlayer from './components/AudioPlayer';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Separate component to consume the Theme Context
const AppContent: React.FC = () => {
  const { theme } = useTheme();

  return (
    // DYNAMIC CLASSES HERE: ${theme.colors.appBg} and ${theme.colors.textMain}
    <div className={`h-[100dvh] w-full relative overflow-hidden transition-colors duration-500 ${theme.colors.appBg} ${theme.colors.textMain}`}>
      
      {/* Fixed Background Image (Fades out in light mode) */}
      <div 
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ${theme.type === 'light' ? 'opacity-5' : 'opacity-20'}`}
        style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1564101169894-2c2d1a74523f?q=80&w=2574&auto=format&fit=crop')`, 
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) saturate(0)' 
        }}
      />
      
      {/* Gradient Tint */}
      <div className={`absolute inset-0 z-0 bg-gradient-to-b from-transparent to-current pointer-events-none opacity-80 ${theme.colors.appBg.replace('bg-', 'text-')}`} />

      <div className="relative z-10 flex flex-col h-full w-full">
        <div className="shrink-0">
            <Header />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          <div className="container mx-auto px-4 py-4 min-h-full flex flex-col items-center justify-center gap-6">
            <section className="w-full max-w-2xl flex flex-col gap-6 items-center py-4">
                <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className={`text-2xl md:text-4xl font-serif font-bold leading-tight ${theme.colors.textMain}`}>
                        Connect with the <br/>
                        <span className={theme.colors.accent}>Divine Spirit</span>
                    </h2>
                    <p className={`text-sm md:text-base font-light max-w-xs mx-auto ${theme.colors.textSub}`}>
                        Live Gurbani Kirtan from Sri Harmandir Sahib.
                    </p>
                </div>
                
                <AudioPlayer />
            </section>
          </div>
        </main>

        <footer className="shrink-0 pt-4 pb-8 text-center text-[10px] relative z-10 opacity-60">
            <p>© {new Date().getFullYear()} Darbar Sahib Live Viewer. Unofficial App.</p>
            <p className="mt-1">Stream source: SGPC.net</p>
        </footer>
      </div>
    </div>
  );
};

// Main App Wrapper
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;