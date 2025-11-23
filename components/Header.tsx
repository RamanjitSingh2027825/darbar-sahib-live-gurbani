import React, { useState } from 'react';
import { Music, Video, Film, Waves, Sparkles, Camera } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

const Header: React.FC = () => {
  const { theme } = useTheme();
  const [showModeSelector, setShowModeSelector] = useState(false);

  const openSelector = () => setShowModeSelector(true);

  const startRecordingWithMode = (mode: string) => {
    setShowModeSelector(false);
    window.dispatchEvent(
      new CustomEvent('start-video-status', { detail: { mode } })
    );
  };

  return (
    <>
      {/* --- HEADER BAR --- */}
      <header className={`w-full pt-14 pb-4 px-6 backdrop-blur-md border-b sticky top-0 z-50 transition-colors duration-300 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full transition-colors ${theme.colors.iconBg}`}>
              <Music className={`w-5 h-5 ${theme.colors.accent}`} />
            </div>
            <h1 className={`text-xl font-bold tracking-tight transition-colors ${theme.colors.textMain}`}>
              Darbar Sahib <span className={`font-light ${theme.colors.accent}`}>Live</span>
            </h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">

            {/* Status Record Mode Selector */}
            <button
              onClick={openSelector}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${theme.colors.iconBg} ${theme.colors.cardBorder} ${theme.colors.textMain} hover:border-red-500/50 hover:text-red-500 group`}
              title="Record 30s Status"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse group-hover:scale-125 transition-transform" />
              <span>Status</span>
            </button>

            {/* Theme Switcher */}
            <ThemeSwitcher />
          </div>

        </div>
      </header>

      {/* --- MODE SELECTION MODAL --- */}
      {showModeSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in">
          <div className={`w-full max-w-sm rounded-2xl p-6 border shadow-xl space-y-5 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
            
            <h2 className={`text-lg font-bold text-center ${theme.colors.textMain}`}>
              Select Status Recording Mode
            </h2>

            <p className={`text-sm text-center ${theme.colors.textSub}`}>
              Choose how your 30-second Kirtan status video should look.
            </p>

            <div className="grid grid-cols-1 gap-3">

              {/* A) CINEMATIC SACRED FILM */}
              <button
                onClick={() => startRecordingWithMode("cinematic")}
                className="flex items-center gap-3 p-3 rounded-xl border hover:border-amber-500/50 hover:bg-amber-500/10 transition-all"
              >
                <Film className="w-6 h-6 text-amber-400" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Cinematic Sacred Film</p>
                  <p className="text-xs opacity-70">Slow pan + zoom, glow, bokeh, premium look</p>
                </div>
              </button>

              {/* B) AUDIO REACTIVE VISUALIZER */}
              <button
                onClick={() => startRecordingWithMode("reactive")}
                className="flex items-center gap-3 p-3 rounded-xl border hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"
              >
                <Waves className="w-6 h-6 text-blue-400" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Audio Reactive Visualizer</p>
                  <p className="text-xs opacity-70">Waveforms, bars, motion synced to Kirtan</p>
                </div>
              </button>

              {/* C) MINIMALIST CLASSIC */}
              <button
                onClick={() => startRecordingWithMode("minimal")}
                className="flex items-center gap-3 p-3 rounded-xl border hover:border-gray-500/50 hover:bg-gray-500/10 transition-all"
              >
                <Camera className="w-6 h-6 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Minimalist Classic</p>
                  <p className="text-xs opacity-70">Clean, centered, calm & traditional</p>
                </div>
              </button>

              {/* D) ULTRA CINEMATIC 3D */}
              <button
                onClick={() => startRecordingWithMode("ultra")}
                className="flex items-center gap-3 p-3 rounded-xl border hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
              >
                <Sparkles className="w-6 h-6 text-purple-400" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Ultra Cinematic 3D</p>
                  <p className="text-xs opacity-70">Parallax, light rays, premium 3D motion</p>
                </div>
              </button>

            </div>

            {/* Cancel */}
            <button
              onClick={() => setShowModeSelector(false)}
              className="w-full mt-2 py-2 rounded-xl text-sm font-medium opacity-70 hover:opacity-100 transition"
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </>
  );
};

export default Header;
