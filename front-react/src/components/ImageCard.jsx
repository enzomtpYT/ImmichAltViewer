import { memo } from 'react';
import './ImageCard.css';

const API_URL = '';

const ImageCard = memo(({ asset, apiKey, onFullscreen }) => {
  const imageUrl = `${API_URL}/proxy/thumbnail/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
  const isVideo = asset.type === 'VIDEO';

  const handleClick = () => {
    onFullscreen(asset);
  };

  return (
    <div className="image-card" onClick={handleClick}>
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      {isVideo && (
        <div className="video-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
    </div>
  );
});

export default ImageCard;
