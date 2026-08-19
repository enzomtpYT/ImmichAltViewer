import { useState, useEffect, useCallback, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import ImageGallery from './ImageGallery';
import DateSlider from './DateSlider';
import { formatDateKey } from '../utils/dates';
import { Settings, Image as ImageIcon, Loader2, Bookmark, Trash2, Calendar, X, Keyboard } from 'lucide-react';

const FullscreenViewer = lazy(() => import('./FullscreenViewer'));

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

function ShortcutRow({ keys, action }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-white/70">{action}</span>
      <kbd className="flex-none min-w-[3.5rem] rounded-md border border-white/15 bg-white/5 px-2 py-1 text-center font-mono text-[11px] text-white/80">{keys}</kbd>
    </div>
  );
}

function AlbumViewer() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const [showHelp, setShowHelp] = useState(false);
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
        _dateKey: formatDateKey(asset.createdAt),
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
      const response = await fetch(`${API_URL}/albums/assets?ids=${encodeURIComponent(idsToUse.join(','))}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Server returned invalid data format');
      }

      const formattedAssets = data.map((asset) => {
        const albumId = asset.sourceAlbumId || idsToUse[0];
        return {
          ...asset,
          _dateKey: formatDateKey(asset.createdAt),
          sourceAlbumId: albumId,
          sourceAlbumName: getAlbumDisplayName(albumId),
          sourceColor: getStableColorForAlbum(albumId),
        };
      });

      setAllAssets(formattedAssets);
      if (formattedAssets.length === 0) {
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

  // Global shortcut to toggle the keyboard shortcuts dialog
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      const target = e.target;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '?') {
        if (!isTyping) {
          e.preventDefault();
          setShowHelp(prev => !prev);
        }
      } else if (e.key === 'Escape') {
        setShowHelp(false);
      }
    };

    document.addEventListener('keydown', handleGlobalKeys);
    return () => document.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const dateToIndex = useMemo(() => {
    const map = new Map();
    allAssets.forEach((asset, index) => {
      const key = asset._dateKey || formatDateKey(asset.createdAt);
      if (key && !map.has(key)) map.set(key, index);
    });
    return map;
  }, [allAssets]);

  const handleDateSelect = useCallback((dateString) => {
    if (dateToIndex.has(dateString)) {
      // Trigger a distinct request each time so repeated clicks on the same date still jump.
      setJumpToDateRequest({ dateString, requestId: Date.now() });
    }
  }, [dateToIndex]);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('ALL'); // 'ALL' | 'IMAGE' | 'VIDEO'

  // Defer filtering while the user is typing so the gallery isn't rebuilt per keystroke
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredAssets = useMemo(() => {
    return allAssets.filter((asset) => {
      if (mediaTypeFilter === 'IMAGE' && asset.type !== 'IMAGE') return false;
      if (mediaTypeFilter === 'VIDEO' && asset.type !== 'VIDEO') return false;

      if (deferredSearchQuery.trim()) {
        const query = deferredSearchQuery.toLowerCase().trim();
        const filename = (asset.originalFileName || '').toLowerCase();
        const assetId = asset.assetId.toLowerCase();
        if (!filename.includes(query) && !assetId.includes(query)) return false;
      }

      return true;
    });
  }, [allAssets, mediaTypeFilter, deferredSearchQuery]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex-none z-30 bg-black/40 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-immich-primary p-2 rounded-lg">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white/90">Immich Viewer</h1>
            {allAssets.length > 0 && (
              <div className="flex flex-col">
                <p className="text-xs text-white/40 font-medium">
                  {filteredAssets.length.toLocaleString()} {filteredAssets.length === allAssets.length ? 'Memories' : `of ${allAssets.length.toLocaleString()} Memories`}
                </p>
              </div>
            )}
          </div>
        </div>

        {allAssets.length > 0 && (
          <div className="flex items-center gap-2 flex-1 max-w-md mx-0 md:mx-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-immich-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setMediaTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${mediaTypeFilter === 'ALL' ? 'bg-immich-primary text-white' : 'text-white/50 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setMediaTypeFilter('IMAGE')}
                className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${mediaTypeFilter === 'IMAGE' ? 'bg-immich-primary text-white' : 'text-white/50 hover:text-white'}`}
              >
                Photos
              </button>
              <button
                onClick={() => setMediaTypeFilter('VIDEO')}
                className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${mediaTypeFilter === 'VIDEO' ? 'bg-immich-primary text-white' : 'text-white/50 hover:text-white'}`}
              >
                Videos
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 self-end md:self-auto">
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className={`w-5 h-5 ${showHelp ? 'text-immich-primary' : 'text-white/60'}`} />
          </button>
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

        {filteredAssets.length > 0 ? (
          <div className="h-full flex">
            <div className="flex-1 min-w-0">
              <ImageGallery 
                assets={filteredAssets} 
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
                  assets={filteredAssets}
                  onDateSelect={handleDateSelect}
                  compact={false}
                />
              </div>
            )}
          </div>
        ) : allAssets.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 p-8 text-center">
            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium text-white/80">No matching assets found</p>
            <p className="text-sm text-white/40">Try clearing your search query or media type filter</p>
            <button 
              onClick={() => { setSearchQuery(''); setMediaTypeFilter('ALL'); }}
              className="mt-4 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
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
        <Suspense fallback={null}>
          <FullscreenViewer
            assets={filteredAssets}
            currentIndex={fullscreenIndex}
            apiKey={apiKey}
            onClose={() => setFullscreenAsset(null)}
            onNavigate={(newIndex) => {
              setFullscreenIndex(newIndex);
              setFullscreenAsset(filteredAssets[newIndex]);
            }}
          />
        </Suspense>
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

      {showHelp && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <button
            className="absolute inset-0"
            onClick={() => setShowHelp(false)}
            aria-label="Close keyboard shortcuts"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-immich-primary" /> Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-full transition-colors"
                aria-label="Close keyboard shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5 space-y-6">
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Gallery</h3>
                <ShortcutRow keys="Enter" action="Open focused image in fullscreen" />
                <ShortcutRow keys="?" action="Show / hide this shortcuts list" />
              </section>
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Fullscreen Viewer</h3>
                <ShortcutRow keys="Esc" action="Close / leave fullscreen" />
                <ShortcutRow keys="←  →" action="Previous / next asset" />
                <ShortcutRow keys="Space" action="Start / pause slideshow" />
                <ShortcutRow keys="↓" action="Download asset" />
                <ShortcutRow keys="I" action="Toggle asset info panel" />
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlbumViewer;

