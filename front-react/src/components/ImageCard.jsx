import { useState, useEffect } from 'react';
import './ImageCard.css';

const API_URL = ''; // Relative URL for production

function ImageCard({ asset, apiKey, onFullscreen }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use proxy endpoint since direct CORS requests are blocked
    const imageUrl = `${API_URL}/proxy/thumbnail/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
    setImageSrc(imageUrl);
    setLoading(false);

    // No cleanup needed for regular URLs (not blob URLs)
  }, [asset.assetId, apiKey]);

  const handleClick = () => {
    // Trigger fullscreen viewer
    onFullscreen(asset);
  };

  const date = new Date(asset.createdAt);

  return (
    <div className="image-card" onClick={handleClick}>
      {loading ? (
        <div className="image-placeholder">Loading...</div>
      ) : (
        <img 
          src={imageSrc} 
          alt={asset.assetId}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      )}
      <div className="image-overlay">
        <div className="overlay-content">
          <span className="overlay-time">
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="overlay-date">
            {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ImageCard;
