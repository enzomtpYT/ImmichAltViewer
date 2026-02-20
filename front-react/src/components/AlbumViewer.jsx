import { useState, useEffect, useRef, useCallback } from 'react';
import ImageGallery from './ImageGallery';
import FullscreenViewer from './FullscreenViewer';
import DateSlider from './DateSlider';
import './AlbumViewer.css';

const API_URL = ''; // Relative URL for production
const IMMICH_URL = 'http://192.168.1.110:2283';
const ITEMS_PER_PAGE_DESKTOP = 200;
const ITEMS_PER_PAGE_MOBILE = 50;

function AlbumViewer() {
  const isMobile = window.innerWidth <= 768;
  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;

  // Safe localStorage access
  const getSafeItem = (key, defaultValue) => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      console.error('LocalStorage access failed:', e);
      return defaultValue;
    }
  };

  const [apiKey, setApiKey] = useState(() => getSafeItem('immich_api_key', ''));
  const [albumId, setAlbumId] = useState(() => getSafeItem('immich_album_id', '790fa206-9f0f-4b96-b38f-adcb55f8f419'));
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
    try {
      if (apiKey) localStorage.setItem('immich_api_key', apiKey);
      if (albumId) localStorage.setItem('immich_album_id', albumId);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [apiKey, albumId]);

  // Auto-load album if credentials are saved
  useEffect(() => {
    const savedApiKey = getSafeItem('immich_api_key', '');
    const savedAlbumId = getSafeItem('immich_album_id', '');
    
    if (savedApiKey && savedAlbumId && allAssets.length === 0 && !initialLoading) {
      loadAlbum(savedApiKey, savedAlbumId);
    }
  }, []); // Only run on mount

  const loadAlbum = async (providedKey, providedId) => {
    const keyToUse = providedKey || apiKey;
    const idToUse = providedId || albumId;

    if (!idToUse?.trim()) {
      setError('Please enter an album ID');
      return;
    }

    if (!keyToUse?.trim()) {
      setError('Please enter your Immich API key');
      return;
    }

    setError('');
    setInitialLoading(true);
    setAllAssets([]);
    setDisplayedAssets([]);
    setPage(1);

    try {
      console.log(`Fetching album: ${idToUse}`);
      const response = await fetch(`${API_URL}/albums/${idToUse}/assets`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Expected array of assets, got:', data);
        throw new Error('Server returned invalid data format');
      }

      setAllAssets(data);
      setDisplayedAssets(data.slice(0, itemsPerPage));
      setHasMore(data.length > itemsPerPage);

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
      const startIndex = nextPage * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const moreAssets = allAssets.slice(0, endIndex);
      
      setDisplayedAssets(moreAssets);
      setPage(nextPage);
      setHasMore(endIndex < allAssets.length);
      setLoading(false);
    }, 200); // Small delay for smooth UX
  }, [loading, hasMore, page, allAssets, itemsPerPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '600px' } // Pre-fetch well ahead for seamless scrolling
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

    // Load a window around the target date
    const startIndex = Math.max(0, targetAssetIndex - itemsPerPage);
    const endIndex = Math.min(allAssets.length, targetAssetIndex + itemsPerPage * 2);
    
    const newAssets = allAssets.slice(startIndex, endIndex);
    setDisplayedAssets(newAssets);
    setPage(Math.ceil(endIndex / itemsPerPage));
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
          <div className="title-section">
            <h1>Immich Viewer</h1>
            <p className="subtitle">Your memories, beautifully organized</p>
          </div>
          
          <div className="search-container">
            <div className="search-box">
              <input
                type="password"
                placeholder="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input api-key-input"
              />
              <input
                type="text"
                placeholder="Album ID"
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input album-id-input"
              />
              <button 
                onClick={() => loadAlbum()} 
                disabled={initialLoading || !apiKey || !albumId} 
                className="btn"
              >
                {initialLoading ? '...' : (isMobile ? 'Load' : 'Load Album')}
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
            {!hasMore && allAssets.length > 0 && (
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

