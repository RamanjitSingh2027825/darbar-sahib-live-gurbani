import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, BookOpen } from 'lucide-react';
import { HUKAMNAMA_API_URL } from '../constants';
import { HukamnamaResponse } from '../types';

const HukamnamaDisplay: React.FC = () => {
  const [data, setData] = useState<HukamnamaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    const fetchHukamnama = async () => {
      try {
        const response = await fetch(HUKAMNAMA_API_URL);
        if (!response.ok) {
          throw new Error('Failed to fetch Hukamnama');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHukamnama();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Daily Hukamnama...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-400 bg-red-900/10 rounded-xl border border-red-900/50">
        <p>Unable to load Hukamnama</p>
        <p className="text-sm opacity-75 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || !data.hukamnama) {
    return null;
  }

  // Safely extract date components to avoid object rendering errors
  const gregorian = data.date?.gregorian;
  const nanakshahi = data.date?.nanakshahi;
  
  const dateString = gregorian 
    ? `${gregorian.date} ${gregorian.month} ${gregorian.year}`
    : '';

  const punjabiDateString = nanakshahi
    ? `${nanakshahi.date} ${nanakshahi.punjabi} ${nanakshahi.year}`
    : '';

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-100">Daily Hukamnama</h3>
            <p className="text-sm text-slate-400">Sri Harmandir Sahib</p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <p className="text-amber-400 font-medium">{punjabiDateString}</p>
          <p className="text-slate-500 text-sm">{dateString}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Gurmukhi */}
        <div className="space-y-4 text-center">
          {data.hukamnama.map((line, index) => (
            <p key={index} className="gurmukhi text-xl md:text-2xl leading-loose text-slate-200">
              {line.line.gurmukhi.unicode}
            </p>
          ))}
        </div>

        {/* Translation Toggle */}
        <div className="pt-6 border-t border-slate-800/50">
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="flex items-center justify-center w-full gap-2 py-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            {showTranslation ? 'Hide Translations' : 'Show Translations'}
            {showTranslation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTranslation && (
            <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Punjabi Translation */}
              <div className="space-y-3 text-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Punjabi Vyakhya</h4>
                {data.hukamnama.map((line, index) => (
                  line.line.translation.punjabi.default.unicode && (
                    <p key={`pun-${index}`} className="gurmukhi text-lg text-slate-300 leading-relaxed">
                      {line.line.translation.punjabi.default.unicode}
                    </p>
                  )
                ))}
              </div>

              {/* English Translation */}
              <div className="space-y-3 text-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">English Translation</h4>
                {data.hukamnama.map((line, index) => (
                  line.line.translation.english.default && (
                    <p key={`eng-${index}`} className="text-slate-300 leading-relaxed font-light italic">
                      {line.line.translation.english.default}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HukamnamaDisplay;