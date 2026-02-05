import { useEffect, useState } from 'react';
import './FullscreenViewer.css';

const API_URL = ''; // Relative URL for production

function FullscreenViewer({ assets, currentIndex, apiKey, onClose, onNavigate, onLoadMore }) {
  const [index, setIndex] = useState(currentIndex);
  const asset = assets[index];

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  // Auto-load more images when approaching the end (3 images before)
  useEffect(() => {
    const imagesFromEnd = assets.length - index;
    
    // If we're within 3 images of the end, trigger load more
    if (imagesFromEnd <= 3 && onLoadMore) {
      onLoadMore();
    }
  }, [index, assets.length, onLoadMore]);

  // Preload next 3 images for instant navigation
  useEffect(() => {
    const preloadImages = [];
    
    // Preload next 3 images
    for (let i = 1; i <= 3; i++) {
      const nextIndex = index + i;
      if (nextIndex < assets.length) {
        const img = new Image();
        img.src = `${API_URL}/proxy/fullsize/${assets[nextIndex].assetId}?api_key=${encodeURIComponent(apiKey)}`;
        preloadImages.push(img);
      }
    }

    // Cleanup function (images will be cached by browser)
    return () => {
      preloadImages.forEach(img => {
        img.src = '';
      });
    };
  }, [index, assets, apiKey]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'auto';
    };
  }, [index]); // Re-bind when index changes

  const goToPrevious = () => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      onNavigate(newIndex);
    }
  };

  const goToNext = () => {
    if (index < assets.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      onNavigate(newIndex);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target.className === 'fullscreen-backdrop') {
      onClose();
    }
  };

  const fullsizeUrl = `${API_URL}/proxy/fullsize/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
  const date = new Date(asset.createdAt);

  const hasPrevious = index > 0;
  const hasNext = index < assets.length - 1;

  return (
    <div className="fullscreen-backdrop" onClick={handleBackdropClick}>
      <button className="close-btn" onClick={onClose} aria-label="Close">
        ✕
      </button>

      {/* Navigation buttons */}
      {hasPrevious && (
        <button className="nav-btn nav-btn-left" onClick={goToPrevious} aria-label="Previous">
          ←
        </button>
      )}
      {hasNext && (
        <button className="nav-btn nav-btn-right" onClick={goToNext} aria-label="Next">
          →
        </button>
      )}
      
      <div className="fullscreen-container">
        <img 
          src={fullsizeUrl} 
          alt={asset.assetId}
          className="fullscreen-image"
        />
        
        <div className="fullscreen-info">
          <div className="info-content">
            <p className="image-counter">
              {index + 1} / {assets.length}
            </p>
            <p className="image-date">
              📅 {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </p>
            <p className="image-id">
              ID: {asset.assetId}
            </p>
          </div>
        </div>
      </div>
      
      <div className="fullscreen-hint">
        <kbd>←</kbd> <kbd>→</kbd> to navigate • <kbd>ESC</kbd> to close
      </div>
    </div>
  );
}

export default FullscreenViewer;
