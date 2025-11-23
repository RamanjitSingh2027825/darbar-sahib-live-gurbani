import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Radio, Loader2, Moon, Mic, Square, 
  ListMusic, SkipBack, SkipForward, Repeat, 
  Repeat1, WifiOff, Globe, Search, Download, X, Heart
} from 'lucide-react';
import { STREAM_URL } from '../constants';
import { ConnectionStatus } from '../types';
import WaveVisualizer from './WaveVisualizer';
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
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        .animate-ripple {
          animation: ripple 0.6s ease-out forwards;
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

  // --- Slideshow State ---
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState(localImages.length > 0 ? localImages[0] : FALLBACK_IMAGE);
  const [fadeKey, setFadeKey] = useState(0);
  
  // Slideshow Control States
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false);
  const [slideshowFeedback, setSlideshowFeedback] = useState<'play' | 'pause' | null>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showRecordingsList, setShowRecordingsList] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);

  // Video Status State
  const [isVideoStatusRecording, setIsVideoStatusRecording] = useState(false);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);

  // --- Swipe Refs ---
  const touchStartX = useRef(0);
  const minSwipeDistance = 50; 
useEffect(() => {
  loadLocalRecordings();
  window.addEventListener('online', () => setIsOnline(true));
  window.addEventListener('offline', () => setIsOnline(false));
  
  // Listen for Video Status Event (with mode from CustomEvent.detail)
  const statusListener = (e: Event) => {
    startVideoStatusRecording(e as CustomEvent<any>);
  };

  window.addEventListener('start-video-status', statusListener as EventListener);

  return () => {
    window.removeEventListener('start-video-status', statusListener as EventListener);
  };
}, [currentImage, isPlaying, theme, isVideoStatusRecording]);

  useEffect(() => { checkIfLiked(); }, [currentTrackUrl, activeMode]);

  // --- Auto Slideshow ---
  useEffect(() => {
      if (localImages.length <= 1 || isSlideshowPaused) return; 

      const interval = setInterval(() => {
          changeImage('next');
      }, 10000); 

      return () => clearInterval(interval);
  }, [currentImageIndex, isSlideshowPaused]); 

  // --- Image Change Logic ---
  const changeImage = (direction: 'next' | 'prev') => {
      if (localImages.length === 0) return;
      let newIndex = currentImageIndex;
      if (direction === 'next') {
          newIndex = (currentImageIndex + 1) % localImages.length;
      } else {
          newIndex = (currentImageIndex - 1 + localImages.length) % localImages.length;
      }
      setCurrentImageIndex(newIndex);
      setCurrentImage(localImages[newIndex]);
      setFadeKey(prev => prev + 1);
  };

  // --- Swipe Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartX.current) return;
      const touchEndX = e.changedTouches[0].clientX;
      const distance = touchStartX.current - touchEndX;
      if (distance > minSwipeDistance) changeImage('next');
      else if (distance < -minSwipeDistance) changeImage('prev');
      touchStartX.current = 0;
  };

  // --- Tap Handler ---
  const handleImageTap = (e: React.MouseEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
          const newPausedState = !isSlideshowPaused;
          setIsSlideshowPaused(newPausedState);
          setSlideshowFeedback(newPausedState ? 'pause' : 'play');
          setTimeout(() => setSlideshowFeedback(null), 800); 
      } else {
          singleTapTimeoutRef.current = setTimeout(() => {
              changeImage('next');
          }, DOUBLE_TAP_DELAY);
      }
      lastTapRef.current = now;
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
          await Filesystem.downloadFile({ path: filename, directory: Directory.Cache, url: url });
          const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
          const localUrl = Capacitor.convertFileSrc(uri.uri);
          if(audioRef.current) { audioRef.current.crossOrigin = null; setCurrentTrackUrl(localUrl); }
      } catch (err) {
          console.error("Cache failed", err);
          if(audioRef.current) { audioRef.current.crossOrigin = "anonymous"; setCurrentTrackUrl(url); }
          Toast.show({ text: 'Buffering failed. Recording disabled.', duration: 'long' });
      } finally { setIsLoading(false); }
      };
      
      // --- Video Status Recording Logic (Multi-Mode) ---
const startVideoStatusRecording = async (event?: CustomEvent<any>) => {
  // Which visual mode did user choose from Header?
  const mode: 'cinematic' | 'reactive' | 'minimal' | 'ultra' =
    event?.detail?.mode || 'cinematic';

  console.log('Status Recording Mode:', mode);

  // Toggle: if already recording, stop it
  if (isVideoStatusRecording) {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }
    return;
  }

  if (!audioRef.current || !isPlaying) {
    Toast.show({ text: 'Please play audio first!', duration: 'short' });
    return;
  }
  if (isRecording) {
    // Don’t allow status + audio-only recording simultaneously
    return;
  }

  try {
    setIsVideoStatusRecording(true);
    Toast.show({ text: 'Recording Started (Tap Status to Stop)', duration: 'short' });

    // 1) Canvas setup (Full HD vertical)
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No Canvas');

    // 2) Theme-based accent color
    const getThemeColor = () => {
      switch (theme.id) {
        case 'royal':
          return '#fbbf24'; // amber
        case 'bliss':
          return '#f97316'; // orange
        case 'harmandir':
          return '#eab308'; // yellow
        case 'midnight':
          return '#818cf8'; // indigo
        default:
          return '#fbbf24';
      }
    };
    const themeColor = getThemeColor();

    // 3) Load current slideshow image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // 4) Capture canvas stream + audio
    const streamTarget = canvas.captureStream(30);
    // @ts-ignore
    const audio = audioRef.current;
    // @ts-ignore
    const audioStream =
      audio.captureStream?.() || audio.mozCaptureStream?.() || null;

    if (audioStream && audioStream.getAudioTracks().length > 0) {
      streamTarget.addTrack(audioStream.getAudioTracks()[0]);
    } else {
      console.warn('Audio capture not supported.');
    }

    const recorder = new MediaRecorder(streamTarget, {
      mimeType: 'video/webm; codecs=vp9',
      videoBitsPerSecond: 8_000_000,
    });
    videoRecorderRef.current = recorder;

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      setIsVideoStatusRecording(false);
      videoRecorderRef.current = null;

      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      setPendingBlob(blob);

      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      setSaveName(`Darbar_Status_${timestamp}`);
      setShowSavePrompt(true);
    };

    recorder.start();

    // 5) Animation engine
    const startTime = Date.now();
    let parallaxOffset = 0;
    const bars = 64; // for reactive mode

    const drawFrame = () => {
      if (videoRecorderRef.current?.state === 'inactive') return;

      const now = Date.now();
      const t = (now - startTime) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ---------- MODE A: CINEMATIC SACRED FILM ----------
      if (mode === 'cinematic') {
        // Background gradient
        const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grd.addColorStop(0, 'rgba(255, 230, 150, 0.18)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ken Burns zoom + pan
        const zoom = 1.08 + Math.sin(t * 0.15) * 0.03;
        const panX = Math.sin(t * 0.12) * 35;
        const panY = Math.cos(t * 0.10) * 45;

        const scaledW = img.width * zoom;
        const scaledH = img.height * zoom;
        const x = canvas.width / 2 - scaledW / 2 + panX;
        const y = canvas.height / 2 - scaledH / 2 - 140 + panY;

        // Glow backdrop
        ctx.globalAlpha = 0.25;
        ctx.filter = 'blur(40px)';
        ctx.drawImage(img, x, y, scaledW, scaledH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;

        // Main sharp image
        ctx.drawImage(img, x, y, scaledW, scaledH);

        // Floating golden bokeh
        for (let i = 0; i < 30; i++) {
          const px = (i * 200 + t * 40) % (canvas.width + 200) - 100;
          const py = (i * 120 + t * 25) % (canvas.height + 200) - 100;
          const radius = 16 + Math.sin(t * 0.4 + i) * 6;
          ctx.fillStyle = `rgba(255, 215, 120, ${0.05 + Math.sin(t + i) * 0.04})`;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---------- MODE B: AUDIO REACTIVE VISUALIZER ----------
      else if (mode === 'reactive') {
        // Dark background
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle image background
        const zoom = 1.05;
        const scaledW = img.width * zoom;
        const scaledH = img.height * zoom;
        const x = canvas.width / 2 - scaledW / 2;
        const y = 260;

        ctx.globalAlpha = 0.35;
        ctx.filter = 'blur(30px)';
        ctx.drawImage(img, x, y, scaledW, scaledH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;

        ctx.drawImage(img, x, y, scaledW, scaledH);

        // Fake audio bars (sin-based animation)
        const barWidth = canvas.width / bars;
        for (let i = 0; i < bars; i++) {
          const phase = t * 3 + i * 0.4;
          const h = 40 + (Math.sin(phase) + 1) * 55; // 40–150px
          const bx = i * barWidth;
          const by = canvas.height - h - 140;

          const alpha = 0.4 + 0.4 * Math.sin(phase + 1);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`; // cyan-ish
          ctx.fillRect(bx + 2, by, barWidth - 4, h);

          // Gradient glow on top
          const grad = ctx.createLinearGradient(0, by, 0, by + h);
          grad.addColorStop(0, 'rgba(248, 250, 252, 0.9)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(bx + 2, by, barWidth - 4, h);
        }
      }

      // ---------- MODE C: MINIMALIST CLASSIC ----------
      else if (mode === 'minimal') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Center image, no crazy zoom
        const scale = Math.min(
          (canvas.width * 0.8) / img.width,
          (canvas.height * 0.7) / img.height
        );
        const w = img.width * scale;
        const h = img.height * scale;
        const x = canvas.width / 2 - w / 2;
        const y = canvas.height / 2 - h / 2 - 80;

        ctx.drawImage(img, x, y, w, h);

        // Very soft glow
        ctx.globalAlpha = 0.2;
        ctx.filter = 'blur(60px)';
        ctx.drawImage(img, x, y, w, h);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;

        // Simple halo
        const radial = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2 - 80,
          0,
          canvas.width / 2,
          canvas.height / 2 - 80,
          canvas.width / 2
        );
        radial.addColorStop(0, 'rgba(250, 250, 250, 0.08)');
        radial.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // ---------- MODE D: ULTRA CINEMATIC 3D ----------
      else if (mode === 'ultra') {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Parallax offset
        parallaxOffset = Math.sin(t * 0.3) * 30;

        // Radiating light rays
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2 - 120);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = themeColor;

        for (let i = 0; i < 14; i++) {
          const angle = (Math.PI * 2 * i) / 14 + t * 0.15;
          const r = 1900;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          ctx.lineTo(Math.cos(angle + 0.08) * r, Math.sin(angle + 0.08) * r);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Foreground image with small Z-movement
        const zoom = 1.12 + Math.sin(t * 0.2) * 0.04;
        const scaledW = img.width * zoom;
        const scaledH = img.height * zoom;
        const x = canvas.width / 2 - scaledW / 2 + parallaxOffset;
        const y = canvas.height / 2 - scaledH / 2 - 120;

        ctx.drawImage(img, x, y, scaledW, scaledH);

        // Floating white/golden dust
        for (let i = 0; i < 40; i++) {
          const px = (i * 90 + t * 50) % canvas.width;
          const py = (i * 120 + t * 35) % canvas.height;
          const r = 6 + (Math.sin(t + i) + 1) * 3;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + 0.1 * Math.sin(i + t)})`;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---------- COMMON: Title + Progress Bar ----------
      ctx.textAlign = 'center';

      // Track title
      ctx.font = 'bold 46px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const title =
        activeMode === 'live'
          ? 'Sri Harmandir Sahib • Live Kirtan'
          : currentTrackTitle || 'Darbar Sahib Kirtan';
      ctx.fillText(title, canvas.width / 2, canvas.height - 210);

      // Time / progress
      const current = audio.currentTime;
      const total = audio.duration || 1;

      ctx.lineWidth = 0;
      const barX = 160;
      const barY = canvas.height - 170;
      const barW = canvas.width - 320;
      const barH = 16;

      // Track background
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(barX, barY, barW, barH);

      // Progress
      ctx.fillStyle = themeColor;
      ctx.fillRect(barX, barY, barW * (current / total), barH);

      // Time text
      const format = (s: number) => {
        if (!Number.isFinite(s)) return '00:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60)
          .toString()
          .padStart(2, '0');
        return `${m}:${sec}`;
      };
      ctx.font = '28px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`${format(current)} / ${format(total)}`, canvas.width / 2, canvas.height - 125);

      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  } catch (e) {
    console.error('Video Record Error:', e);
    Toast.show({ text: 'Failed to start video recording', duration: 'long' });
    setIsVideoStatusRecording(false);
  }
};

      
      // --- Recording Logic (Audio Only) ---
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
      const isVideo = pendingBlob.type.includes('video');
      const ext = isVideo ? '.webm' : '.webm'; 
      if (!fileName.toLowerCase().endsWith(ext)) fileName += ext;
      
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
  useEffect(() => { let interval: any; if(isRecording) interval = setInterval(() => setRecordingDuration(s => s+1), 1000); return () => clearInterval(interval); }, [isRecording]);

  const formatTime = (s: number) => { if(!Number.isFinite(s)) return "00:00"; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; };
  const togglePlay = () => audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause();
  const handleNext = () => { if (activeMode === 'live') return; let next = currentIndex + 1; if (activeMode === 'local' && next >= localRecordings.length) next = 0; else if (activeMode === 'remote' && next >= remotePlaylist.length) next = 0; activeMode === 'local' ? playLocalFile(next) : playRemoteTrack(remotePlaylist[next].url, remotePlaylist[next].name, remotePlaylist); };
  const handlePrev = () => { if (activeMode === 'live') return; let prev = currentIndex - 1; if (activeMode === 'local' && prev < 0) prev = localRecordings.length - 1; else if (activeMode === 'remote' && prev < 0) prev = remotePlaylist.length - 1; activeMode === 'local' ? playLocalFile(prev) : playRemoteTrack(remotePlaylist[prev].url, remotePlaylist[prev].name, remotePlaylist); };

  useEffect(() => {
    const audio = audioRef.current; if(!audio) return;
    const onTimeUpdate = () => { if(!isDragging) setProgress(audio.currentTime); if(Number.isFinite(audio.duration)) setDuration(audio.duration); };
    const onEnded = () => { if (loopMode === 'one') { audio.currentTime = 0; audio.play(); } else if (loopMode === 'all') handleNext(); else setIsPlaying(false); };
    const onPlay = () => setIsPlaying(true); const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate); audio.addEventListener('ended', onEnded); audio.addEventListener('play', onPlay); audio.addEventListener('pause', onPause);
    return () => { audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause); };
  }, [activeMode, currentTrackUrl, loopMode, currentIndex]);

  useEffect(() => {
      if (activeMode === 'live' && audioRef.current && audioRef.current.src !== STREAM_URL) { 
          audioRef.current.crossOrigin = "anonymous"; audioRef.current.src = STREAM_URL; audioRef.current.load(); 
      } else if (activeMode !== 'live' && currentTrackUrl && audioRef.current && audioRef.current.src !== currentTrackUrl) {
          audioRef.current.src = currentTrackUrl; audioRef.current.load(); audioRef.current.play().catch(console.error);
      }
  }, [activeMode, currentTrackUrl]);

  return (
    <div className={`w-full max-w-md mx-auto backdrop-blur-xl border rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between transition-colors duration-300 ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
      
      {/* --- OVERLAYS --- */}
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


      {/* Video Status Recording Overlay */}
      {isVideoStatusRecording && (
          <div 
            onClick={startVideoStatusRecording} // Allow tapping overlay to stop
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 shadow-lg cursor-pointer hover:scale-105 transition-transform"
          >
              <div className="w-2 h-2 bg-white rounded-full" />
              Rec Status (Tap to Stop)
          </div>
      )}

      {showFavorites && <FavoritesList onClose={() => setShowFavorites(false)} onPlay={playFavorite} />}
      {showRecordingsList && <RecordingsList onClose={() => setShowRecordingsList(false)} onPlayRecording={(url) => { const idx = localRecordings.findIndex(f => url.includes(f.name)); playLocalFile(idx >= 0 ? idx : 0); setShowRecordingsList(false); }} currentPlayingUrl={currentTrackUrl} isPlayerPaused={!isPlaying} />}
      {showExplorer && <KirtanExplorer onClose={() => setShowExplorer(false)} onPlayTrack={playRemoteTrack} />}

      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 blur-[60px] rounded-full pointer-events-none transition-colors duration-500 
        ${isRecording ? 'bg-red-500/20' : activeMode === 'live' ? 'bg-amber-500/10' : 'bg-blue-500/20'}`} 
      />

      <div className="relative z-10 flex flex-col items-center w-full">
        
        {/* --- HEADER --- */}
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

        {/* --- ARTWORK & SLIDESHOW (Interactive) --- */}
        <div className="w-full h-72 flex flex-col items-center justify-center mb-4 relative">
             
             <div 
                className={`relative w-56 h-56 rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 
                    ${isPlaying ? 'shadow-[0_0_40px_rgba(251,191,36,0.3)] scale-105' : 'shadow-none scale-100'}
                `}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={handleImageTap}
             >
                 <img 
                    key={fadeKey}
                    src={currentImage}
                    alt="Darbar Sahib"
                    className="w-full h-full object-cover animate-in fade-in duration-1000 transition-all"
                 />
                 
                 {/* Dark Overlay */}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

                 {/* FEEDBACK ANIMATION (Play/Pause Icon Ripple) */}
                 {slideshowFeedback && (
                     <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                         <div className="bg-black/40 backdrop-blur-md p-4 rounded-full animate-ripple">
                             {slideshowFeedback === 'pause' ? (
                                 <Pause className="w-8 h-8 text-white fill-white" />
                             ) : (
                                 <Play className="w-8 h-8 text-white fill-white pl-1" />
                             )}
                         </div>
                     </div>
                 )}

                 {/* Paused Indicator (Persistent Tiny Icon) */}
                 {isSlideshowPaused && !slideshowFeedback && (
                     <div className="absolute top-2 right-2 bg-black/40 p-1.5 rounded-full backdrop-blur-sm z-10">
                         <Pause className="w-3 h-3 text-white/80" />
                     </div>
                 )}
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
                    onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
                    className={`w-full h-1.5 rounded-full appearance-none ${activeMode === 'live' ? 'cursor-not-allowed [&::-webkit-slider-thumb]:hidden' : `cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:${theme.colors.accentBg}` } ${theme.colors.sliderTrack}`}
                />
                <div className={`absolute left-0 h-1.5 rounded-full pointer-events-none transition-all duration-500 ${activeMode === 'live' ? 'bg-red-500 w-full shadow-[0_0_10px_rgba(239,68,68,0.5)]' : `${theme.colors.accentBg} rounded-l-full`}`} style={{ width: activeMode === 'live' ? '100%' : `${(progress/duration)*100}%` }} />
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