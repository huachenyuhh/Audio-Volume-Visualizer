import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, Play, Pause, Music, Volume2, Activity, BarChart3, Disc, Sparkles, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type VisualMode = 'waveform' | 'bars' | 'circular' | 'particles';
type Theme = 'cyberpunk' | 'ocean' | 'fire';

const THEMES = {
  cyberpunk: {
    primary: '#ec4899',
    secondary: '#06b6d4',
    bgGlow1: 'bg-pink-900/20',
    bgGlow2: 'bg-cyan-900/20',
    textGradient: 'from-pink-400 via-purple-400 to-cyan-400',
    hueBase: 300,
    hueRange: 60,
  },
  ocean: {
    primary: '#3b82f6',
    secondary: '#14b8a6',
    bgGlow1: 'bg-blue-900/20',
    bgGlow2: 'bg-teal-900/20',
    textGradient: 'from-blue-400 via-sky-400 to-teal-400',
    hueBase: 200,
    hueRange: 40,
  },
  fire: {
    primary: '#ef4444',
    secondary: '#f97316',
    bgGlow1: 'bg-red-900/20',
    bgGlow2: 'bg-orange-900/20',
    textGradient: 'from-red-400 via-orange-400 to-yellow-400',
    hueBase: 15,
    hueRange: 40,
  }
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [bass, setBass] = useState(0);
  const [visualMode, setVisualMode] = useState<VisualMode>('circular');
  const [theme, setTheme] = useState<Theme>('ocean');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Particle state
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; size: number; color: string }[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setFile(selectedFile);
      setAudioUrl(URL.createObjectURL(selectedFile));
      setIsPlaying(false);
      // Reset particles
      particles.current = Array.from({ length: 100 }, () => ({
        x: Math.random() * 800,
        y: Math.random() * 300,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: `hsla(${Math.random() * 360}, 70%, 60%, 0.8)`
      }));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // Calculate volume and bass
      let sum = 0;
      let bassSum = 0;
      const bassRange = Math.floor(bufferLength * 0.1); // First 10% for bass
      
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
        if (i < bassRange) bassSum += dataArray[i];
      }
      const currentVol = sum / bufferLength;
      const currentBass = bassSum / bassRange;
      setVolume(currentVol);
      setBass(currentBass);

      const currentTheme = THEMES[theme];

      // Draw mini spectrum
      if (miniCanvasRef.current) {
        const miniCtx = miniCanvasRef.current.getContext('2d');
        if (miniCtx) {
          const mWidth = miniCanvasRef.current.width;
          const mHeight = miniCanvasRef.current.height;
          
          miniCtx.clearRect(0, 0, mWidth, mHeight);
          
          const barWidth = mWidth / bufferLength;
          let x = 0;
          
          miniCtx.fillStyle = currentTheme.primary;
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * mHeight;
            miniCtx.fillRect(x, mHeight - barHeight, barWidth, barHeight);
            x += barWidth;
          }
        }
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // Trail effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      if (visualMode === 'bars') {
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const intensity = dataArray[i] / 255;
          const barHeight = intensity * canvas.height * 0.4;
          const hue = currentTheme.hueBase + (i / bufferLength) * currentTheme.hueRange;
          
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
          ctx.shadowBlur = 15;
          ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.5)`;
          
          // Draw top half
          ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
          // Draw bottom half
          ctx.fillRect(x, centerY, barWidth, barHeight);
          
          x += barWidth + 1;
        }
        ctx.shadowBlur = 0;
      } else if (visualMode === 'circular') {
        const rotationOffset = Date.now() / 4000; // Slower rotation
        const baseRadius = 100 + (currentBass / 255) * 40;
        
        // 1. Core Glow
        const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 1.5);
        coreGradient.addColorStop(0, `${currentTheme.primary}80`);
        coreGradient.addColorStop(0.5, `${currentTheme.secondary}20`);
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // 2. Continuous Circular Waveform (Inner)
        ctx.beginPath();
        for (let i = 0; i <= bufferLength; i++) {
          const index = i % bufferLength;
          const angle = (i / bufferLength) * Math.PI * 2 - rotationOffset;
          const intensity = dataArray[index] / 255;
          const r = baseRadius - 10 + intensity * 40;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = currentTheme.primary;
        ctx.shadowBlur = 15;
        ctx.shadowColor = currentTheme.primary;
        ctx.stroke();
        ctx.fillStyle = `${currentTheme.primary}20`;
        ctx.fill();

        // 3. Radiating Rays (Outer)
        const numRays = 128; // Use a subset of the buffer for rays
        const step = Math.floor(bufferLength / numRays);
        
        for (let i = 0; i < numRays; i++) {
          const dataIndex = i * step;
          const intensity = dataArray[dataIndex] / 255;
          
          if (intensity > 0.1) { // Only draw rays if there's enough energy
            const angle = (i / numRays) * Math.PI * 2 + rotationOffset * 2;
            const rayLength = intensity * 150;
            const startRadius = baseRadius + 10;
            
            const x1 = centerX + Math.cos(angle) * startRadius;
            const y1 = centerY + Math.sin(angle) * startRadius;
            const x2 = centerX + Math.cos(angle) * (startRadius + rayLength);
            const y2 = centerY + Math.sin(angle) * (startRadius + rayLength);

            const hue = currentTheme.hueBase + (i / numRays) * currentTheme.hueRange;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 2 + intensity * 3;
            ctx.lineCap = 'round';
            ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.3 + intensity * 0.7})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.8)`;
            ctx.stroke();
            
            // Add a dot at the end of the ray
            ctx.beginPath();
            ctx.arc(x2, y2, 2 + intensity * 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
          }
        }

        // 4. Center Pulse Ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = `${currentTheme.secondary}80`;
        ctx.shadowBlur = 0;
        ctx.stroke();

        // 5. Center Dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3 + (currentBass / 255) * 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.fill();
        
        ctx.shadowBlur = 0;
      } else if (visualMode === 'particles') {
        if (particles.current.length === 0) {
          particles.current = Array.from({ length: 100 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 3 + 1,
            color: '#fff'
          }));
        }

        const connectionDistance = 120;

        particles.current.forEach((p, i) => {
          const freqIndex = Math.floor((i / particles.current.length) * bufferLength);
          const intensity = dataArray[freqIndex] / 255;
          
          p.x += p.vx * (1 + intensity * 5);
          p.y += p.vy * (1 + intensity * 5);

          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

          const hue = currentTheme.hueBase + (i % currentTheme.hueRange);
          const color = `hsla(${hue}, 70%, 60%, 0.8)`;

          // Draw connections
          for (let j = i + 1; j < particles.current.length; j++) {
            const p2 = particles.current[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              const opacity = (1 - distance / connectionDistance) * 0.4 * (1 + intensity);
              ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${opacity})`;
              ctx.lineWidth = 1 + intensity * 2;
              ctx.stroke();
            }
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + intensity * 3), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowBlur = intensity * 20;
          ctx.shadowColor = color;
          ctx.fill();
        });
        ctx.shadowBlur = 0;
      } else {
        // Enhanced Waveform
        analyserRef.current!.getByteTimeDomainData(dataArray);
        ctx.lineWidth = 4;
        ctx.strokeStyle = currentTheme.primary;
        ctx.shadowBlur = 20;
        ctx.shadowColor = currentTheme.primary;
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [visualMode, file, theme]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none transition-colors duration-1000">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${THEMES[theme].bgGlow1} blur-[120px] rounded-full transition-colors duration-1000`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${THEMES[theme].bgGlow2} blur-[120px] rounded-full transition-colors duration-1000`} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className={`text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${THEMES[theme].textGradient} mb-2 transition-all duration-1000`}>
              SONIC VIZ
            </h1>
            <p className="text-slate-500 font-medium tracking-wide">ADVANCED AUDIO ANALYTICS ENGINE</p>
          </motion.div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Theme Selector */}
            <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl">
              {(Object.keys(THEMES) as Theme[]).map((t) => (
                <button 
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    theme === t 
                      ? 'bg-slate-800 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <Palette size={16} color={THEMES[t].primary} />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{t}</span>
                </button>
              ))}
            </div>

            <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl">
              {[
                { id: 'waveform', icon: Activity, label: 'Wave' },
                { id: 'bars', icon: BarChart3, label: 'Bars' },
                { id: 'circular', icon: Disc, label: 'Orbit' },
                { id: 'particles', icon: Sparkles, label: 'Dust' }
              ].map((mode) => (
                <button 
                  key={mode.id}
                  onClick={() => setVisualMode(mode.id as VisualMode)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    visualMode === mode.id 
                      ? 'bg-slate-800 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                  style={{
                    backgroundColor: visualMode === mode.id ? THEMES[theme].primary : undefined,
                    boxShadow: visualMode === mode.id ? `0 10px 15px -3px ${THEMES[theme].primary}40` : undefined
                  }}
                >
                  <mode.icon size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Interface */}
        <main className="grid gap-8">
          {/* Visualization Area */}
          <section className="relative bg-slate-950 border border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(59,130,246,0.2)]">
            <div className="absolute top-8 left-8 z-10 flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-xl">
              <motion.div 
                animate={{ scale: isPlaying ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-slate-700'}`} 
              />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isPlaying ? 'Signal Processing' : 'System Ready'}
              </span>
            </div>

            <canvas 
              ref={canvasRef} 
              width={1000} 
              height={450} 
              className="w-full h-[450px] block cursor-crosshair"
            />

            {/* Energy Meters */}
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
              <div className="flex gap-8">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bass Energy</div>
                  <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full"
                      style={{ backgroundColor: THEMES[theme].primary, boxShadow: `0 0 15px ${THEMES[theme].primary}` }}
                      animate={{ width: `${(bass / 255) * 100}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Gain</div>
                  <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full"
                      style={{ backgroundColor: THEMES[theme].secondary, boxShadow: `0 0 15px ${THEMES[theme].secondary}` }}
                      animate={{ width: `${(volume / 255) * 100}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                    />
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bit Depth</div>
                  <div className="text-xl font-black text-white">24-BIT</div>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Latency</div>
                  <div className="text-xl font-black text-white">0.4ms</div>
                </div>
              </div>
            </div>
          </section>

          {/* Controls & Upload */}
          <div className="grid lg:grid-cols-[1fr_350px] gap-8">
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-[2rem] p-8 backdrop-blur-md flex flex-col justify-center items-center gap-8">
              {!file ? (
                <label className="w-full cursor-pointer group">
                  <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-800 rounded-3xl group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all duration-500">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 border border-slate-700 group-hover:border-blue-500/30 shadow-2xl"
                    >
                      <Upload className="text-slate-400 group-hover:text-blue-400" size={32} />
                    </motion.div>
                    <p className="text-xl text-slate-300 font-bold tracking-tight">Initialize Audio Stream</p>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Select a high-fidelity source file</p>
                  </div>
                  <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="w-full space-y-8">
                  <div className="flex items-center gap-6 bg-slate-950/80 p-6 rounded-3xl border border-slate-800 shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Music className="text-white" size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xl text-white font-black truncate tracking-tight">{file.name}</p>
                      <div className="flex gap-4 mt-1">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        <span className="text-blue-500/60 text-xs font-bold uppercase tracking-widest">Source: Local</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setFile(null);
                        setAudioUrl(null);
                        setIsPlaying(false);
                      }}
                      className="p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      <Activity size={20} />
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-8">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-24 h-24 bg-white text-slate-950 rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(255,255,255,0.3)] transition-all"
                    >
                      {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-2" fill="currentColor" />}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>

            {/* Side Panel */}
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-[2rem] p-8 backdrop-blur-md space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Live Telemetry</h3>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Peak</div>
                  <div className="text-2xl font-black text-white">{Math.round(volume)}</div>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Bass</div>
                  <div className="text-2xl font-black text-blue-400">{Math.round(bass)}</div>
                </div>
              </div>

              {/* Mini Spectrum */}
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-bold text-slate-600 uppercase mb-3">Frequency Spectrum</div>
                <canvas 
                  ref={miniCanvasRef} 
                  width={200} 
                  height={60} 
                  className="w-full h-[60px] rounded-lg opacity-80"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">FFT Size</span>
                  <span className="text-sm font-black text-white">512</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">Smoothing</span>
                  <span className="text-sm font-black text-white">0.85</span>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-800">
                <div className="flex items-center gap-3 text-slate-400 mb-6">
                  <Volume2 size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Phase Correlation</span>
                </div>
                <div className="flex items-end gap-1.5 h-16">
                  {[...Array(12)].map((_, i) => (
                    <motion.div 
                      key={i}
                      className="flex-1 bg-slate-800 rounded-full"
                      animate={{ 
                        height: isPlaying ? [10, Math.random() * 60 + 10, 10] : 10,
                        backgroundColor: isPlaying ? (i > 8 ? THEMES[theme].secondary : THEMES[theme].primary) : '#1e293b'
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 0.4 + Math.random() * 0.4,
                        delay: i * 0.05 
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Audio Element (Hidden) */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
