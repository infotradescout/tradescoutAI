import React, { useState, useMemo } from 'react';
import { Contractor, User } from '../types';
import { ArrowLeftIcon, ScaleIcon, StarIcon, CheckBadgeIcon, BookmarkIcon } from './Icons';
import ComparisonModal from './ComparisonModal';

interface SavedProsDashboardProps {
    savedContractors: Contractor[];
    allUsers: User[];
    onBack: () => void;
    onUnsave: (contractorId: string) => void;
}

const SavedProsDashboard: React.FC<SavedProsDashboardProps> = ({ savedContractors, allUsers, onBack, onUnsave }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

    const handleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const contractorsToCompare = useMemo(() => {
        return savedContractors.filter(c => selectedIds.includes(c.id));
    }, [selectedIds, savedContractors]);

    const canCompare = selectedIds.length >= 2 && selectedIds.length <= 4;

    const getAverageRating = (reviews: any[]): number => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((acc, review) => acc + review.rating, 0);
        return parseFloat((total / reviews.length).toFixed(1));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Back to Search
                </button>
                <button 
                    onClick={() => setIsCompareModalOpen(true)}
                    disabled={!canCompare}
                    className="flex items-center px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors duration-200 bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                    <ScaleIcon className="w-5 h-5 mr-2" />
                    Compare Selected ({selectedIds.length})
                </button>
            </div>

            <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">My Saved Pros</h1>
            <p className="text-slate-600 mb-6">Select 2 to 4 contractors to compare them side-by-side.</p>

            {savedContractors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedContractors.map(c => (
                        <div key={c.id} className={`bg-white rounded-lg shadow-md border transition-all duration-300 ${selectedIds.includes(c.id) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-200'}`}>
                            <div className="p-4">
                                <div className="flex items-center space-x-4 mb-3">
                                    <img src={c.avatarUrl} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-slate-800">{c.name}</h3>
                                            {c.verified && <CheckBadgeIcon className="w-5 h-5 text-sky-500 flex-shrink-0" />}
                                        </div>
                                        <p className="text-sm text-slate-500">{c.category}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center space-x-1 text-yellow-400">
                                      <StarIcon className="w-4 h-4" />
                                      <span className="font-bold text-slate-700">{getAverageRating(c.reviews)}</span>
                                      <span className="text-slate-500">({c.reviews.length} reviews)</span>
                                    </div>
                                    <span className="font-bold text-slate-600">{c.lifetimeScore} Lifetime Score</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center">
                                <label htmlFor={`compare-${c.id}`} className="flex items-center cursor-pointer text-sm font-medium text-slate-700">
                                    <input 
                                        type="checkbox" 
                                        id={`compare-${c.id}`} 
                                        checked={selectedIds.includes(c.id)}
                                        onChange={() => handleSelect(c.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2">Select to Compare</span>
                                </label>
                                <button
                                    onClick={() => onUnsave(c.id)}
                                    className="flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                    aria-label={`Unsave ${c.name}`}
                                >
                                    <BookmarkIcon className="w-5 h-5" solid />
                                    <span className="ml-1">Unsave</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-lg">
                    <BookmarkIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-xl font-semibold text-slate-700">No Saved Contractors</h3>
                    <p className="mt-1 text-slate-500">You haven't saved any contractors yet. Click the "Save" button on a contractor's card to add them here.</p>
                </div>
            )}
            
            <ComparisonModal 
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                contractors={contractorsToCompare}
            />
        </div>
    );
};

export default SavedProsDashboard;