import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Calendar, Info, Play, Maximize2 } from 'lucide-react';

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

  // Preload nearby images in both directions (skip videos)
  useEffect(() => {
    const preloadImages = [];
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;

      const candidateIndex = index + i;
      if (candidateIndex >= 0 && candidateIndex < assets.length && assets[candidateIndex].type !== 'VIDEO') {
        const img = new Image();
        img.src = `${API_URL}/proxy/fullsize/${assets[candidateIndex].assetId}?api_key=${encodeURIComponent(apiKey)}`;
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
    const link = document.createElement('a');
    link.href = fullsizeUrl;
    link.download = `immich_${asset.assetId}.${isVideo ? 'mp4' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [asset.assetId, fullsizeUrl, isVideo]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goToPrevious();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowDown') handleDownload();
      else if (e.key === 'i') setShowInfo(prev => !prev);
    };

    document.addEventListener('keydown', handleKeyboard);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'auto';
    };
  }, [onClose, goToPrevious, goToNext, handleDownload]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;

    // Allow native interactions for controls and buttons.
    const target = e.target;
    if (target?.closest?.('button, video')) {
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
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-xs font-bold text-white/80">{index + 1} / {assets.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-immich-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            <Info className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

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

        <AnimatePresence mode="wait">
          <Motion.div
            key={asset.assetId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
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
              />
            ) : (
              <img 
                src={fullsizeUrl} 
                alt={asset.assetId}
                className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
                draggable="false"
              />
            )}
          </Motion.div>
        </AnimatePresence>

        {/* Info panel overlay */}
        <AnimatePresence>
          {showInfo && (
            <Motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-black/80 backdrop-blur-2xl border-l border-white/10 p-6 z-50 overflow-y-auto pt-24"
            >
              <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Info className="w-5 h-5 text-immich-primary" /> Asset Details
              </h3>
              
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
