
import React, { useMemo } from 'react';
import { Contractor, User, Review } from '../types';
import ContractorCard from './ContractorCard';
import { GlobeAltIcon } from './Icons';

type SortOption = 'monthlyScore' | 'lifetimeScore' | 'nearest';

interface ContractorListProps {
  contractors: Contractor[];
  sortOption: SortOption;
  currentUser: User | null;
  allUsers: User[];
  onAddReview: (contractorId: string, review: Omit<Review, 'id' | 'date'>) => void;
  onRequestQuote: (contractor: Contractor) => void;
  onToggleSave: (contractorId: string) => void;
  onClaim: (contractor: Contractor) => void;
  onEdit: (contractor: Contractor) => void;
  onDelete?: (contractor: Contractor) => void; // New prop for admin delete
  onSearchOnline: () => void;
  isSearchingOnline: boolean;
  onFilterByCategory?: (category: string) => void;
  onFilterByTerm?: (term: string) => void;
  searchTerm?: string;
}

const ContractorList: React.FC<ContractorListProps> = ({ 
  contractors, 
  sortOption, 
  currentUser, 
  allUsers, 
  onAddReview, 
  onRequestQuote, 
  onToggleSave, 
  onClaim, 
  onEdit,
  onDelete,
  onSearchOnline,
  isSearchingOnline,
  onFilterByCategory,
  onFilterByTerm,
  searchTerm
}) => {
  const sortedContractors = useMemo(() => {
    // 1. Sort by the user's selected option first
    const sorted = [...contractors].sort((a, b) => {
      if (sortOption === 'lifetimeScore') {
        return b.lifetimeScore - a.lifetimeScore;
      }
      if (sortOption === 'nearest') {
        const distA = a.distance !== undefined ? a.distance : Infinity;
        const distB = b.distance !== undefined ? b.distance : Infinity;
        return distA - distB;
      }
      // Default sort by monthly score
      return b.monthlyScore - a.monthlyScore;
    });

    // 2. Apply "Promoted" weighting
    // We want promoted items to float to the top, but perhaps not *all* of them if there are many.
    // For now, simple logic: Promoted items always win unless the score difference is massive (handled by simply putting them first)
    return sorted.sort((a, b) => {
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        return 0; // Maintain previous sort order if both are promoted or both are not
    });
  }, [contractors, sortOption]);

  if (sortedContractors.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        {isSearchingOnline ? (
             <div className="flex flex-col items-center">
                <svg className="animate-spin h-10 w-10 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="text-xl font-semibold text-slate-800">Searching National Database...</h3>
                <p className="text-slate-500 mt-2 max-w-md mx-auto">
                    We're currently scanning for verified professionals matching your request. This may take a moment.
                </p>
             </div>
        ) : (
            <>
                <h3 className="text-xl font-semibold text-slate-700">No Local Pros Found</h3>
                <p className="text-slate-500 mt-2 mb-6 max-w-md mx-auto">
                    We couldn't find any contractors in our database matching your criteria. 
                </p>
                <button 
                    onClick={onSearchOnline} 
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <GlobeAltIcon className="w-5 h-5 mr-2" />
                    Force Deep Search
                </button>
            </>
        )}
      </div>
    );
  }

  const renderCard = (c: Contractor, isTop: boolean) => (
    <ContractorCard 
      key={c.id} 
      contractor={c} 
      isTop={isTop} 
      currentUser={currentUser} 
      allUsers={allUsers} 
      onAddReview={onAddReview} 
      onRequestQuote={onRequestQuote}
      onToggleSave={onToggleSave}
      onClaimClick={onClaim}
      onEditClick={onEdit}
      onDelete={onDelete}
      onFilterByCategory={onFilterByCategory}
      onFilterByTerm={onFilterByTerm}
      searchTerm={searchTerm}
    />
  );

  if (sortOption === 'lifetimeScore' || sortOption === 'nearest') {
    return (
      <section>
        <h2 className="text-2xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200">
          {sortOption === 'nearest' ? 'Nearest Professionals' : 'All Contractors (by Lifetime Score)'}
        </h2>
        <div className="grid gap-6 lg:grid-cols-1">
          {sortedContractors.map(c => renderCard(c, false))}
        </div>
      </section>
    );
  }

  // Determine "Top Rated" based on score, but promoted items are already sorted to top.
  // We can treat the first 3 as "Featured/Top" regardless of why they are there.
  const topContractors = sortedContractors.slice(0, 3);
  const otherContractors = sortedContractors.slice(3);

  return (
    <div className="space-y-8">
      {topContractors.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200 flex items-center">
            Featured & Top Rated
          </h2>
          <div className="grid gap-6 lg:grid-cols-1">
            {topContractors.map(c => renderCard(c, true))}
          </div>
        </section>
      )}

      {otherContractors.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-slate-700 mb-4 pb-2 border-b border-slate-200">
            More Professionals
          </h2>
          <div className="grid gap-6 lg:grid-cols-1">
            {otherContractors.map(c => renderCard(c, false))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ContractorList;
