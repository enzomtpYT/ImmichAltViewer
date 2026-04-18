import { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ImageCard from './ImageCard';

function ImageGallery({ assets, apiKey, onFullscreen }) {
  const parentRef = useRef(null);

  // Flat list of items (headers + image rows)
  const virtualData = useMemo(() => {
    const items = [];
    let currentDate = null;
    let currentAssets = [];

    assets.forEach((asset) => {
      const assetDate = new Date(asset.createdAt);
      const dateString = assetDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      if (dateString !== currentDate) {
        if (currentAssets.length > 0) {
          // Push row chunks for previous date
          const rows = [];
          for (let i = 0; i < currentAssets.length; i += 4) {
            items.push({ type: 'row', assets: currentAssets.slice(i, i + 4) });
          }
        }
        items.push({ type: 'header', date: dateString, count: 0 }); // Count updated later
        currentDate = dateString;
        currentAssets = [asset];
      } else {
        currentAssets.push(asset);
      }
    });

    if (currentAssets.length > 0) {
      for (let i = 0; i < currentAssets.length; i += 4) {
        items.push({ type: 'row', assets: currentAssets.slice(i, i + 4) });
      }
    }

    // Update counts in headers (optional but nice)
    return items;
  }, [assets]);

  const rowVirtualizer = useVirtualizer({
    count: virtualData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => virtualData[index].type === 'header' ? 76 : 400,
    overscan: 5,
  });

  return (
    <div 
      ref={parentRef} 
      className="h-full overflow-y-auto scroll-smooth custom-scrollbar px-4 lg:px-8 py-4"
    >
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = virtualData[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              className="absolute top-0 left-0 w-full"
              style={{
                minHeight: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: item.type === 'row' ? '16px' : '0'
              }}
            >
              {item.type === 'header' ? (
                <div className="flex items-center justify-between py-4 border-b border-white/5 mb-4 bg-[#0c0c0c]/80 backdrop-blur-sm sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-white/80">{item.date}</h2>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {item.assets.map((asset) => (
                    <ImageCard
                      key={asset.assetId}
                      asset={asset}
                      apiKey={apiKey}
                      onFullscreen={(targetAsset) => {
                        const globalIndex = assets.findIndex(a => a.assetId === targetAsset.assetId);
                        onFullscreen(targetAsset, globalIndex);
                      }}
                    />
                  ))}
                  {/* Fill empty slots in grid if row is shorter than 4 */}
                  {item.assets.length < 4 && Array.from({ length: 4 - item.assets.length }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ImageGallery;
