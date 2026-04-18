import { memo, useState } from 'react';
import { Play } from 'lucide-react';

const API_URL = '';

const ImageCard = memo(({ asset, apiKey, onFullscreen }) => {
  const imageUrl = `${API_URL}/proxy/thumbnail/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
  const isVideo = asset.type === 'VIDEO';
  const [loaded, setLoaded] = useState(false);

  return (
    <div 
      className="group relative w-full aspect-square overflow-hidden rounded-xl bg-white/5 cursor-pointer ring-1 ring-white/10 hover:ring-immich-primary/50 transition-all duration-300"
      onClick={() => onFullscreen(asset)}
    >
      {/* Loading Skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
        </div>
      )}

      <img
        src={imageUrl}
        alt=""
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
        {isVideo && (
          <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        )}
      </div>

      {/* Persistent Status Badge for Video */}
      {isVideo && !loaded && (
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
      )}
    </div>
  );
});

export default ImageCard;
