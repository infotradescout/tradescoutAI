
import React from 'react';

type SortOption = 'monthlyScore' | 'lifetimeScore' | 'nearest';

interface SortControlProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  hasLocation: boolean;
}

const SortControl: React.FC<SortControlProps> = ({ sortOption, onSortChange, hasLocation }) => {
  const baseButtonClasses = 'px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full';
  const activeButtonClasses = 'bg-indigo-600 text-white shadow';
  const inactiveButtonClasses = 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200';
  const disabledButtonClasses = 'bg-slate-100 text-slate-400 cursor-not-allowed';

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-3">Sort By</h3>
      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
        <button
          onClick={() => onSortChange('monthlyScore')}
          className={`${baseButtonClasses} ${sortOption === 'monthlyScore' ? activeButtonClasses : inactiveButtonClasses}`}
        >
          Top Rated
        </button>
        <button
          onClick={() => onSortChange('lifetimeScore')}
          className={`${baseButtonClasses} ${sortOption === 'lifetimeScore' ? activeButtonClasses : inactiveButtonClasses}`}
        >
          Most Trusted
        </button>
        <button
          onClick={() => onSortChange('nearest')}
          disabled={!hasLocation}
          className={`${baseButtonClasses} ${!hasLocation ? disabledButtonClasses : sortOption === 'nearest' ? activeButtonClasses : inactiveButtonClasses}`}
          title={!hasLocation ? "Location access required" : "Sort by distance"}
        >
          Nearest Me
        </button>
      </div>
    </div>
  );
};

export default SortControl;
