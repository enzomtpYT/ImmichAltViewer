import { useMemo } from 'react';
import ImageCard from './ImageCard';
import './ImageGallery.css';

function ImageGallery({ assets, apiKey, onFullscreen }) {
  // Group assets by day - Memoized for performance
  const groupedAssets = useMemo(() => {
    const groups = [];
    let currentDate = null;
    let currentGroup = [];

    assets.forEach((asset) => {
      const assetDate = new Date(asset.createdAt);
      const dateString = assetDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      if (dateString !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, assets: currentGroup });
        }
        currentDate = dateString;
        currentGroup = [asset];
      } else {
        currentGroup.push(asset);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, assets: currentGroup });
    }

    return groups;
  }, [assets]);


  return (
    <div>
      {groupedAssets.map((group, groupIndex) => (
        <div key={groupIndex} className="gallery-day-group">
          <div className="day-separator">
            <h2 className="day-title">{group.date}</h2>
            <div className="day-count">{group.assets.length} photos</div>
          </div>
          <div className="gallery">
            {group.assets.map((asset) => (
              <ImageCard
                key={asset.assetId}
                asset={asset}
                apiKey={apiKey}
                onFullscreen={onFullscreen}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ImageGallery;
