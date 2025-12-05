import React from 'react';
import { ListBulletIcon, MapIcon } from './Icons';

type ViewMode = 'list' | 'map';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
  const baseClasses = 'p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
  const activeClasses = 'bg-indigo-600 text-white shadow';
  const inactiveClasses = 'bg-white text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200';

  return (
    <div className="flex space-x-2 p-1 bg-slate-200 rounded-lg">
      <button
        onClick={() => onViewChange('list')}
        className={`${baseClasses} ${currentView === 'list' ? activeClasses : inactiveClasses}`}
        aria-label="Switch to list view"
      >
        <ListBulletIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => onViewChange('map')}
        className={`${baseClasses} ${currentView === 'map' ? activeClasses : inactiveClasses}`}
        aria-label="Switch to map view"
      >
        <MapIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ViewToggle;
