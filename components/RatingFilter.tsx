import React, { useState } from 'react';
import { StarIcon } from './Icons';

interface RatingFilterProps {
  minRating: number;
  onRatingChange: (rating: number) => void;
}

const RatingFilter: React.FC<RatingFilterProps> = ({ minRating, onRatingChange }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handleRatingClick = (rating: number) => {
    // If clicking the same star again, reset the filter
    if (minRating === rating) {
      onRatingChange(0);
    } else {
      onRatingChange(rating);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-slate-700">Minimum Rating:</span>
      <div className="flex items-center">
        {[...Array(5)].map((_, index) => {
          const ratingValue = index + 1;
          return (
            <button
              key={ratingValue}
              onMouseEnter={() => setHoverRating(ratingValue)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => handleRatingClick(ratingValue)}
              className="focus:outline-none"
              aria-label={`Set minimum rating to ${ratingValue} stars`}
            >
              <StarIcon
                className={`w-6 h-6 cursor-pointer transition-colors ${
                  ratingValue <= (hoverRating || minRating) ? 'text-yellow-400' : 'text-slate-300'
                }`}
              />
            </button>
          );
        })}
        {minRating > 0 && (
          <button
            onClick={() => onRatingChange(0)}
            className="ml-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            aria-label="Clear minimum rating filter"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default RatingFilter;
