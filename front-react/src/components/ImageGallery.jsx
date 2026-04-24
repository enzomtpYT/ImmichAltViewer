import { useMemo, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ImageCard from './ImageCard';

function ImageGallery({ assets, apiKey, onFullscreen, jumpToDateRequest }) {
  const parentRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth || 1200);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (containerWidth >= 768) return 4;
    return 3;
  }, [containerWidth]);

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
          for (let i = 0; i < currentAssets.length; i += columns) {
            items.push({ type: 'row', assets: currentAssets.slice(i, i + columns) });
          }
        }
        items.push({ type: 'header', date: dateString });
        currentDate = dateString;
        currentAssets = [asset];
      } else {
        currentAssets.push(asset);
      }
    });

    if (currentAssets.length > 0) {
      for (let i = 0; i < currentAssets.length; i += columns) {
        items.push({ type: 'row', assets: currentAssets.slice(i, i + columns) });
      }
    }

    return items;
  }, [assets, columns]);

  const headerIndexMap = useMemo(() => {
    const map = new Map();
    virtualData.forEach((item, index) => {
      if (item.type === 'header') {
        map.set(item.date, index);
      }
    });
    return map;
  }, [virtualData]);

  const estimatedRowHeight = useMemo(() => {
    const horizontalPadding = containerWidth >= 1024 ? 64 : 32;
    const rowGap = 16;
    const availableWidth = Math.max(320, containerWidth - horizontalPadding);
    const cardWidth = Math.floor((availableWidth - rowGap * (columns - 1)) / columns);
    return cardWidth + 16;
  }, [containerWidth, columns]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: virtualData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => virtualData[index].type === 'header' ? 76 : estimatedRowHeight,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 10,
    gap: 0,
  });

  useEffect(() => {
    if (!jumpToDateRequest?.dateString) return;

    const headerIndex = headerIndexMap.get(jumpToDateRequest.dateString);
    if (headerIndex === undefined) return;

    rowVirtualizer.scrollToIndex(headerIndex, { align: 'start' });
  }, [jumpToDateRequest, headerIndexMap, rowVirtualizer]);

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
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: item.type === 'row' ? '16px' : '0'
              }}
            >
              {item.type === 'header' ? (
                <div className="flex items-center justify-between py-4 border-b border-white/5 mb-4 bg-[#0c0c0c] sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-white/80">{item.date}</h2>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
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
                  {/* Fill empty slots in grid if row is shorter than responsive column count */}
                  {item.assets.length < columns && Array.from({ length: columns - item.assets.length }).map((_, i) => (
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
