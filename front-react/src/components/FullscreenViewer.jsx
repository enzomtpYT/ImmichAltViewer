import { useEffect, useState, useRef } from 'react';
import './FullscreenViewer.css';

const API_URL = ''; // Relative URL for production

function FullscreenViewer({ assets, currentIndex, apiKey, onClose, onNavigate, onLoadMore }) {
  const [index, setIndex] = useState(currentIndex);
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const videoRef = useRef(null);
  const asset = assets[index];
  const isVideo = asset?.type === 'VIDEO';

  // Minimum swipe distance in pixels
  const minSwipeDistance = 50;

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  // Auto-load more images when approaching the end (3 images before)
  useEffect(() => {
    const imagesFromEnd = assets.length - index;
    
    if (imagesFromEnd <= 3 && onLoadMore) {
      onLoadMore();
    }
  }, [index, assets.length, onLoadMore]);

  // Preload next 3 images (skip videos) for instant navigation
  useEffect(() => {
    const preloadImages = [];
    
    for (let i = 1; i <= 3; i++) {
      const nextIndex = index + i;
      if (nextIndex < assets.length && assets[nextIndex].type !== 'VIDEO') {
        const img = new Image();
        img.src = `${API_URL}/proxy/fullsize/${assets[nextIndex].assetId}?api_key=${encodeURIComponent(apiKey)}`;
        preloadImages.push(img);
      }
    }

    return () => {
      preloadImages.forEach(img => {
        img.src = '';
      });
    };
  }, [index, assets, apiKey]);

  // Stop video playback when navigating away
  // Capture the element at effect time, NOT cleanup time
  useEffect(() => {
    const currentVideo = videoRef.current;
    return () => {
      if (currentVideo) {
        currentVideo.pause();
      }
    };
  }, [index]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === ' ' && isVideo && videoRef.current) {
        // Space to play/pause video
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'auto';
    };
  }, [index, isVideo]);

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

  const onTouchStart = (e) => {
    // Don't intercept touches on video controls
    if (e.target.tagName === 'VIDEO') return;
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    if (e.target.tagName === 'VIDEO') return;
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target.className === 'fullscreen-backdrop') {
      onClose();
    }
  };

  const fullsizeUrl = isVideo
    ? `${API_URL}/proxy/video/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`
    : `${API_URL}/proxy/fullsize/${asset.assetId}?api_key=${encodeURIComponent(apiKey)}`;
  const date = new Date(asset.createdAt);

  const hasPrevious = index > 0;
  const hasNext = index < assets.length - 1;

  return (
    <div 
      className="fullscreen-backdrop" 
      onClick={handleBackdropClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button className="close-btn" onClick={onClose} aria-label="Close">
        ✕
      </button>

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
        {isVideo ? (
          <video
            ref={videoRef}
            key={asset.assetId}
            src={fullsizeUrl}
            className="fullscreen-video"
            controls
            autoPlay
            playsInline
            preload="auto"
          />
        ) : (
          <img 
            src={fullsizeUrl} 
            alt={asset.assetId}
            className="fullscreen-image"
            draggable="false"
          />
        )}
        
        <div className="fullscreen-info">
          <div className="info-content">
            <p className="image-counter">
              {index + 1} / {assets.length}
            </p>
            <p className="image-date">
              {isVideo ? '🎬' : '📅'} {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="image-id">
              ID: {asset.assetId}
            </p>
          </div>
        </div>
      </div>
      
      <div className="fullscreen-hint">
        <span className="mobile-hint">Swipe to navigate</span>
        <span className="desktop-hint">
          <kbd>←</kbd> <kbd>→</kbd> to navigate {isVideo && <> • <kbd>Space</kbd> play/pause</>} • <kbd>ESC</kbd> to close
        </span>
      </div>
    </div>
  );
}

export default FullscreenViewer;
