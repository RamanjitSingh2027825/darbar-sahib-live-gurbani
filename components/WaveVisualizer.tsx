import React from 'react';

interface WaveVisualizerProps {
  isPlaying: boolean;
}

const WaveVisualizer: React.FC<WaveVisualizerProps> = ({ isPlaying }) => {
  return (
    <div className="flex items-end justify-center gap-1 h-12 w-full max-w-[200px] mx-auto overflow-hidden">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 bg-amber-400 rounded-t-sm transition-all duration-150 ease-in-out ${
            isPlaying ? 'animate-pulse' : 'h-1 opacity-50'
          }`}
          style={{
            height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '10%',
            animationDuration: `${0.5 + Math.random() * 0.5}s`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

export default WaveVisualizer;