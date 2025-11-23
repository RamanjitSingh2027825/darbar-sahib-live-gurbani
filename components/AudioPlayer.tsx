import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Radio, Loader2, Moon, Mic, Square, 
  ListMusic, SkipBack, SkipForward, Repeat, 
  Repeat1, WifiOff, Globe, Search
} from 'lucide-react';
import { STREAM_URL } from '../constants';
import { ConnectionStatus } from '../types';
import WaveVisualizer from './WaveVisualizer';
import RecordingsList from './RecordingsList';
import KirtanExplorer from './KirtanExplorer';
import { DirectoryEntry } from '../services/sgpcService';

// Capacitor Imports
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

type LoopMode = 'off' | 'all' | 'one';
type PlayerMode = 'live' | 'local' | 'remote';

const AudioPlayer: React.FC = () => {
  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  // --- State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [activeMode, setActiveMode] = useState<PlayerMode>('live');

  // --- Playlist State (Remote & Local) ---
  const [localRecordings, setLocalRecordings] = useState<FileInfo[]>([]);
  const [remotePlaylist, setRemotePlaylist] = useState<DirectoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>("");

  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [isDragging, setIsDragging] = useState(false);

  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // --- UI Overlays ---
  const [showRecordingsList, setShowRecordingsList] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);

  // --- Init ---
  useEffect(() => {
    loadLocalRecordings();
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  const loadLocalRecordings = async () => {
    try {
      const result = await Filesystem.readdir({ path: '', directory: Directory.Documents });
      setLocalRecordings(result.files.filter(f => f.name.endsWith('.webm') || f.name.endsWith('.mp3')).sort((a,b) => (b.mtime||0)-(a.mtime||0)));
    } catch (e) { console.error(e); }
  };

  // --- Player Logic ---
  
  const playLive = async () => {
    if(activeMode !== 'live') {
        setCurrentTrackUrl(null); 
    }
    setActiveMode('live');
    const audio = audioRef.current;
    if(audio) {
        audio.src = STREAM_URL;
        audio.load();
        try { await audio.play(); } catch(e) { setStatus(ConnectionStatus.ERROR); }
    }
  };

  const playLocalFile = async (index: number) => {
    if (index < 0 || index >= localRecordings.length) return;
    const file = localRecordings[index];
    const uri = await Filesystem.getUri({ path: file.name, directory: Directory.Documents });
    const src = Capacitor.convertFileSrc(uri.uri);

    setActiveMode('local');
    setCurrentIndex(index);
    setCurrentTrackUrl(src);
    setCurrentTrackTitle(file.name);
  };

  const playRemoteTrack = (url: string, name: string, playlist: DirectoryEntry[]) => {
      const idx = playlist.findIndex(p => p.url === url);
      setActiveMode('remote');
      setRemotePlaylist(playlist);
      setCurrentIndex(idx);
      setCurrentTrackUrl(url);
      setCurrentTrackTitle(decodeURIComponent(name).replace('.mp3', ''));
      setShowExplorer(false);
  };

  // --- Controls ---

  const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) audio.pause();
      else audio.play();
  };

  const handleNext = () => {
      if (activeMode === 'live') return;
      
      let nextIdx = currentIndex + 1;
      if (activeMode === 'local') {
          if (nextIdx >= localRecordings.length) nextIdx = 0;
          playLocalFile(nextIdx);
      } else if (activeMode === 'remote') {
          if (nextIdx >= remotePlaylist.length) nextIdx = 0;
          const track = remotePlaylist[nextIdx];
          playRemoteTrack(track.url, track.name, remotePlaylist);
      }
  };

  const handlePrev = () => {
      if (activeMode === 'live') return;
      
      let prevIdx = currentIndex - 1;
      if (activeMode === 'local') {
          if (prevIdx < 0) prevIdx = localRecordings.length - 1;
          playLocalFile(prevIdx);
      } else if (activeMode === 'remote') {
          if (prevIdx < 0) prevIdx = remotePlaylist.length - 1;
          const track = remotePlaylist[prevIdx];
          playRemoteTrack(track.url, track.name, remotePlaylist);
      }
  };

  // --- Recording Logic ---
  const toggleRecording = async () => {
    if (isRecording) {
        // STOP Recording
        if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    } else {
        // START Recording
        if (!isPlaying) { 
            alert("Please play the audio first."); 
            return; 
        }

        const audio = audioRef.current;
        if (!audio) return;

        // Try to capture stream
        // @ts-ignore
        const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream ? audio.mozCaptureStream() : null;
        
        if (!stream) { 
            alert("Recording Failed: Audio stream could not be captured. This may be due to security restrictions on the stream source."); 
            return; 
        }

        try {
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            
            mediaRecorder.ondataavailable = (e) => { 
                if(e.data.size > 0) chunksRef.current.push(e.data); 
            };
            
            mediaRecorder.onstop = async () => {
                if(chunksRef.current.length === 0) {
                    alert("Recording Failed: No data captured.");
                    setIsRecording(false);
                    return;
                }

                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const fileName = `Darbar_Rec_${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.webm`;
                
                try {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64 = (reader.result as string).split(',')[1];
                        await Filesystem.writeFile({ 
                            path: fileName, 
                            data: base64, 
                            directory: Directory.Documents 
                        });
                        await Toast.show({ text: 'Recording Saved!', duration: 'short' });
                        loadLocalRecordings();
                    };
                    reader.readAsDataURL(blob);
                } catch(e) {
                    console.error(e);
                    alert("Failed to save file.");
                }
                
                setIsRecording(false);
                setRecordingDuration(0);
            };

            mediaRecorder.start(1000);
            setIsRecording(true);

        } catch (err) {
            console.error("MediaRecorder Error:", err);
            alert("Recording Error: " + (err instanceof Error ? err.message : String(err)));
        }
    }
  };
  
  useEffect(() => {
    let interval: any;
    if(isRecording) interval = setInterval(() => setRecordingDuration(s => s+1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Audio Events
  useEffect(() => {
    const audio = audioRef.current;
    if(!audio) return;

    if (activeMode === 'live') {
        if (audio.src !== STREAM_URL) { audio.src = STREAM_URL; audio.load(); }
    } else if (currentTrackUrl && audio.src !== currentTrackUrl) {
        audio.src = currentTrackUrl;
        audio.load();
        audio.play().catch(e => console.error(e));
    }

    const onPlay = () => { setIsPlaying(true); if(activeMode==='live') setStatus(ConnectionStatus.CONNECTED); };
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => { 
        if(!isDragging) setProgress(audio.currentTime); 
        if(isFinite(audio.duration)) setDuration(audio.duration); 
    };
    const onEnded = () => {
        if (loopMode === 'one') { audio.currentTime = 0; audio.play(); }
        else if (loopMode === 'all') handleNext();
        else setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    
    return () => {
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
    };
  }, [activeMode, currentTrackUrl, loopMode, currentIndex]);

  const formatTime = (s: number) => {
     if(!Number.isFinite(s)) return "00:00";
     const m=Math.floor(s/60), sec=Math.floor(s%60);
     return `${m}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
      
      {/* --- OVERLAYS --- */}
      {showRecordingsList && (
        <RecordingsList 
          onClose={() => setShowRecordingsList(false)}
          onPlayRecording={(url) => {
              const idx = localRecordings.findIndex(f => url.includes(f.name));
              playLocalFile(idx >= 0 ? idx : 0);
              setShowRecordingsList(false);
          }}
          currentPlayingUrl={currentTrackUrl}
          isPlayerPaused={!isPlaying}
        />
      )}

      {showExplorer && (
          <KirtanExplorer 
            onClose={() => setShowExplorer(false)}
            onPlayTrack={playRemoteTrack}
          />
      )}

      {/* --- BACKGROUND --- */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 blur-[60px] rounded-full pointer-events-none transition-colors duration-500 
        ${isRecording ? 'bg-red-500/20' : activeMode === 'live' ? 'bg-amber-500/10' : 'bg-blue-500/20'}`} 
      />

      <div className="relative z-10 flex flex-col items-center w-full">
        
        {/* --- HEADER --- */}
        <div className="w-full flex justify-between items-center mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border
                ${activeMode === 'live' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                  activeMode === 'local' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                {activeMode === 'live' ? <Radio className="w-3 h-3 animate-pulse" /> : 
                 activeMode === 'local' ? <ListMusic className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                <span className="uppercase">{activeMode}</span>
            </div>

            <div className="flex gap-2">
                {isRecording && <span className="text-red-400 text-xs font-mono animate-pulse">REC {formatTime(recordingDuration)}</span>}
                <button onClick={() => setShowExplorer(true)} className="p-2 hover:bg-slate-800 rounded-full">
                    <Search className="w-5 h-5 text-slate-400" />
                </button>
                <button onClick={() => setShowRecordingsList(true)} className="p-2 hover:bg-slate-800 rounded-full">
                    <ListMusic className="w-5 h-5 text-slate-400" />
                </button>
            </div>
        </div>

        {/* --- ARTWORK --- */}
        <div className="w-full h-32 flex items-center justify-center mb-4">
             <WaveVisualizer isPlaying={isPlaying} />
        </div>

        {/* --- INFO --- */}
        <div className="text-center mb-6 px-4">
            <h3 className="text-xl font-bold text-slate-100 truncate">
                {activeMode === 'live' ? "Sri Harmandir Sahib" : currentTrackTitle || "Unknown Track"}
            </h3>
            <p className="text-sm text-slate-500">
                {activeMode === 'live' ? "Amritsar, Punjab" : activeMode === 'local' ? "Saved Recording" : "SGPC Archive"}
            </p>
        </div>

        {/* --- SEEK BAR --- */}
        <div className="w-full px-2 mb-6">
            <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                <span className={activeMode === 'live' ? 'text-red-400 font-bold animate-pulse' : ''}>
                    {activeMode === 'live' ? 'LIVE' : formatTime(progress)}
                </span>
                <span>{activeMode === 'live' ? 'BROADCAST' : formatTime(duration)}</span>
            </div>
            <div className="relative h-6 flex items-center">
                <input 
                    type="range" 
                    min="0" 
                    max={activeMode === 'live' ? 100 : (duration || 100)} 
                    value={activeMode === 'live' ? 100 : progress}
                    disabled={activeMode === 'live'}
                    onChange={(e) => {
                        const t = parseFloat(e.target.value);
                        setProgress(t);
                        if(audioRef.current) audioRef.current.currentTime = t;
                    }}
                    onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
                    className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none 
                        ${activeMode === 'live' 
                            ? 'cursor-not-allowed [&::-webkit-slider-thumb]:hidden' // Hide Thumb
                            : 'cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400'
                        }`}
                />
                <div 
                    className={`absolute left-0 h-1.5 rounded-full pointer-events-none transition-all duration-500
                        ${activeMode === 'live' ? 'bg-red-500 w-full shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-amber-500 rounded-l-full'}
                    `} 
                    style={{ width: activeMode === 'live' ? '100%' : `${(progress/duration)*100}%` }} 
                />
            </div>
        </div>

        {/* --- CONTROLS --- */}
        <div className="flex items-center justify-between w-full px-4">
            {activeMode === 'live' ? (
                 <button onClick={() => {
                     const opts = [null,15,30,60]; setSleepTimer(opts[(opts.indexOf(sleepTimer)+1)%opts.length]);
                 }} className={`flex flex-col items-center gap-1 ${sleepTimer?'text-amber-400':'text-slate-500'}`}>
                    <Moon className="w-5 h-5" /> <span className="text-[10px]">{sleepTimer?`${sleepTimer}m`:'Sleep'}</span>
                 </button>
            ) : (
                 <button onClick={() => setLoopMode(l => l==='off'?'all':l==='all'?'one':'off')} className={loopMode!=='off'?'text-amber-400':'text-slate-500'}>
                    {loopMode==='one' ? <Repeat1 className="w-5 h-5"/> : <Repeat className="w-5 h-5"/>}
                 </button>
            )}

            {activeMode !== 'live' && (
                <button onClick={handlePrev} className="p-2 text-slate-300"><SkipBack className="w-8 h-8 fill-current" /></button>
            )}

            <button onClick={togglePlay} className="w-16 h-16 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center shadow-xl active:scale-95">
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>

            {activeMode !== 'live' && (
                <button onClick={handleNext} className="p-2 text-slate-300"><SkipForward className="w-8 h-8 fill-current" /></button>
            )}

            {activeMode === 'live' ? (
                <button onClick={toggleRecording} className={`flex flex-col items-center gap-1 ${isRecording?'text-red-400':'text-slate-500'}`}>
                    {isRecording ? <Square className="w-5 h-5 fill-current"/> : <Mic className="w-5 h-5"/>}
                    <span className="text-[10px]">{isRecording?'Stop':'Rec'}</span>
                </button>
            ) : (
                <button onClick={playLive} className="text-slate-500 hover:text-green-400 flex flex-col items-center gap-1">
                    <Globe className="w-5 h-5" />
                    <span className="text-[10px]">Live</span>
                </button>
            )}
        </div>

      </div>
      
      {/* KEY FIX: Conditional CORS based on Active Mode */}
      <audio 
        ref={audioRef} 
        crossOrigin={activeMode === 'live' ? "anonymous" : undefined}
        playsInline 
        onError={(e) => {
            console.error("Audio Error:", e.currentTarget.error);
            setStatus(ConnectionStatus.ERROR);
        }} 
      />
    </div>
  );
};

export default AudioPlayer;