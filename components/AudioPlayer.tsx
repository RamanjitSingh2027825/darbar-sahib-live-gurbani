import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Radio, Loader2, Moon, Mic, Square, 
  ListMusic, SkipBack, SkipForward, Repeat, 
  Repeat1, WifiOff, Globe
} from 'lucide-react';
import { STREAM_URL } from '../constants';
import { ConnectionStatus } from '../types';
import WaveVisualizer from './WaveVisualizer';
import RecordingsList from './RecordingsList';

// Capacitor Imports
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

type LoopMode = 'off' | 'all' | 'one';

const AudioPlayer: React.FC = () => {
  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const recordingAudioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  // --- Connection & Network State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  
  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false); // For Live
  const [isRecordingPlaying, setIsRecordingPlaying] = useState(false); // For Recordings
  
  // --- Playlist & File State ---
  const [recordings, setRecordings] = useState<FileInfo[]>([]);
  const [currentRecIndex, setCurrentRecIndex] = useState<number>(-1);
  const [playingRecordingUrl, setPlayingRecordingUrl] = useState<string | null>(null);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');

  // --- Seek & Progress State ---
  const [progress, setProgress] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // NOTE: This flag prevents the infinite seek loop
  const isFixingDuration = useRef(false); 

  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // --- UI State ---
  const [showRecordingsList, setShowRecordingsList] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    loadRecordings();
    
    const handleOnline = () => { setIsOnline(true); if(!playingRecordingUrl) toggleLivePlay(); };
    const handleOffline = () => { setIsOnline(false); setStatus(ConnectionStatus.ERROR); };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- File Management ---
  const loadRecordings = async () => {
    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents
      });
      const audioFiles = result.files
        .filter(f => f.name.endsWith('.webm') || f.name.endsWith('.mp3'))
        .sort((a, b) => (b.mtime || 0) - (a.mtime || 0)); // Newest first
      setRecordings(audioFiles);
    } catch (err) {
      console.error('Error loading files', err);
    }
  };

  const playRecordingByIndex = async (index: number) => {
      if (index < 0 || index >= recordings.length) return;
      
      const file = recordings[index];
      try {
        const uri = await Filesystem.getUri({
            path: file.name,
            directory: Directory.Documents
        });
        const src = Capacitor.convertFileSrc(uri.uri);
        
        // Switch Logic
        if (audioRef.current) audioRef.current.pause(); // Stop Live
        setIsPlaying(false);
        
        setPlayingRecordingUrl(src);
        setCurrentRecIndex(index);
        setIsRecordingPlaying(true);
        setShowRecordingsList(false);
        
        // Reset Duration Fixer State
        isFixingDuration.current = false;
        setDuration(0);
        setProgress(0);

      } catch (err) {
          console.error('Failed to play file', err);
      }
  };

  // --- Live Stream Logic ---
  const toggleLivePlay = async () => {
    if (!isOnline) {
        Toast.show({ text: 'No Internet Connection', duration: 'short' });
        return;
    }
    
    // Stop Recording Player
    setPlayingRecordingUrl(null);
    setIsRecordingPlaying(false);
    setCurrentRecIndex(-1);

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setStatus(ConnectionStatus.DISCONNECTED);
    } else {
      setStatus(ConnectionStatus.CONNECTING);
      try {
        audio.load();
        await audio.play();
      } catch (err) {
        setStatus(ConnectionStatus.ERROR);
      }
    }
  };

  // --- Standard Recording Logic ---
  const startRecording = () => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) {
        alert("Please play the live audio first.");
        return;
    }
    
    // @ts-ignore
    const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream ? audio.mozCaptureStream() : null;
    if (!stream) { alert("Recording not supported."); return; }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = []; // Reset chunks

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `Darbar_Rec_${timestamp}.webm`;

        try {
            // Convert blob to base64 for Capacitor
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64,
                    directory: Directory.Documents
                });
                await Toast.show({ text: 'Recording Saved', duration: 'short' });
                loadRecordings();
                setShowRecordingsList(true);
            };
            reader.readAsDataURL(blob);
        } catch (err) {
            console.error(err);
            alert("Failed to save recording");
        }
        setRecordingDuration(0);
        setIsRecording(false);
    };

    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);
    setRecordingDuration(0);
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  };

  const handleRecordToggle = () => {
      if (isRecording) {
          stopRecording();
      } else {
          startRecording();
      }
  };

  // --- Recording Player Controls ---
  const handleNext = () => {
      let nextIndex = currentRecIndex + 1;
      if (nextIndex >= recordings.length) nextIndex = 0; // Wrap to start
      playRecordingByIndex(nextIndex);
  };

  const handlePrev = () => {
      let prevIndex = currentRecIndex - 1;
      if (prevIndex < 0) prevIndex = recordings.length - 1; // Wrap to end
      playRecordingByIndex(prevIndex);
  };

  const toggleLoop = () => {
      if (loopMode === 'off') setLoopMode('all');
      else if (loopMode === 'all') setLoopMode('one');
      else setLoopMode('off');
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setProgress(time); // Update UI instantly
      if (recordingAudioRef.current) {
          recordingAudioRef.current.currentTime = time;
      }
  };

  // --- Effects ---
  // Recording Timer
  useEffect(() => {
      let interval: any;
      if (isRecording) interval = setInterval(() => setRecordingDuration(s => s + 1), 1000);
      return () => clearInterval(interval);
  }, [isRecording]);

  // Sleep Timer
  useEffect(() => {
    if (!sleepTimer) return;
    const timer = setTimeout(() => {
        setSleepTimer(prev => {
             if (prev && prev <= 1) {
                 if(audioRef.current) audioRef.current.pause();
                 if(recordingAudioRef.current) recordingAudioRef.current.pause();
                 return null;
             }
             return prev ? prev - 1 : null;
        });
    }, 60000);
    return () => clearTimeout(timer);
  }, [sleepTimer]);

  // Live Stream Listeners
  useEffect(() => {
      const audio = audioRef.current;
      if(!audio) return;
      const onPlay = () => { setStatus(ConnectionStatus.CONNECTED); setIsPlaying(true); };
      const onPause = () => setIsPlaying(false);
      const onErr = () => { setStatus(ConnectionStatus.ERROR); setIsPlaying(false); };
      
      audio.addEventListener('playing', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('error', onErr);
      return () => {
          audio.removeEventListener('playing', onPlay);
          audio.removeEventListener('pause', onPause);
          audio.removeEventListener('error', onErr);
      };
  }, []);

  // Format Time
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
      
      {/* List Overlay */}
      {showRecordingsList && (
          <RecordingsList 
            onClose={() => setShowRecordingsList(false)} 
            onPlayRecording={(url) => {
                // Find index if simple selection from list
                const idx = recordings.findIndex(f => url.includes(f.name)); // Loose matching
                playRecordingByIndex(idx !== -1 ? idx : 0);
            }}
            currentPlayingUrl={playingRecordingUrl}
            isPlayerPaused={!isRecordingPlaying}
          />
      )}

      {/* Background Glow */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 blur-[60px] rounded-full pointer-events-none transition-colors duration-500 ${isRecording ? 'bg-red-500/20' : playingRecordingUrl ? 'bg-blue-500/20' : 'bg-amber-500/10'}`} />

      <div className="relative z-10 flex flex-col items-center w-full">
        
        {/* --- TOP HEADER --- */}
        <div className="w-full flex justify-between items-center mb-6">
             <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                playingRecordingUrl 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                    : status === ConnectionStatus.CONNECTED 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
             }`}>
                {playingRecordingUrl ? (
                    <> <ListMusic className="w-3 h-3" /> <span>RECORDING</span> </>
                ) : !isOnline ? (
                    <> <WifiOff className="w-3 h-3" /> <span>OFFLINE</span> </>
                ) : (
                    <> 
                      {status === ConnectionStatus.CONNECTING ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className={`w-3 h-3 ${status === ConnectionStatus.CONNECTED ? 'animate-pulse' : ''}`} />} 
                      <span>{status === ConnectionStatus.CONNECTED ? 'LIVE' : status}</span>
                    </>
                )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
                 {isRecording && (
                    <div className="flex items-center gap-1.5 text-red-400 animate-pulse text-xs font-mono">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        {formatTime(recordingDuration)}
                    </div>
                 )}
                 <button onClick={() => setShowRecordingsList(true)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ListMusic className="w-5 h-5 text-slate-400" />
                 </button>
            </div>
        </div>


        {/* --- VISUALIZER / ARTWORK --- */}
        <div className="w-full h-32 flex items-center justify-center mb-6">
             <WaveVisualizer isPlaying={isPlaying || isRecordingPlaying} />
        </div>

        {/* --- TITLE INFO --- */}
        <div className="text-center space-y-1 mb-8">
            <h3 className="text-xl font-bold text-slate-100 tracking-tight truncate px-4">
                {playingRecordingUrl 
                    ? (currentRecIndex >= 0 ? recordings[currentRecIndex]?.name : "Saved Recording") 
                    : "Sri Harmandir Sahib"}
            </h3>
            <p className="text-sm text-slate-500 flex items-center justify-center gap-1">
                {playingRecordingUrl ? "Local Playback" : "Amritsar, Punjab"}
            </p>
        </div>


        {/* --- SEEK BAR (Only for Recordings) --- */}
        <div className="w-full px-2 mb-6 group">
             <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-2">
                <span>{playingRecordingUrl ? formatTime(progress) : "LIVE"}</span>
                <span>{playingRecordingUrl ? formatTime(duration) : "STREAM"}</span>
             </div>
             
             <div className="relative h-6 flex items-center">
                <input
                    type="range"
                    min="0"
                    max={playingRecordingUrl && isFinite(duration) && duration > 0 ? duration : 100}
                    value={playingRecordingUrl ? progress : 100}
                    onChange={handleSeek}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    disabled={!playingRecordingUrl}
                    className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 ${!playingRecordingUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {/* Progress Fill */}
                <div 
                    className={`absolute left-0 h-1.5 rounded-l-full pointer-events-none ${playingRecordingUrl ? 'bg-amber-500' : 'bg-red-500/50'}`} 
                    style={{ width: playingRecordingUrl && duration > 0 ? `${(progress / duration) * 100}%` : '100%' }} 
                />
             </div>
        </div>


        {/* --- CONTROLS AREA --- */}
        
        {/* Case 1: LIVE MODE CONTROLS */}
        {!playingRecordingUrl && (
            <div className="w-full flex items-center justify-between px-4">
                 {/* Sleep Timer */}
                 <button 
                    onClick={() => {
                        const opts = [null, 15, 30, 60];
                        setSleepTimer(opts[(opts.indexOf(sleepTimer) + 1) % opts.length]);
                    }}
                    className={`flex flex-col items-center gap-1 ${sleepTimer ? 'text-amber-400' : 'text-slate-500'}`}
                 >
                    <Moon className="w-5 h-5" />
                    <span className="text-[10px]">{sleepTimer ? `${sleepTimer}m` : 'Sleep'}</span>
                 </button>

                 {/* Main Play/Pause */}
                 <button 
                    onClick={toggleLivePlay}
                    className={`w-16 h-16 flex items-center justify-center rounded-full shadow-xl active:scale-95 transition-all ${isPlaying ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-950'}`}
                 >
                    {status === ConnectionStatus.CONNECTING ? <Loader2 className="w-8 h-8 animate-spin" /> : isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                 </button>

                 {/* Record Button */}
                 <button 
                    onClick={handleRecordToggle}
                    className={`flex flex-col items-center gap-1 ${isRecording ? 'text-red-400' : 'text-slate-500'}`}
                 >
                    {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                    <span className="text-[10px]">{isRecording ? 'Stop' : 'Rec'}</span>
                 </button>
            </div>
        )}

        {/* Case 2: RECORDING PLAYER CONTROLS */}
        {playingRecordingUrl && (
             <div className="w-full space-y-6">
                 {/* Main Transport */}
                 <div className="flex items-center justify-between px-2">
                      {/* Loop Toggle */}
                      <button onClick={toggleLoop} className={`p-2 rounded-full transition-colors ${loopMode !== 'off' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500'}`}>
                          {loopMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                      </button>

                      {/* Prev */}
                      <button onClick={handlePrev} className="p-3 text-slate-300 hover:text-white">
                          <SkipBack className="w-8 h-8 fill-current" />
                      </button>

                      {/* Play/Pause */}
                      <button 
                        onClick={() => {
                            if(isRecordingPlaying) recordingAudioRef.current?.pause();
                            else recordingAudioRef.current?.play();
                        }}
                        className="w-16 h-16 flex items-center justify-center rounded-full bg-slate-100 text-slate-950 shadow-lg active:scale-95"
                      >
                          {isRecordingPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                      </button>

                      {/* Next */}
                      <button onClick={handleNext} className="p-3 text-slate-300 hover:text-white">
                          <SkipForward className="w-8 h-8 fill-current" />
                      </button>

                      {/* Switch to Live */}
                      <button onClick={toggleLivePlay} className="flex flex-col items-center gap-1 text-slate-500 hover:text-green-400" title="Back to Live">
                          <Globe className="w-5 h-5" />
                      </button>
                 </div>
             </div>
        )}

        {/* Offline Prompt */}
        {!isOnline && !playingRecordingUrl && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-20">
                <WifiOff className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-200">No Internet Connection</h3>
                <p className="text-slate-400 text-sm mb-6">Switch to saved recordings to listen offline.</p>
                <button 
                    onClick={() => setShowRecordingsList(true)}
                    className="bg-amber-500 text-slate-950 px-6 py-3 rounded-full font-bold flex items-center gap-2"
                >
                    <ListMusic className="w-5 h-5" />
                    Open Recordings
                </button>
            </div>
        )}

      </div>

      {/* Hidden Audio Elements */}
      <audio 
        ref={audioRef} 
        src={STREAM_URL} 
        preload="none" 
        crossOrigin="anonymous" 
        playsInline 
      />
      
      {playingRecordingUrl && (
          <audio 
            ref={recordingAudioRef}
            src={playingRecordingUrl}
            autoPlay
            // DURATION FIX: Detect Infinity and seek to end to calculate true duration
            onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.duration === Infinity) {
                    el.currentTime = 1e101; // Seek to end
                    el.ontimeupdate = () => {
                        el.ontimeupdate = null; // Remove handler
                        el.currentTime = 0; // Seek back to start
                        setDuration(el.duration); // Set correct duration
                    };
                } else {
                    setDuration(el.duration);
                }
            }}
            onPlay={() => setIsRecordingPlaying(true)}
            onPause={() => setIsRecordingPlaying(false)}
            onTimeUpdate={(e) => {
                if (!isDragging) setProgress(e.currentTarget.currentTime);
                // Continuously update duration if it changes from Infinity
                if(isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
            }}
            onEnded={() => {
                // Loop Logic
                if (loopMode === 'one') {
                    if(recordingAudioRef.current) {
                        recordingAudioRef.current.currentTime = 0;
                        recordingAudioRef.current.play();
                    }
                } else if (loopMode === 'all') {
                    handleNext();
                } else {
                    setIsRecordingPlaying(false);
                }
            }}
          />
      )}
    </div>
  );
};

export default AudioPlayer;