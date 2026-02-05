import { useState, useEffect, useRef, useCallback } from 'react';
import ImageGallery from './ImageGallery';
import FullscreenViewer from './FullscreenViewer';
import DateSlider from './DateSlider';
import './AlbumViewer.css';

const API_URL = ''; // Relative URL for production
const IMMICH_URL = 'http://192.168.1.110:2283';
const ITEMS_PER_PAGE = 300;

function AlbumViewer() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('immich_api_key') || '');
  const [albumId, setAlbumId] = useState(localStorage.getItem('immich_album_id') || '790fa206-9f0f-4b96-b38f-adcb55f8f419');
  const [allAssets, setAllAssets] = useState([]);
  const [displayedAssets, setDisplayedAssets] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [fullscreenAsset, setFullscreenAsset] = useState(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  
  const observerTarget = useRef(null);

  // Save to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem('immich_api_key', apiKey);
    if (albumId) localStorage.setItem('immich_album_id', albumId);
  }, [apiKey, albumId]);

  // Auto-load album if credentials are saved
  useEffect(() => {
    const savedApiKey = localStorage.getItem('immich_api_key');
    const savedAlbumId = localStorage.getItem('immich_album_id');
    
    if (savedApiKey && savedAlbumId && allAssets.length === 0 && !initialLoading) {
      loadAlbum();
    }
  }, []); // Only run on mount

  const loadAlbum = async () => {
    if (!albumId.trim()) {
      setError('Please enter an album ID');
      return;
    }

    if (!apiKey.trim()) {
      setError('Please enter your Immich API key');
      return;
    }

    setError('');
    setInitialLoading(true);
    setAllAssets([]);
    setDisplayedAssets([]);
    setPage(1);

    try {
      const response = await fetch(`${API_URL}/albums/${albumId}/assets`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch album: ${response.status}`);
      }

      const data = await response.json();
      setAllAssets(data);
      setDisplayedAssets(data.slice(0, ITEMS_PER_PAGE));
      setHasMore(data.length > ITEMS_PER_PAGE);

      if (data.length === 0) {
        setError('No assets found in this album');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Failed to load album:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  // Load more items when scrolling
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);
    setTimeout(() => {
      const nextPage = page + 1;
      const startIndex = nextPage * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const moreAssets = allAssets.slice(0, endIndex);
      
      setDisplayedAssets(moreAssets);
      setPage(nextPage);
      setHasMore(endIndex < allAssets.length);
      setLoading(false);
    }, 300); // Small delay for smooth UX
  }, [loading, hasMore, page, allAssets]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadMore]);

  const handleDateSelect = (dateString) => {
    // Find the first asset with this date
    const targetAssetIndex = allAssets.findIndex((asset) => {
      const assetDate = new Date(asset.createdAt);
      const assetDateString = assetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return assetDateString === dateString;
    });

    if (targetAssetIndex === -1) return;

    // Load a window around the target date to avoid loading too many images
    // Load ITEMS_PER_PAGE before and after the target
    const startIndex = Math.max(0, targetAssetIndex - ITEMS_PER_PAGE);
    const endIndex = Math.min(allAssets.length, targetAssetIndex + ITEMS_PER_PAGE * 2);
    
    const newAssets = allAssets.slice(startIndex, endIndex);
    setDisplayedAssets(newAssets);
    setPage(Math.ceil(endIndex / ITEMS_PER_PAGE));
    setHasMore(endIndex < allAssets.length);

    // Scroll to the date after a short delay
    setTimeout(() => {
      const daySeparators = document.querySelectorAll('.day-separator');
      for (let separator of daySeparators) {
        const title = separator.querySelector('.day-title');
        if (title && title.textContent === dateString) {
          separator.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    }, 200);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      loadAlbum();
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>Immich Viewer</h1>
            <p className="subtitle">Your memories, beautifully organized</p>
          </div>
          
          <div className="search-container">
            <div className="search-box">
              <input
                type="password"
                placeholder="Enter Immich API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input api-key-input"
              />
              <input
                type="text"
                placeholder="Enter Album ID"
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input album-id-input"
              />
              <button 
                onClick={loadAlbum} 
                disabled={initialLoading || !apiKey || !albumId} 
                className="btn"
              >
                {initialLoading ? 'Loading...' : 'Load Album'}
              </button>
            </div>
          </div>
        </div>

        {allAssets.length > 0 && (
          <div className="stats-bar">
            <div className="stats">
              Showing {displayedAssets.length} / {allAssets.length} memories
            </div>
          </div>
        )}
      </header>

      {initialLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Fetching your album...</p>
        </div>
      )}
      
      {error && <div className="error">{error}</div>}

      {displayedAssets.length > 0 && (
        <>
          <ImageGallery 
            assets={displayedAssets} 
            apiKey={apiKey}
            onFullscreen={(asset) => {
              const index = displayedAssets.findIndex(a => a.assetId === asset.assetId);
              setFullscreenIndex(index);
              setFullscreenAsset(asset);
            }}
          />

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="observer-target">
            {loading && (
              <div className="loading-more">
                <div className="spinner small"></div>
                <p>Loading more images...</p>
              </div>
            )}
            {!hasMore && (
              <div className="end-message">
                🎉 You've reached the end! {allAssets.length} images total
              </div>
            )}
          </div>
        </>
      )}

      {/* Fullscreen viewer */}
      {fullscreenAsset && (
        <FullscreenViewer
          assets={displayedAssets}
          currentIndex={fullscreenIndex}
          apiKey={apiKey}
          onClose={() => setFullscreenAsset(null)}
          onNavigate={(newIndex) => {
            setFullscreenIndex(newIndex);
            setFullscreenAsset(displayedAssets[newIndex]);
          }}
          onLoadMore={() => {
            // Trigger load more if not already loading and there's more to load
            if (!loading && hasMore) {
              loadMore();
            }
          }}
        />
      )}

      {/* Date slider for navigation */}
      {allAssets.length > 0 && (
        <DateSlider
          assets={allAssets}
          onDateSelect={handleDateSelect}
        />
      )}
    </div>
  );
}

export default AlbumViewer;
