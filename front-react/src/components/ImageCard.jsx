import { memo, useState } from 'react';
import { Play, ImageOff, RefreshCw } from 'lucide-react';

const API_URL = '';

const ImageCard = memo(({ asset, apiKey, onFullscreen }) => {
  const imageUrl = `${API_URL}/proxy/thumbnail/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
  const isVideo = asset.type === 'VIDEO';
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = (e) => {
    e.stopPropagation();
    setError(false);
    setLoaded(false);
    setRetryKey(prev => prev + 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFullscreen(asset);
    }
  };

  return (
    <div 
      className="group relative w-full aspect-square overflow-hidden rounded-xl bg-white/5 cursor-pointer ring-1 ring-white/10 md:hover:ring-immich-primary/50 transition-all duration-300 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-immich-primary"
      onClick={() => onFullscreen(asset)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={isVideo ? `Open video in fullscreen` : `Open photo in fullscreen`}
    >
      {/* Loading Skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 bg-white/5 flex flex-col items-center justify-center gap-2 p-2 text-center">
          <ImageOff className="w-6 h-6 text-white/30" />
          <button 
            onClick={handleRetry}
            className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 text-white/70 px-2 py-1 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {!error && (
        <img
          key={retryKey}
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-all duration-500 md:group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          draggable="false"
        />
      )}

      {asset.sourceColor && (
        <>
          <div
            className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full border border-white/70 shadow z-10"
            style={{ backgroundColor: asset.sourceColor }}
            title={asset.sourceAlbumName || 'Album source'}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-1 z-10"
            style={{ backgroundColor: asset.sourceColor }}
          />
        </>
      )}
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 pointer-events-none">
        {isVideo && (
          <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        )}
      </div>

      {/* Persistent Status Badge for Video */}
      {isVideo && !loaded && !error && (
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
      )}
    </div>
  );
});

export default ImageCard;
