import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Calendar, Info, Play, Pause, Maximize2, Download, SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react';

const API_URL = ''; // Relative URL for production

function FullscreenViewer({ assets, currentIndex, apiKey, onClose, onNavigate }) {
  const [index, setIndex] = useState(currentIndex);
  const [showInfo, setShowInfo] = useState(false);
  const videoRef = useRef(null);
  const touchStartRef = useRef(null);
  const asset = assets[index];
  const isVideo = asset?.type === 'VIDEO';

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  const [autoSlide, setAutoSlide] = useState(false);
  const [showSlideSettings, setShowSlideSettings] = useState(false);
  const [slideInterval, setSlideInterval] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem('immich_slide_interval'), 10);
      return Number.isFinite(stored) && stored > 0 ? stored : 5;
    } catch {
      return 5;
    }
  });
  const [videoAdvanceMode, setVideoAdvanceMode] = useState(() => {
    try {
      const stored = localStorage.getItem('immich_video_advance_mode');
      return stored === 'interval' ? 'interval' : 'after-end';
    } catch {
      return 'after-end';
    }
  });
  const [slideDirection, setSlideDirection] = useState(() => {
    try {
      const stored = localStorage.getItem('immich_slide_direction');
      return stored === 'backward' ? 'backward' : 'forward';
    } catch {
      return 'forward';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('immich_slide_interval', String(slideInterval)); } catch { /* ignore */ }
  }, [slideInterval]);

  useEffect(() => {
    try { localStorage.setItem('immich_video_advance_mode', videoAdvanceMode); } catch { /* ignore */ }
  }, [videoAdvanceMode]);

  useEffect(() => {
    try { localStorage.setItem('immich_slide_direction', slideDirection); } catch { /* ignore */ }
  }, [slideDirection]);

  // Preload nearby images (preview size — the current asset alone uses full size)
  useEffect(() => {
    const preloadImages = [];
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;

      const candidateIndex = index + i;
      if (candidateIndex >= 0 && candidateIndex < assets.length && assets[candidateIndex].type !== 'VIDEO') {
        const img = new Image();
        img.src = `${API_URL}/proxy/preview/${assets[candidateIndex].assetId}?api_key=${encodeURIComponent(apiKey)}`;
        preloadImages.push(img);
      }
    }
    return () => preloadImages.forEach(img => (img.src = ''));
  }, [index, assets, apiKey]);

  const fullsizeUrl = isVideo
    ? `${API_URL}/proxy/video/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`
    : `${API_URL}/proxy/fullsize/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;

  const goToPrevious = useCallback(() => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      onNavigate(newIndex);
    }
  }, [index, onNavigate]);

  const goToNext = useCallback(() => {
    if (index < assets.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      onNavigate(newIndex);
    }
  }, [index, assets.length, onNavigate]);

  const handleDownload = useCallback(() => {
    const defaultExt = isVideo ? 'mp4' : 'jpg';
    const fallbackName = `immich_${asset.assetId}.${defaultExt}`;
    const filename = asset?.originalFileName || fallbackName;

    const link = document.createElement('a');
    link.href = fullsizeUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [asset, fullsizeUrl, isVideo]);

  const toggleAutoSlide = useCallback(() => {
    setAutoSlide(prev => !prev);
  }, []);

  const advanceSlide = useCallback(() => {
    if (slideDirection === 'backward') {
      if (index > 0) {
        goToPrevious();
      } else {
        setAutoSlide(false);
      }
    } else if (index < assets.length - 1) {
      goToNext();
    } else {
      setAutoSlide(false);
    }
  }, [slideDirection, index, assets.length, goToPrevious, goToNext]);

  const handleVideoEnded = useCallback(() => {
    if (!autoSlide || videoAdvanceMode !== 'after-end') return;
    advanceSlide();
  }, [autoSlide, videoAdvanceMode, advanceSlide]);

  // Auto-slide timer. Videos in 'after-end' mode advance via onEnded instead.
  useEffect(() => {
    if (!autoSlide) return;
    if (isVideo && videoAdvanceMode === 'after-end') return;

    const timeout = setTimeout(() => {
      advanceSlide();
    }, slideInterval * 1000);

    return () => clearTimeout(timeout);
  }, [autoSlide, index, isVideo, videoAdvanceMode, slideInterval, advanceSlide]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goToPrevious();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowDown') handleDownload();
      else if (e.key === 'i') setShowInfo(prev => !prev);
      else if (e.key === ' ') {
        const target = e.target;
        if (target && (target.tagName === 'VIDEO' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        e.preventDefault();
        toggleAutoSlide();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'auto';
    };
  }, [onClose, goToPrevious, goToNext, handleDownload, toggleAutoSlide]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;

    // Allow native interactions for buttons.
    const target = e.target;
    if (target?.closest?.('button')) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dt = Math.max(1, Date.now() - start.time);
    const sx = dx / dt;
    const sy = dy / dt;

    // Ignore taps and tiny drags.
    if (absX < 40 && absY < 40) return;

    // Dominant axis dispatch keeps gestures predictable.
    if (absX > absY) {
      if (dx > 90 || sx > 0.65) {
        goToPrevious();
      } else if (dx < -90 || sx < -0.65) {
        goToNext();
      }
      return;
    }

    if (dy > 140 || sy > 0.85) {
      handleDownload();
    } else if (dy < -140 || sy < -0.85) {
      onClose();
    }
  }, [goToPrevious, goToNext, handleDownload, onClose]);

  const date = new Date(asset.createdAt);

  return (
    <Motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col pt-[max(env(safe-area-inset-top),1rem)]"
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-xs font-bold text-white/80">{index + 1} / {assets.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleAutoSlide}
            title={autoSlide ? 'Pause slideshow (Space)' : 'Start slideshow (Space)'}
            className={`p-2 rounded-full transition-colors ${autoSlide ? 'bg-immich-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            {autoSlide ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowSlideSettings(!showSlideSettings)}
            title="Slideshow settings"
            className={`p-2 rounded-full transition-colors ${showSlideSettings ? 'bg-immich-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDownload}
            title="Download asset"
            className="p-2 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            title="Asset Info (i)"
            className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-immich-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            <Info className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Slideshow Settings Panel */}
      <AnimatePresence>
        {showSlideSettings && (
          <Motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute top-20 right-4 z-[70] w-80 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-2xl p-5 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-immich-primary" /> Slideshow
              </h3>
              <button
                onClick={() => setShowSlideSettings(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
                aria-label="Close slideshow settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/70">Auto-slide</span>
              <button
                role="switch"
                aria-checked={autoSlide}
                onClick={toggleAutoSlide}
                className={`relative h-6 w-11 rounded-full transition-colors flex-none ${autoSlide ? 'bg-immich-primary' : 'bg-white/15'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoSlide ? 'translate-x-5' : ''}`} />
              </button>
            </label>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70 block">Slide interval</label>
              <div className="flex flex-wrap gap-1.5">
                {[3, 5, 10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSlideInterval(sec)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${slideInterval === sec ? 'bg-immich-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={slideInterval}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (Number.isFinite(val) && val > 0) setSlideInterval(val);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-immich-primary/50 transition-colors"
                />
                <span className="text-xs text-white/40 flex-none">seconds</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70 block">Direction</label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${slideDirection === 'forward' ? 'border-immich-primary bg-immich-primary/15' : 'border-white/10 bg-white/[0.03]'}`}>
                  <input
                    type="radio"
                    name="slideDirection"
                    checked={slideDirection === 'forward'}
                    onChange={() => setSlideDirection('forward')}
                    className="accent-immich-primary"
                  />
                  <ArrowRight className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs text-white/80">Forward</span>
                </label>
                <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${slideDirection === 'backward' ? 'border-immich-primary bg-immich-primary/15' : 'border-white/10 bg-white/[0.03]'}`}>
                  <input
                    type="radio"
                    name="slideDirection"
                    checked={slideDirection === 'backward'}
                    onChange={() => setSlideDirection('backward')}
                    className="accent-immich-primary"
                  />
                  <ArrowLeft className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs text-white/80">Backward</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70 block">Videos</label>
              <div className="space-y-1.5">
                <label className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${videoAdvanceMode === 'after-end' ? 'border-immich-primary bg-immich-primary/15' : 'border-white/10 bg-white/[0.03]'}`}>
                  <input
                    type="radio"
                    name="videoAdvance"
                    checked={videoAdvanceMode === 'after-end'}
                    onChange={() => setVideoAdvanceMode('after-end')}
                    className="accent-immich-primary"
                  />
                  <span className="text-xs text-white/80">Slide right after video ends</span>
                </label>
                <label className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${videoAdvanceMode === 'interval' ? 'border-immich-primary bg-immich-primary/15' : 'border-white/10 bg-white/[0.03]'}`}>
                  <input
                    type="radio"
                    name="videoAdvance"
                    checked={videoAdvanceMode === 'interval'}
                    onChange={() => setVideoAdvanceMode('interval')}
                    className="accent-immich-primary"
                  />
                  <span className="text-xs text-white/80">Slide after interval (same as images)</span>
                </label>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden touch-none px-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {index > 0 && (
          <button 
            onClick={goToPrevious}
            className="absolute left-4 z-40 p-4 bg-black/20 hover:bg-black/40 text-white/40 hover:text-white rounded-full backdrop-blur-md transition-all hidden md:block"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        
        {index < assets.length - 1 && (
          <button 
            onClick={goToNext}
            className="absolute right-4 z-40 p-4 bg-black/20 hover:bg-black/40 text-white/40 hover:text-white rounded-full backdrop-blur-md transition-all hidden md:block"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        <div
          key={asset.assetId}
          className="w-full h-full flex items-center justify-center"
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={fullsizeUrl}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              controls
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
            />
          ) : (
            <img 
              src={fullsizeUrl} 
              alt={asset.assetId}
              className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
              draggable="false"
            />
          )}
        </div>

        {/* Info panel overlay */}
        <AnimatePresence>
          {showInfo && (
            <Motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-black/85 backdrop-blur-2xl border-l border-white/10 p-6 z-50 overflow-y-auto pt-20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-immich-primary" /> Asset Details
                </h3>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Captured On
                  </label>
                  <p className="text-sm text-white/80">
                    {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-white/40">
                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                    {isVideo ? <Play className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />} Format
                  </label>
                  <p className="text-sm text-white/80">{isVideo ? 'Video Clip' : 'High-Res Photo'}</p>
                </div>

                {asset?.originalFileName && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Original File Name</label>
                    <p className="text-xs text-white/80 font-mono break-all bg-white/5 p-2 rounded">
                      {asset.originalFileName}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Asset Identifier</label>
                  <p className="text-[10px] font-mono text-white/20 break-all bg-white/5 p-2 rounded">
                    {asset.assetId}
                  </p>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="block text-[10px] font-bold text-white/30 mb-1">TYPE</span>
                        <span className="text-xs font-mono">{asset.type}</span>
                     </div>
                     <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="block text-[10px] font-bold text-white/30 mb-1">STATUS</span>
                        <span className="text-xs font-mono text-green-400">Archived</span>
                     </div>
                  </div>
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe/Nav hints (Mobile) */}
      <div className="flex-none p-6 text-center text-white/20 text-[10px] font-bold tracking-[0.2em] uppercase">
        Swipe left/right to navigate • Swipe down to download • Swipe up to close
      </div>
    </Motion.div>
  );
}

export default FullscreenViewer;
