import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Calendar, ChevronRight } from 'lucide-react';
import { formatDateKey } from '../utils/dates';

function DateSlider({ assets, onDateSelect, compact = false, onClose }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const scrollRef = useRef(null);

  const dates = useMemo(() => {
    const uniqueDates = [];
    const dateMap = new Map();

    assets.forEach((asset) => {
      const date = new Date(asset.createdAt);
      const dateString = asset._dateKey || formatDateKey(asset.createdAt);

      if (!dateMap.has(dateString)) {
        const item = {
          dateString,
          timestamp: date.getTime(),
          count: 1,
        };
        dateMap.set(dateString, item);
        uniqueDates.push(item);
      } else {
        dateMap.get(dateString).count++;
      }
    });

    return uniqueDates;
  }, [assets]);

  const rowVirtualizer = useVirtualizer({
    count: dates.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  const handleDateClick = (date) => {
    setSelectedDate(date.dateString);
    onDateSelect(date.dateString);
    onClose?.();
  };

  if (dates.length === 0) return null;

  return (
    <div className={`flex flex-col ${compact ? 'h-[min(70vh,520px)]' : 'h-full'}`}>
      <div className={`border-b border-white/5 flex items-center justify-between ${compact ? 'p-3' : 'p-4'}`}>
        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Timeline
        </h3>
        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/30 border border-white/5">
          {dates.length} DAYS
        </span>
      </div>
      
      <div ref={scrollRef} className={`flex-1 overflow-y-auto custom-scrollbar ${compact ? 'p-1.5' : 'p-2'}`}>
        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const date = dates[virtualRow.index];
            const dateObj = new Date(date.timestamp);
            const isSelected = selectedDate === date.dateString;

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 ${
                    isSelected 
                    ? 'bg-immich-primary shadow-lg shadow-immich-primary/20 text-white' 
                    : 'hover:bg-white/5 text-white/60 hover:text-white'
                  }`}
                  onClick={() => handleDateClick(date)}
                >
                  <div className={`flex flex-col items-center justify-center min-w-[40px] h-[40px] rounded-lg border ${
                    isSelected ? 'bg-white/20 border-white/20' : 'bg-black/20 border-white/5 group-hover:border-white/10'
                  }`}>
                    <span className="text-[10px] font-bold opacity-60 leading-none">
                      {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-lg font-black leading-none mt-0.5">
                      {dateObj.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="text-[10px] opacity-40 font-medium">
                          {dateObj.getFullYear()} • {date.count} photos
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'opacity-100 scale-110' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DateSlider;
