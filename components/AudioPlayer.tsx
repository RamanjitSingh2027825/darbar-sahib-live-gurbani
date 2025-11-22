import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Radio, Loader2, 
  Moon, Mic, Square, Clock
} from 'lucide-react';
import { STREAM_URL } from '../constants';
import { ConnectionStatus } from '../types';
import WaveVisualizer from './WaveVisualizer';

// Capacitor Imports for Native Saving & Notifications
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';

const AudioPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [retryCount, setRetryCount] = useState(0);
  
  // Timer States
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [listeningTime, setListeningTime] = useState(0);
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Media Session (Lock Screen)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Live Kirtan',
        artist: 'Darbar Sahib',
        album: 'Sri Harmandir Sahib',
        artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/6506/6506229.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    }
  }, [isPlaying]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleWaiting = () => setStatus(ConnectionStatus.CONNECTING);
    const handlePlaying = () => {
        setStatus(ConnectionStatus.CONNECTED);
        setIsPlaying(true);
    };
    const handleError = () => {
        setStatus(ConnectionStatus.ERROR);
        setIsPlaying(false);
        stopRecording(); // Safety stop
        if (retryCount < 5) {
            setTimeout(() => {
                setRetryCount(prev => prev + 1);
                if(audio) { audio.load(); audio.play().catch(() => setIsPlaying(false)); }
            }, 2000);
        }
    };

    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);
    audio.addEventListener('pause', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('pause', () => setIsPlaying(false));
    };
  }, [retryCount]);

  // Volume Handler
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
        setIsMuted(volume === 0);
    }
  }, [volume]);

  // Timers Logic (Listening & Recording)
  useEffect(() => {
    let listenInterval: any;
    let recordInterval: any;

    if (isPlaying) {
        listenInterval = setInterval(() => setListeningTime(t => t + 1), 1000);
    }

    if (isRecording && !isRecordingPaused) {
        recordInterval = setInterval(() => setRecordingDuration(t => t + 1), 1000);
    }

    return () => {
        clearInterval(listenInterval);
        clearInterval(recordInterval);
    };
  }, [isPlaying, isRecording, isRecordingPaused]);

  // Sleep Timer Logic
  useEffect(() => {
    if (!sleepTimer || !isPlaying) return;
    const timer = setTimeout(() => {
        setSleepTimer(prev => {
            if (prev && prev <= 1) {
                if (audioRef.current) audioRef.current.pause();
                return null;
            }
            return prev ? prev - 1 : null;
        });
    }, 60000);
    return () => clearTimeout(timer);
  }, [sleepTimer, isPlaying]);

  // Helper: Convert Blob to Base64 for Filesystem API
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        resolve(base64String.split(',')[1]); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // --- Recording Logic ---
  const startRecording = () => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) {
        alert("Please play the audio first to start recording.");
        return;
    }

    try {
        // @ts-ignore - handling cross-browser compatibility
        const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream ? audio.mozCaptureStream() : null;
        
        if (!stream) {
            alert("Recording is not supported in this environment.");
            return;
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `Darbar_Sahib_${timestamp}.webm`;

            try {
                // Convert blob to base64 to save via Capacitor Filesystem
                const base64Data = await blobToBase64(blob);

                // Save to the "Documents" folder
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents
                });

                // Show Success Message
                await Toast.show({
                    text: `Saved to Documents: ${fileName}`,
                    duration: 'long',
                    position: 'bottom'
                });
            } catch (err) {
                console.error("File save error:", err);
                await Toast.show({
                    text: `Failed to save recording.`,
                    duration: 'short'
                });
            }
            
            // Reset state
            setRecordingDuration(0);
            setIsRecording(false);
            setIsRecordingPaused(false);
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Recording failed:", err);
        alert("Could not start recording.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        if (isRecordingPaused) {
            mediaRecorderRef.current.resume();
            setIsRecordingPaused(false);
        } else {
            mediaRecorderRef.current.pause();
            setIsRecordingPaused(true);
        }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setStatus(ConnectionStatus.DISCONNECTED);
    } else {
      setStatus(ConnectionStatus.CONNECTING);
      try {
        if (status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.ERROR) audio.load();
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error(err);
        setStatus(ConnectionStatus.ERROR);
      }
    }
  };

  const toggleSleepTimer = () => {
    const options = [null, 15, 30, 60];
    const nextIndex = (options.indexOf(sleepTimer) + 1) % options.length;
    setSleepTimer(options[nextIndex]);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Decorative Background */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 blur-[60px] rounded-full pointer-events-none transition-colors duration-500 ${isRecording ? 'bg-red-500/20' : 'bg-amber-500/10'}`} />

      <div className="relative z-10 flex flex-col items-center space-y-6">
        
        {/* Top Bar: Status & Timers */}
        <div className="w-full flex justify-between items-center text-xs font-medium">
             <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors duration-300 ${
                status === ConnectionStatus.CONNECTED ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
                {status === ConnectionStatus.CONNECTING ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className={`w-3 h-3 ${status === ConnectionStatus.CONNECTED ? 'animate-pulse' : ''}`} />}
                {status === ConnectionStatus.CONNECTED ? 'LIVE' : status}
            </div>

            <div className="flex flex-col items-end gap-1">
                {/* Regular Listen Timer */}
                {isPlaying && !isRecording && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(listeningTime)}</span>
                    </div>
                )}
                {/* Recording Timer */}
                {isRecording && (
                    <div className="flex items-center gap-1.5 text-red-400 animate-in fade-in slide-in-from-right-2">
                        <div className={`w-2 h-2 rounded-full bg-red-500 ${!isRecordingPaused ? 'animate-pulse' : ''}`} />
                        <span>REC {formatTime(recordingDuration)}</span>
                    </div>
                )}
            </div>
        </div>

        {/* Visualizer Area */}
        <div className="w-full py-4 flex flex-col items-center justify-center min-h-[100px]">
            <WaveVisualizer isPlaying={isPlaying && !isRecordingPaused} />
            <div className="mt-4 text-center">
                <h3 className="text-white font-medium text-lg tracking-tight">Sri Harmandir Sahib</h3>
                <p className="text-slate-500 text-sm">Amritsar, Punjab</p>
            </div>
        </div>

        {/* Main Controls Row */}
        <div className="w-full flex items-center justify-between px-4">
           {/* Sleep Timer Button */}
           <button 
            onClick={toggleSleepTimer}
            disabled={isRecording}
            className={`flex flex-col items-center gap-1 transition-colors ${sleepTimer ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'} ${isRecording ? 'opacity-30 cursor-not-allowed' : ''}`}
           >
            <div className={`p-3 rounded-full ${sleepTimer ? 'bg-amber-500/20' : 'bg-slate-800/50'}`}>
                <Moon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">{sleepTimer ? `${sleepTimer} min` : 'Sleep'}</span>
           </button>

           {/* Play/Pause Button (Center) */}
           <button 
            onClick={togglePlay}
            className={`w-20 h-20 flex items-center justify-center rounded-full shadow-xl transition-all duration-300 transform active:scale-95 ${
                isPlaying 
                ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-white shadow-amber-500/25' 
                : 'bg-slate-100 text-slate-900 hover:bg-white'
            }`}
           >
             {status === ConnectionStatus.CONNECTING ? (
                <Loader2 className="w-8 h-8 animate-spin" />
             ) : isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
             ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
             )}
           </button>

           {/* Recording Controls Group */}
           <div className="flex flex-col items-center justify-end h-full gap-1">
               {!isRecording ? (
                   <button 
                    onClick={startRecording}
                    className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition-colors group"
                   >
                    <div className="p-3 bg-slate-800/50 group-hover:bg-red-500/10 rounded-full transition-colors">
                        <Mic className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium group-hover:text-red-400">Rec</span>
                   </button>
               ) : (
                   <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-2">
                        {/* Stop Button */}
                        <button 
                            onClick={stopRecording}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition-colors"
                            title="Save Recording"
                        >
                            <Square className="w-4 h-4 fill-current" />
                        </button>
                        
                        {/* Pause/Resume Rec Button */}
                        <button 
                            onClick={pauseRecording}
                            className="flex flex-col items-center gap-1 text-slate-400 hover:text-white"
                        >
                             {isRecordingPaused ? (
                                 <div className="flex items-center gap-1">
                                    <Mic className="w-3 h-3 animate-pulse text-red-400" />
                                    <span className="text-[9px] uppercase">Resume</span>
                                 </div>
                             ) : (
                                 <span className="text-[9px] uppercase">Pause</span>
                             )}
                        </button>
                   </div>
               )}
           </div>
        </div>

        {/* Volume Slider Section */}
        <div className="w-full bg-slate-800/50 rounded-xl p-4 flex items-center gap-4 border border-slate-800">
            <button 
                onClick={() => setVolume(v => v === 0 ? 1 : 0)}
                className="text-slate-400 hover:text-white transition-colors"
            >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <div className="relative flex-1 h-6 flex items-center group">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400"
                />
                <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-amber-500 rounded-l-full pointer-events-none" 
                    style={{ width: `${volume * 100}%` }} 
                />
            </div>
        </div>

      </div>

      <audio 
        ref={audioRef} 
        src={STREAM_URL} 
        preload="none"
        crossOrigin="anonymous"
        playsInline
      />
    </div>
  );
};

export default AudioPlayer;