import { useState, useEffect, useCallback } from 'react';
import ImageGallery from './ImageGallery';
import FullscreenViewer from './FullscreenViewer';
import DateSlider from './DateSlider';
import { Settings, Image as ImageIcon, Loader2, Bookmark, Trash2, Calendar, X } from 'lucide-react';

const API_URL = ''; // Relative URL for production
const ALBUM_COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#f97316'  // Orange
];

const getStableColorForAlbum = (albumId) => {
  let hash = 0;
  for (let i = 0; i < albumId.length; i++) {
    hash = (hash * 31 + albumId.charCodeAt(i)) >>> 0;
  }
  return ALBUM_COLOR_PALETTE[hash % ALBUM_COLOR_PALETTE.length];
};

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
  const [savedAlbums, setSavedAlbums] = useState(() => {
    const saved = getSafeItem('immich_saved_albums', '[]');
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved albums:', e);
      return [];
    }
  });
  const [selectedAlbumIds, setSelectedAlbumIds] = useState(() => {
    const saved = getSafeItem('immich_selected_album_ids', '[]');
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse selected album IDs:', e);
      return [];
    }
  });
  const [albumName, setAlbumName] = useState('');
  const [allAssets, setAllAssets] = useState([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreenAsset, setFullscreenAsset] = useState(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [jumpToDateRequest, setJumpToDateRequest] = useState(null);
  const [showMobileTimeline, setShowMobileTimeline] = useState(false);

  const getAlbumDisplayName = useCallback((id) => {
    const saved = savedAlbums.find((album) => album.id === id);
    return saved?.name || `Album ${id.slice(0, 8)}`;
  }, [savedAlbums]);

  // Save to localStorage
  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem('immich_api_key', apiKey);
      if (albumId) localStorage.setItem('immich_album_id', albumId);
      localStorage.setItem('immich_saved_albums', JSON.stringify(savedAlbums));
      localStorage.setItem('immich_selected_album_ids', JSON.stringify(selectedAlbumIds));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [apiKey, albumId, savedAlbums, selectedAlbumIds]);

  const loadAlbum = useCallback(async (providedKey, providedId) => {
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

      setAllAssets(data.map((asset) => ({
        ...asset,
        sourceAlbumId: idToUse,
        sourceAlbumName: getAlbumDisplayName(idToUse),
        sourceColor: null,
      })));
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
  }, [apiKey, albumId, getAlbumDisplayName]);

  const loadSelectedAlbums = useCallback(async (providedKey, providedIds) => {
    const keyToUse = providedKey || apiKey;
    const idsToUse = providedIds || selectedAlbumIds;

    if (!Array.isArray(idsToUse) || idsToUse.length === 0) {
      setError('Please select at least one bookmark to load');
      return;
    }

    if (!keyToUse?.trim()) {
      setError('Please enter your Immich API key');
      return;
    }

    if (idsToUse.length === 1) {
      loadAlbum(keyToUse, idsToUse[0]);
      return;
    }

    setError('');
    setInitialLoading(true);
    setAllAssets([]);

    try {
      const responses = await Promise.all(
        idsToUse.map(async (id, sourceSortIndex) => {
          const response = await fetch(`${API_URL}/albums/${id}/assets`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
          }
          const albumAssets = await response.json();
          if (!Array.isArray(albumAssets)) {
            throw new Error('Server returned invalid data format');
          }
          return albumAssets.map((asset) => ({
            ...asset,
            sourceAlbumId: id,
            sourceAlbumName: getAlbumDisplayName(id),
            sourceColor: getStableColorForAlbum(id),
            sourceSortIndex,
          }));
        })
      );

      const dedupedByAssetId = new Map();
      responses.flat().forEach((asset) => {
        if (!dedupedByAssetId.has(asset.assetId)) {
          dedupedByAssetId.set(asset.assetId, asset);
        }
      });

      const data = Array.from(dedupedByAssetId.values()).sort((a, b) => {
        const byDate = new Date(b.createdAt) - new Date(a.createdAt);
        if (byDate !== 0) return byDate;
        return (a.sourceSortIndex ?? 0) - (b.sourceSortIndex ?? 0);
      });

      data.forEach((asset) => {
        delete asset.sourceSortIndex;
      });

      setAllAssets(data);
      if (data.length === 0) {
        setError('No assets found in the selected albums');
      }
      setShowConfig(false);
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Failed to load selected albums:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [apiKey, selectedAlbumIds, loadAlbum, getAlbumDisplayName]);

  // Auto-load album if credentials are saved
  useEffect(() => {
    const savedApiKey = getSafeItem('immich_api_key', '');
    const savedAlbumId = getSafeItem('immich_album_id', '');
    const savedSelectedAlbumIds = getSafeItem('immich_selected_album_ids', '[]');
    let parsedSelectedAlbumIds = [];

    try {
      const parsed = JSON.parse(savedSelectedAlbumIds);
      parsedSelectedAlbumIds = Array.isArray(parsed) ? parsed : [];
    } catch {
      parsedSelectedAlbumIds = [];
    }
    
    if (savedApiKey && allAssets.length === 0 && !initialLoading) {
      if (parsedSelectedAlbumIds.length > 0) {
        if (parsedSelectedAlbumIds.length === 1) {
          loadAlbum(savedApiKey, parsedSelectedAlbumIds[0]);
        } else {
          loadSelectedAlbums(savedApiKey, parsedSelectedAlbumIds);
        }
      } else if (savedAlbumId) {
        loadAlbum(savedApiKey, savedAlbumId);
      }
    }
  }, [loadAlbum, loadSelectedAlbums, allAssets.length, initialLoading]);

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

    // Trigger a distinct request each time so repeated clicks on the same date still jump.
    setJumpToDateRequest({ dateString, requestId: Date.now() });
  };

  const handleKeyPress = (e) => {
    if (e.key !== 'Enter') return;

    if (selectedAlbumIds.length > 1) {
      loadSelectedAlbums();
      return;
    }

    if (selectedAlbumIds.length === 1) {
      loadAlbum(undefined, selectedAlbumIds[0]);
      return;
    }

    loadAlbum();
  };

  const saveCurrentAlbum = () => {
    if (!albumId.trim()) return;
    
    const nameToSave = albumName.trim() || `Album ${albumId.substring(0, 8)}`;
    const newAlbum = {
      id: albumId,
      name: nameToSave,
      savedAt: Date.now()
    };

    setSavedAlbums(prev => {
      const filtered = prev.filter(a => a.id !== albumId);
      return [newAlbum, ...filtered];
    });
    setAlbumName('');
  };

  const removeSavedAlbum = (id) => {
    setSavedAlbums(prev => prev.filter(a => a.id !== id));
    setSelectedAlbumIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const toggleAlbumSelection = (id) => {
    setSelectedAlbumIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      }
      return [...prev, id];
    });
  };

  const selectAllAlbums = () => {
    setSelectedAlbumIds(savedAlbums.map((album) => album.id));
  };

  useEffect(() => {
    if (selectedAlbumIds.length === 1) {
      setAlbumId(selectedAlbumIds[0]);
    }
  }, [selectedAlbumIds]);

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
              <div className="flex flex-col">
                <p className="text-xs text-white/40 font-medium">
                  {allAssets.length.toLocaleString()} Memories
                </p>
                {selectedAlbumIds.length > 1 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 max-w-md">
                    {selectedAlbumIds.map(id => {
                      const album = savedAlbums.find(a => a.id === id);
                      if (!album) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 min-w-0">
                          <div 
                            className="w-1.5 h-1.5 rounded-full flex-none" 
                            style={{ backgroundColor: getStableColorForAlbum(id) }}
                          />
                          <span className="text-[10px] text-white/30 truncate max-w-[100px]">{album.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
        <div className="flex-none p-6 bg-immich-glass backdrop-blur-xl border-b border-white/10 animate-fade-in space-y-6">
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
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (selectedAlbumIds.length === 1) {
                    loadAlbum(undefined, selectedAlbumIds[0]);
                  } else {
                    loadSelectedAlbums();
                  }
                }} 
                disabled={initialLoading || !apiKey || selectedAlbumIds.length === 0} 
                className="flex-1 bg-immich-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-immich-primary text-white text-sm font-semibold rounded-lg px-6 py-2 transition-all shadow-lg shadow-immich-primary/20"
              >
                {initialLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : selectedAlbumIds.length === 1 ? 'Load Album' : `Load Selected (${selectedAlbumIds.length})`}
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto border-t border-white/5 pt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-immich-primary" />
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Save Bookmark</p>
                </div>
                <input
                  type="text"
                  placeholder="Bookmark name (optional)"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveCurrentAlbum()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-immich-primary/50 transition-colors text-white"
                />
                <button
                  onClick={saveCurrentAlbum}
                  disabled={!albumId}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-white/10 text-white/80 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                  title="Save current UUID as bookmark"
                >
                  <Bookmark className="w-4 h-4" />
                  Save Current Album
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Saved Bookmarks</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40">{selectedAlbumIds.length} selected</span>
                  <button
                    onClick={selectAllAlbums}
                    disabled={savedAlbums.length === 0 || selectedAlbumIds.length === savedAlbums.length}
                    className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-white/10 text-white/80 text-xs font-medium rounded-md px-2 py-1 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedAlbumIds([])}
                    disabled={selectedAlbumIds.length === 0}
                    className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:hover:bg-white/10 text-white/80 text-xs font-medium rounded-md px-2 py-1 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-white/35 mb-3">Click a bookmark card to include/exclude it from the next load.</p>
              {savedAlbums.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {savedAlbums.map((saved) => (
                    <div
                      key={saved.id}
                      className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition-all ${
                        selectedAlbumIds.includes(saved.id)
                          ? 'bg-immich-primary/20 border-immich-primary/60'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        onClick={() => toggleAlbumSelection(saved.id)}
                        className="flex-1 min-w-0 text-left flex items-start gap-2"
                      >
                        <span className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px] ${selectedAlbumIds.includes(saved.id) ? 'border-immich-primary bg-immich-primary text-white' : 'border-white/25 text-transparent'}`}>✓</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div 
                              className="w-2.5 h-2.5 rounded-full flex-none shadow-sm ring-1 ring-white/20" 
                              style={{ backgroundColor: getStableColorForAlbum(saved.id) }}
                            />
                            <p className="text-sm font-medium text-white truncate leading-tight">{saved.name}</p>
                          </div>
                          <p className="text-[11px] text-white/35 truncate pl-3.5 leading-tight">{saved.id}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => removeSavedAlbum(saved.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors flex-none ml-2"
                        title="Delete bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/20 italic py-2">No bookmarks yet. Save your current album to switch faster later.</p>
              )}
            </div>
          </div>

          {error && (
            <div className="max-w-4xl mx-auto mt-4 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20 animate-fade-in">
              {error}
            </div>
          )}
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
                jumpToDateRequest={jumpToDateRequest}
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
                  compact={false}
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
      
      {isMobile && allAssets.length > 0 && !fullscreenAsset && (
        <>
          <button
            onClick={() => setShowMobileTimeline(true)}
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md"
            aria-label="Open timeline"
          >
            <Calendar className="h-4 w-4" />
            Timeline
          </button>

          {showMobileTimeline && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/60">
              <button
                className="absolute inset-0"
                onClick={() => setShowMobileTimeline(false)}
                aria-label="Close timeline"
              />
              <div className="relative w-full rounded-t-2xl border-t border-white/10 bg-[#0c0c0c] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Timeline</p>
                  <button
                    onClick={() => setShowMobileTimeline(false)}
                    className="rounded-md p-1.5 text-white/70 hover:bg-white/10"
                    aria-label="Close timeline panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <DateSlider
                  assets={allAssets}
                  onDateSelect={handleDateSelect}
                  compact
                  onClose={() => setShowMobileTimeline(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AlbumViewer;

