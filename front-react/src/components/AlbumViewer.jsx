import { useState, useEffect } from 'react';
import ImageGallery from './ImageGallery';
import FullscreenViewer from './FullscreenViewer';
import DateSlider from './DateSlider';
import { Settings, Image as ImageIcon, Loader2 } from 'lucide-react';

const API_URL = ''; // Relative URL for production

function AlbumViewer() {
  const isMobile = window.innerWidth <= 768;

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
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreenAsset, setFullscreenAsset] = useState(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

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

    try {
      const response = await fetch(`${API_URL}/albums/${idToUse}/assets`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Server returned invalid data format');
      }

      setAllAssets(data);
      if (data.length === 0) {
        setError('No assets found in this album');
      }
      setShowConfig(false);
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Failed to load album:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleDateSelect = (dateString) => {
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

    // We'll let ImageGallery handle the scrolling since it manages the virtual list
    return targetAssetIndex;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      loadAlbum();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex-none z-30 bg-black/40 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-immich-primary p-2 rounded-lg">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white/90">Immich Viewer</h1>
            {allAssets.length > 0 && (
              <p className="text-xs text-white/40 font-medium">
                {allAssets.length.toLocaleString()} Memories
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Settings className={`w-5 h-5 ${showConfig ? 'text-immich-primary' : 'text-white/60'}`} />
          </button>
        </div>
      </header>

      {showConfig && (
        <div className="flex-none p-6 bg-immich-glass backdrop-blur-xl border-b border-white/10 animate-fade-in">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                placeholder="Paste key here"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-immich-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Album UUID</label>
              <input
                type="text"
                placeholder="Enter ID"
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-immich-primary/50 transition-colors"
              />
            </div>
            <button 
              onClick={() => loadAlbum()} 
              disabled={initialLoading || !apiKey || !albumId} 
              className="bg-immich-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-immich-primary text-white text-sm font-semibold rounded-lg px-6 py-2 transition-all shadow-lg shadow-immich-primary/20"
            >
              {initialLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Load Memories'}
            </button>
          </div>
          {error && <div className="mt-4 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{error}</div>}
        </div>
      )}

      <main className="flex-1 relative overflow-hidden bg-[#0c0c0c]">
        {initialLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-immich-primary animate-spin mb-4" />
            <p className="text-white/60 font-medium animate-pulse">Reliving your moments...</p>
          </div>
        )}

        {allAssets.length > 0 ? (
          <div className="h-full flex">
            <div className="flex-1 min-w-0">
              <ImageGallery 
                assets={allAssets} 
                apiKey={apiKey}
                onFullscreen={(asset, index) => {
                  setFullscreenIndex(index);
                  setFullscreenAsset(asset);
                }}
              />
            </div>
            {!isMobile && (
              <div className="w-64 border-l border-white/5 bg-black/20">
                <DateSlider
                  assets={allAssets}
                  onDateSelect={handleDateSelect}
                />
              </div>
            )}
          </div>
        ) : !initialLoading && (
          <div className="flex flex-col items-center justify-center h-full text-white/20 p-8 text-center">
            <ImageIcon className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">No assets loaded</p>
            <p className="text-sm">Enter your credentials to see your memories</p>
            <button 
              onClick={() => setShowConfig(true)}
              className="mt-4 text-immich-primary hover:underline text-sm font-medium"
            >
              Open Settings
            </button>
          </div>
        )}
      </main>

      {fullscreenAsset && (
        <FullscreenViewer
          assets={allAssets}
          currentIndex={fullscreenIndex}
          apiKey={apiKey}
          onClose={() => setFullscreenAsset(null)}
          onNavigate={(newIndex) => {
            setFullscreenIndex(newIndex);
            setFullscreenAsset(allAssets[newIndex]);
          }}
        />
      )}
      
      {isMobile && allAssets.length > 0 && (
         <div className="fixed bottom-4 right-4 z-40">
            <DateSlider
              assets={allAssets}
              onDateSelect={handleDateSelect}
            />
         </div>
      )}
    </div>
  );
}

export default AlbumViewer;

