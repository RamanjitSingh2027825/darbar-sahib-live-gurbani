import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Radio, Loader2, Moon, Mic, Square, 
  ListMusic, SkipBack, SkipForward, Repeat, 
  Repeat1, WifiOff, Globe, Search, Download, X, Heart
} from 'lucide-react';
import { STREAM_URL } from '../constants';
import { ConnectionStatus } from '../types';
import RecordingsList from './RecordingsList';
import KirtanExplorer from './KirtanExplorer';
import FavoritesList, { FavoriteItem } from './FavoritesList';
import { DirectoryEntry } from '../services/sgpcService';
import { useTheme } from '../contexts/ThemeContext'; 

// Capacitor Imports
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

// --- AUTO-IMPORT IMAGES ---
const imagesGlob = import.meta.glob('../assets/darbar-sahib-pics/*.{jpg,jpeg,png,webp}', { eager: true });
// @ts-ignore
const localImages = Object.values(imagesGlob).map(img => img.default);

const FALLBACK_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Golden_Temple_India.jpg/800px-Golden_Temple_India.jpg";

type LoopMode = 'off' | 'all' | 'one';
type PlayerMode = 'live' | 'local' | 'remote';

// --- Helper: Scrolling Title ---
const ScrollingTitle: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
  return (
    <div className="w-full overflow-hidden relative flex justify-center mask-fade group cursor-default">
      <style>{`
        .mask-fade {
          mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: fit-content;
          animation: marquee 25s linear infinite;
        }
        .group:hover .animate-marquee {
          animation-play-state: paused;
        }
      `}</style>
      <div className={`animate-marquee whitespace-nowrap gap-12 px-4 ${className}`}>
         <span>{text}</span>
         <span aria-hidden="true">{text}</span>
      </div>
    </div>
  );
};

const AudioPlayer: React.FC = () => {
  const { theme } = useTheme();

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [activeMode, setActiveMode] = useState<PlayerMode>('live');

  const [localRecordings, setLocalRecordings] = useState<FileInfo[]>([]);
  const [remotePlaylist, setRemotePlaylist] = useState<DirectoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [isDragging, setIsDragging] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false); 
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [saveName, setSaveName] = useState('');

  const [currentImage, setCurrentImage] = useState(localImages.length > 0 ? localImages[0] : FALLBACK_IMAGE);
  const [fadeKey, setFadeKey] = useState(0);

  const [showRecordingsList, setShowRecordingsList] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);

  useEffect(() => {
    loadLocalRecordings();
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  useEffect(() => { checkIfLiked(); }, [currentTrackUrl, activeMode]);

  // --- Auto Slideshow ---
  useEffect(() => {
      if (localImages.length <= 1) return;

      const interval = setInterval(() => {
          const randomIndex = Math.floor(Math.random() * localImages.length);
          setCurrentImage(localImages[randomIndex]);
          setFadeKey(prev => prev + 1);
      }, 10000);

      return () => clearInterval(interval);
  }, []);

  // --- MANUAL IMAGE CHANGE (NEW) ---
  const changeImageManually = () => {
      if (localImages.length === 0) return;
      const randomIndex = Math.floor(Math.random() * localImages.length);
      setCurrentImage(localImages[randomIndex]);
      setFadeKey(prev => prev + 1);
  };

  const loadLocalRecordings = async () => {
    try {
      const result = await Filesystem.readdir({ path: '', directory: Directory.Documents });
      setLocalRecordings(result.files.filter(f => f.name.endsWith('.webm') || f.name.endsWith('.mp3')).sort((a,b) => (b.mtime||0)-(a.mtime||0)));
    } catch (e) { console.error(e); }
  };

  // --- Favorites Logic ---
  const getFavoriteId = () => activeMode === 'live' ? 'live_stream' : (activeMode === 'local' ? currentTrackTitle : currentTrackUrl || '');
  const checkIfLiked = () => {
      const id = getFavoriteId();
      if(!id) { setIsLiked(false); return; }
      try {
          const stored = localStorage.getItem('darbar_favorites');
          if(stored) {
              const favs = JSON.parse(stored) as FavoriteItem[];
              setIsLiked(favs.some(f => f.id === id));
          } else setIsLiked(false);
      } catch(e) { setIsLiked(false); }
  };

  const toggleLike = () => {
      const id = getFavoriteId();
      if(!id) return;
      try {
          const stored = localStorage.getItem('darbar_favorites');
          let favs: FavoriteItem[] = stored ? JSON.parse(stored) : [];
          if (isLiked) {
              favs = favs.filter(f => f.id !== id);
              setIsLiked(false);
              Toast.show({ text: 'Removed from Liked', duration: 'short' });
          } else {
              favs.push({
                  id: id,
                  title: activeMode === 'live' ? 'Sri Harmandir Sahib Live' : currentTrackTitle,
                  type: activeMode,
                  url: activeMode === 'live' ? STREAM_URL : (currentTrackUrl || ''),
                  date: Date.now()
              });
              setIsLiked(true);
              Toast.show({ text: 'Added to Liked', duration: 'short' });
          }
          localStorage.setItem('darbar_favorites', JSON.stringify(favs));
      } catch(e) { console.error(e); }
  };

  const playFavorite = (item: FavoriteItem) => {
      setShowFavorites(false);
      if (item.type === 'live') playLive();
      else if (item.type === 'local') {
          const idx = localRecordings.findIndex(f => f.name === item.id);
          if (idx !== -1) playLocalFile(idx);
          else alert("File not found locally.");
      } else if (item.type === 'remote') {
          const entry: DirectoryEntry = { name: item.title + '.mp3', url: item.url, is_file: true, is_mp3: true };
          playRemoteTrack(item.url, item.title, [entry]);
      }
  };

  // --- Player Logic ---
  const playLive = async () => {
    if(isRecording) toggleRecording(); 
    setActiveMode('live');
    setCurrentTrackUrl(null); 
    setCurrentTrackTitle("Sri Harmandir Sahib");
    if(audioRef.current) {
        audioRef.current.crossOrigin = "anonymous"; 
        audioRef.current.src = STREAM_URL;
        audioRef.current.load();
        try { await audioRef.current.play(); } catch(e) { setStatus(ConnectionStatus.ERROR); }
    }
  };

  const playLocalFile = async (index: number) => {
    if (index < 0 || index >= localRecordings.length) return;
    if(isRecording) toggleRecording();
    const file = localRecordings[index];
    const uri = await Filesystem.getUri({ path: file.name, directory: Directory.Documents });
    const src = Capacitor.convertFileSrc(uri.uri);
    setActiveMode('local');
    setCurrentIndex(index);
    setCurrentTrackTitle(file.name);
    if(audioRef.current) { audioRef.current.crossOrigin = null; setCurrentTrackUrl(src); }
  };

  const playRemoteTrack = async (url: string, name: string, playlist: DirectoryEntry[]) => {
      if(isRecording) toggleRecording();
      const idx = playlist.findIndex(p => p.url === url);
      setActiveMode('remote');
      setRemotePlaylist(playlist);
      setCurrentIndex(idx);
      setCurrentTrackTitle(decodeURIComponent(name).replace('.mp3', ''));
      setShowExplorer(false);
      setIsLoading(true); 
      try {
          const filename = `cache_${name.replace(/[^a-z0-9]/gi, '_')}`;
          await Filesystem.downloadFile({ path: filename, directory: Directory.Cache, url });
          const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
          const localUrl = Capacitor.convertFileSrc(uri.uri);
          if(audioRef.current) { audioRef.current.crossOrigin = null; setCurrentTrackUrl(localUrl); }
      } catch (err) {
          console.error("Cache failed", err);
          if(audioRef.current) { audioRef.current.crossOrigin = "anonymous"; setCurrentTrackUrl(url); }
          Toast.show({ text: 'Buffering failed. Recording disabled.', duration: 'long' });
      } finally { setIsLoading(false); }
  };

  // --- Recording Logic ---
  const toggleRecording = async () => {
    if (isRecording) { if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); } 
    else {
        if (!isPlaying) { alert("Play audio first"); return; }
        if (activeMode === 'local') { alert("Cannot re-record a saved file."); return; }
        const audio = audioRef.current;
        // @ts-ignore
        const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream ? audio.mozCaptureStream() : null;
        if (!stream) { alert("Recording Error: Stream is protected."); return; }
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => { if(e.data.size>0) chunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => {
            if(chunksRef.current.length === 0) { setIsRecording(false); return; }
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const prefix = activeMode === 'live' ? 'Live' : 'Clip';
            const timestamp = new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
            setPendingBlob(blob);
            setSaveName(`Darbar_${prefix}_${timestamp}`);
            setShowSavePrompt(true);
            setIsRecording(false);
            setRecordingDuration(0);
        };
        mediaRecorder.start(1000);
        setIsRecording(true);
    }
  };

  const handleConfirmSave = async () => {
      if (!pendingBlob || !saveName.trim()) return;
      let fileName = saveName.trim();
      if (!fileName.toLowerCase().endsWith('.webm')) fileName += '.webm';
      try {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
              Toast.show({ text: 'Saved Successfully!', duration: 'short' });
              loadLocalRecordings();
              setPendingBlob(null);
              setShowSavePrompt(false);
          };
          reader.readAsDataURL(pendingBlob);
      } catch (e) { console.error(e); alert("Failed to save file."); }
  };

  const handleDiscardSave = () => { setPendingBlob(null); setShowSavePrompt(false); Toast.show({ text: 'Recording Discarded', duration: 'short' }); };

  useEffect(() => { 
      let interval: any; 
      if(isRecording) interval = setInterval(() => setRecordingDuration(s => s+1), 1000); 
      return () => clearInterval(interval); 
  }, [isRecording]);

  const formatTime = (s: number) => { if(!Number.isFinite(s)) return "00:00"; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; };

  const togglePlay = () => audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause();

  const handleNext = () => { 
    if (activeMode === 'live') return; 
    let next = currentIndex + 1; 
    if (activeMode === 'local' && next >= localRecordings.length) next = 0; 
    else if (activeMode === 'remote' && next >= remotePlaylist.length) next = 0; 
    activeMode === 'local' ? playLocalFile(next) : playRemoteTrack(remotePlaylist[next].url, remotePlaylist[next].name, remotePlaylist); 
  };

  const handlePrev = () => { 
    if (activeMode === 'live') return; 
    let prev = currentIndex - 1; 
    if (activeMode === 'local' && prev < 0) prev = localRecordings.length - 1; 
    else if (activeMode === 'remote' && prev < 0) prev = remotePlaylist.length - 1; 
    activeMode === 'local' ? playLocalFile(prev) : playRemoteTrack(remotePlaylist[prev].url, remotePlaylist[prev].name, remotePlaylist); 
  };

  useEffect(() => {
    const audio = audioRef.current; if(!audio) return;
    const onTimeUpdate = () => { if(!isDragging) setProgress(audio.currentTime); if(Number.isFinite(audio.duration)) setDuration(audio.duration); };
    const onEnded = () => { if (loopMode === 'one') { audio.currentTime = 0; audio.play(); } else if (loopMode === 'all') handleNext(); else setIsPlaying(false); };
    const onPlay = () => setIsPlaying(true); 
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => { 
        audio.removeEventListener('timeupdate', onTimeUpdate); 
        audio.removeEventListener('ended', onEnded); 
        audio.removeEventListener('play', onPlay); 
        audio.removeEventListener('pause', onPause); 
    };
  }, [activeMode, currentTrackUrl, loopMode, currentIndex]);

  useEffect(() => {
      if (activeMode === 'live' && audioRef.current && audioRef.current.src !== STREAM_URL) { 
          audioRef.current.crossOrigin = "anonymous"; audioRef.current.src = STREAM_URL; audioRef.current.load(); 
      } else if (activeMode !== 'live' && currentTrackUrl && audioRef.current && audioRef.current.src !== currentTrackUrl) {
          audioRef.current.src = currentTrackUrl; 
          audioRef.current.load(); 
          audioRef.current.play().catch(console.error);
      }
  }, [activeMode, currentTrackUrl]);

  return (
    <div className={`w-full max-w-md mx-auto backdrop-blur-xl border rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between transition-colors duration-300 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
      
      {showSavePrompt && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-bold ${theme.colors.textMain}`}>Save Recording</h3>
                    <button onClick={handleDiscardSave} className={`${theme.colors.textSub} hover:${theme.colors.textMain}`}><X className="w-5 h-5"/></button>
                </div>
                <div>
                    <label className={`text-xs ml-1 uppercase font-bold tracking-wider ${theme.colors.textSub}`}>File Name</label>
                    <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} className={`w-full border rounded-lg px-4 py-3 outline-none mt-1 bg-transparent ${theme.colors.textMain} ${theme.colors.cardBorder}`} autoFocus />
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={handleDiscardSave} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}>Discard</button>
                    <button onClick={handleConfirmSave} className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors ${theme.colors.accentBg}`}>Save</button>
                </div>
            </div>
        </div>
      )}

      {showFavorites && <FavoritesList onClose={() => setShowFavorites(false)} onPlay={playFavorite} />}
      {showRecordingsList && <RecordingsList onClose={() => setShowRecordingsList(false)} onPlayRecording={(url) => { const idx = localRecordings.findIndex(f => url.includes(f.name)); playLocalFile(idx >= 0 ? idx : 0); setShowRecordingsList(false); }} currentPlayingUrl={currentTrackUrl} isPlayerPaused={!isPlaying} />}
      {showExplorer && <KirtanExplorer onClose={() => setShowExplorer(false)} onPlayTrack={playRemoteTrack} />}

      {/* Colorful Blur */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 blur-[60px] rounded-full pointer-events-none transition-colors duration-500 
        ${isRecording ? 'bg-red-500/20' : activeMode === 'live' ? 'bg-amber-500/10' : 'bg-blue-500/20'}`} 
      />

      <div className="relative z-10 flex flex-col items-center w-full">
        
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border
                ${activeMode === 'live' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                  activeMode === 'local' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 
                  'bg-purple-500/10 text-purple-600 border-purple-500/20'}`}>
                {activeMode === 'live' ? <Radio className="w-3 h-3 animate-pulse" /> : 
                 activeMode === 'local' ? <ListMusic className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                <span className="uppercase">{activeMode}</span>
            </div>

            <div className="flex gap-2">
                {activeMode !== 'live' && <button onClick={playLive} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}><Globe className="w-5 h-5" /></button>}
                <button onClick={() => setShowFavorites(true)} className={`p-2 rounded-full relative transition-colors ${theme.colors.iconBg} ${theme.colors.hover}`}>
                    <Heart className={`w-5 h-5 ${theme.colors.textSub}`} />
                </button>
                <button onClick={() => setShowExplorer(true)} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}><Search className="w-5 h-5" /></button>
                <button onClick={() => setShowRecordingsList(true)} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}><ListMusic className="w-5 h-5" /></button>
            </div>
        </div>

        {/* --- ARTWORK & SLIDESHOW (UPDATED) --- */}
        <div className="w-full h-72 flex flex-col items-center justify-center mb-4 relative">
             
             <div className={`relative w-56 h-56 rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 
                ${isPlaying ? 'shadow-[0_0_40px_rgba(251,191,36,0.3)] scale-105' : 'shadow-none scale-100'}
             `}>
                 <img 
                    key={fadeKey}
                    src={currentImage}
                    alt="Darbar Sahib"
                    onClick={changeImageManually}
                    className="w-full h-full object-cover animate-in fade-in duration-1000 cursor-pointer active:scale-95 transition-all"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
             </div>

             <div className="absolute -bottom-4 w-full flex justify-center z-10">
                 {isLoading && (
                     <div className={`flex flex-col items-center gap-2 ${theme.colors.accent} bg-black/50 px-4 py-1 rounded-full backdrop-blur-md`}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[10px] font-bold tracking-wider">LOADING...</span>
                     </div>
                 )}
             </div>
        </div>

        {/* Track Title */}
        <div className="w-full flex items-center gap-4 mb-6 px-4">
            <div className="flex-1 min-w-0">
                <ScrollingTitle 
                    text={activeMode === 'live' ? "Sri Harmandir Sahib" : currentTrackTitle || "Unknown Track"} 
                    className={`text-2xl font-serif font-medium tracking-wide ${theme.colors.textMain}`}
                />
                <p className={`text-center text-xs uppercase tracking-[0.2em] opacity-80 mt-1 ${theme.colors.textSub}`}>
                    {activeMode === 'live' ? "Amritsar, Punjab" : activeMode === 'local' ? "Saved Recording" : "SGPC Archive"}
                </p>
            </div>
            <button onClick={toggleLike} className={`p-2 rounded-full transition-colors ${theme.colors.hover}`}>
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : theme.colors.textSub}`} />
            </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full px-2 mb-6">
            <div className={`flex justify-between text-[10px] font-medium mb-2 ${theme.colors.textSub}`}>
                <span className={activeMode === 'live' ? 'text-red-500 font-bold animate-pulse' : ''}>{activeMode === 'live' ? 'LIVE' : formatTime(progress)}</span>
                <span>{activeMode === 'live' ? 'BROADCAST' : formatTime(duration)}</span>
            </div>

            <div className="relative h-6 flex items-center">
                <input 
                    type="range" min="0" max={activeMode === 'live' ? 100 : (duration || 100)} 
                    value={activeMode === 'live' ? 100 : progress}
                    disabled={activeMode === 'live'}
                    onChange={(e) => { const t = parseFloat(e.target.value); setProgress(t); if(audioRef.current) audioRef.current.currentTime = t; }}
                    onMouseDown={() => setIsDragging(true)} 
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)} 
                    onTouchEnd={() => setIsDragging(false)}
                    className={`w-full h-1.5 rounded-full appearance-none ${activeMode === 'live' ? 'cursor-not-allowed [&::-webkit-slider-thumb]:hidden' : `cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:${theme.colors.accentBg}` } ${theme.colors.sliderTrack}`}
                />

                <div 
                    className={`absolute left-0 h-1.5 rounded-full pointer-events-none transition-all duration-500 
                        ${activeMode === 'live' ? 'bg-red-500 w-full shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                          : `${theme.colors.accentBg} rounded-l-full`}`
                    }
                    style={{ width: activeMode === 'live' ? '100%' : `${(progress/duration)*100}%` }} 
                />
            </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between w-full px-4">
            {activeMode === 'live' ? (
                 <button onClick={() => { const opts = [null,15,30,60]; setSleepTimer(opts[(opts.indexOf(sleepTimer)+1)%opts.length]); }} className={`flex flex-col items-center gap-1 ${sleepTimer ? theme.colors.accent : theme.colors.textSub}`}>
                    <Moon className="w-5 h-5" /> <span className="text-[10px]">{sleepTimer?`${sleepTimer}m`:'Sleep'}</span>
                 </button>
            ) : (
                 <button onClick={() => setLoopMode(l => l==='off'?'all':l==='all'?'one':'off')} className={loopMode!=='off' ? theme.colors.accent : theme.colors.textSub}>
                    {loopMode==='one' ? <Repeat1 className="w-5 h-5"/> : <Repeat className="w-5 h-5"/>}
                 </button>
            )}

            {activeMode !== 'live' && <button onClick={handlePrev} className={`p-2 ${theme.colors.textSub} ${theme.colors.hover} rounded-full`}><SkipBack className="w-8 h-8 fill-current" /></button>}

            <button onClick={togglePlay} disabled={isLoading} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all ${isLoading ? 'opacity-50' : ''} ${theme.type === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>

            {activeMode !== 'live' && <button onClick={handleNext} className={`p-2 ${theme.colors.textSub} ${theme.colors.hover} rounded-full`}><SkipForward className="w-8 h-8 fill-current" /></button>}

            <button 
                onClick={toggleRecording} 
                disabled={activeMode === 'local' || isLoading}
                className={`flex flex-col items-center gap-1 ${activeMode === 'local' || isLoading ? 'opacity-30' : ''} ${isRecording?'text-red-500': theme.colors.textSub}`}
            >
                {isRecording ? <Square className="w-5 h-5 fill-current"/> : <Mic className="w-5 h-5"/>}
                <span className="text-[10px]">{isRecording?'Stop':'Rec'}</span>
            </button>
        </div>

      </div>
      
      <audio ref={audioRef} playsInline onError={(e) => { console.error("Audio Error", e); setStatus(ConnectionStatus.ERROR); }} />
    </div>
  );
};

export default AudioPlayer;