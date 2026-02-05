import { useState, useEffect, useRef } from 'react';
import './DateSlider.css';

function DateSlider({ assets, onDateSelect }) {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    // Extract unique dates from assets
    const uniqueDates = [];
    const dateMap = new Map();

    assets.forEach((asset) => {
      const date = new Date(asset.createdAt);
      const dateString = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!dateMap.has(dateString)) {
        dateMap.set(dateString, {
          dateString,
          timestamp: date.getTime(),
          count: 1,
          firstAssetIndex: assets.indexOf(asset)
        });
        uniqueDates.push(dateMap.get(dateString));
      } else {
        dateMap.get(dateString).count++;
      }
    });

    setDates(uniqueDates);
  }, [assets]);

  const handleDateClick = (date) => {
    setSelectedDate(date.dateString);
    onDateSelect(date.dateString);
  };

  if (dates.length === 0) return null;

  return (
    <div className="date-slider">
      <div className="date-slider-header">
        <h3>📅 Timeline</h3>
        <p className="date-count">{dates.length} days</p>
      </div>
      
      <div className="date-slider-content">
        {dates.map((date, index) => {
          const dateObj = new Date(date.timestamp);
          const isSelected = selectedDate === date.dateString;
          
          return (
            <div
              key={index}
              className={`date-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleDateClick(date)}
            >
              <div className="date-marker"></div>
              <div className="date-info">
                <div className="date-day">
                  {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="date-number">
                  {dateObj.getDate()}
                </div>
                <div className="date-month">
                  {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                </div>
                <div className="date-photo-count">{date.count}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DateSlider;
