
import React, { useState, useMemo } from 'react';
import { Contractor, User, Review } from '../types';
import { StarIcon, MapPinIcon, BriefcaseIcon, CheckBadgeIcon, SparklesIcon, DocumentTextIcon, ClipboardDocumentListIcon, BookmarkIcon, PencilIcon, GlobeAltIcon, PhoneIcon, ChevronDownIcon, ShieldCheckIcon, MapIcon } from './Icons';
import ReviewForm from './ReviewForm';
import { GoogleGenAI } from '@google/genai';

interface ContractorCardProps {
  contractor: Contractor;
  isTop: boolean;
  currentUser: User | null;
  allUsers: User[];
  onAddReview: (contractorId: string, review: Omit<Review, 'id' | 'date' >) => void;
  onRequestQuote: (contractor: Contractor) => void;
  onToggleSave: (contractorId: string) => void;
  onClaimClick: (contractor: Contractor) => void;
  onEditClick: (contractor: Contractor) => void;
  onFilterByCategory?: (category: string) => void;
  onFilterByTerm?: (term: string) => void;
  searchTerm?: string;
}

const HighlightedText: React.FC<{ text: string; highlight?: string }> = ({ text, highlight }) => {
    if (!highlight || !highlight.trim()) {
        return <>{text}</>;
    }

    const lowerHighlight = highlight.toLowerCase();
    const phrases = (lowerHighlight.match(/"([^"]+)"/g) || []).map(p => p.replace(/"/g, ''));
    let remaining = lowerHighlight.replace(/"([^"]+)"/g, '');
    remaining = remaining.replace(/-\S+/g, ''); // Remove exclusions
    const keywords = remaining.split(/\s+/).filter(k => k.trim().length > 0);

    const terms = [...phrases, ...keywords]
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .sort((a, b) => b.length - a.length);

    if (terms.length === 0) return <>{text}</>;

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
    const parts = text.split(pattern);

    return (
        <>
            {parts.map((part, i) => {
                const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
                return isMatch ? (
                    <span key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5 font-medium">{part}</span>
                ) : (
                    part
                );
            })}
        </>
    );
};

const ContractorCard: React.FC<ContractorCardProps> = ({ 
  contractor, 
  isTop, 
  currentUser, 
  allUsers, 
  onAddReview, 
  onRequestQuote, 
  onToggleSave, 
  onClaimClick, 
  onEditClick,
  onFilterByCategory,
  onFilterByTerm,
  searchTerm
}) => {
  const { id, name, avatarUrl, category, location, monthlyScore, lifetimeScore, description, specialties, reviews, verified, claimed, phone, website, distance, sourceUrl } = contractor;
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewSummary, setReviewSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    return parseFloat((total / reviews.length).toFixed(1));
  }, [reviews]);

  const isSaved = useMemo(() => {
    return currentUser?.savedContractorIds?.includes(id) ?? false;
  }, [currentUser, id]);

  const getUserById = (userId: string) => allUsers.find(u => u.id === userId);

  const handleContact = () => {
    alert(`Your contact request has been sent to ${name}! They will get back to you shortly.`);
  }

  const generateReviewSummary = async () => {
    setIsSummaryLoading(true);
    setSummaryError('');
    setReviewSummary('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      let prompt = '';
      if (reviews.length > 0) {
          const reviewText = reviews.map(r => `- Rating: ${r.rating}/5\n- Comment: ${r.comment}`).join('\n---\n');
          prompt = `Summarize the following customer reviews for a contractor named ${name}. Provide a brief, neutral summary focusing on common praises and critiques. Use markdown bullet points for clarity under "Praised for:" and "Points to consider:" headings.\n\nReviews:\n---\n${reviewText}\n---`;
      } else {
          prompt = `Create a professional summary for a contractor named "${name}" based on their profile information.
          Description: ${description}
          Specialties: ${specialties.join(', ')}
          Category: ${category}
          Location: ${location}
          
          Provide a brief, engaging overview of their services and expertise for a potential client. Highlight why they might be a good choice based on their description.`;
      }
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
      });
      
      setReviewSummary(response.text);
    } catch (error) {
      console.error("Error generating review summary:", error);
      setSummaryError('Sorry, the AI summary could not be generated at this time.');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const isMapsUrl = sourceUrl && (sourceUrl.includes('maps.google') || sourceUrl.includes('google.com/maps'));

  return (
    <div className={`bg-white rounded-2xl transition-all duration-300 overflow-hidden group relative ${isTop ? 'ring-2 ring-indigo-500 shadow-xl' : 'border border-slate-200 shadow-md hover:shadow-xl hover:-translate-y-1'}`}>
      {isTop && (
          <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-bl-xl z-10 shadow-sm">
              Top Rated
          </div>
      )}
      
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="relative flex-shrink-0">
                <img src={avatarUrl} alt={name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-md border border-slate-100" />
                {verified && (
                    <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-sm border border-slate-100" title="Verified Contractor">
                        <CheckBadgeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-sky-500" />
                    </div>
                )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 
                    className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors cursor-pointer hover:underline decoration-indigo-300 decoration-2 underline-offset-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        onFilterByTerm && onFilterByTerm(name);
                    }}
                    title="Click to search for this contractor"
                >
                    <HighlightedText text={name} highlight={searchTerm} />
                </h3>
                {claimed ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm" title="Profile claimed by business owner">
                        <ShieldCheckIcon className="w-3 h-3 mr-1" />
                        Claimed
                    </span>
                ) : (
                    <button onClick={() => onClaimClick(contractor)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        Claim This Business
                    </button>
                )}
              </div>
              <p 
                className="text-sm font-medium text-slate-500 mt-1 cursor-pointer hover:text-indigo-500 hover:underline inline-block"
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterByCategory && onFilterByCategory(category);
                }}
              >
                <HighlightedText text={category} highlight={searchTerm} />
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-slate-600 space-y-1 sm:space-y-0">
                 {phone && (
                    <div className="flex items-center hover:text-slate-900 transition-colors cursor-pointer">
                        <PhoneIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {phone}
                    </div>
                 )}
                 {website && (
                    <div className="flex items-center hover:text-indigo-600 transition-colors truncate">
                        <GlobeAltIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <a href={`http://${website}`} target="_blank" rel="noreferrer" className="hover:underline truncate">Visit Website</a>
                    </div>
                 )}
                 {sourceUrl && (
                    <div className="flex items-center hover:text-indigo-600 transition-colors truncate">
                        {isMapsUrl ? (
                            <MapIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        ) : (
                            <GlobeAltIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        )}
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:underline truncate">
                            {isMapsUrl ? 'View on Maps' : 'Source'}
                        </a>
                    </div>
                 )}
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0 hidden xs:block">
            <div className="flex flex-col items-end">
                <div className="flex items-center space-x-1 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100 shadow-sm">
                    <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                    <span className="text-lg sm:text-xl font-bold text-slate-800">{averageRating}</span>
                </div>
                <span className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium">{reviews.length} verified reviews</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-50/50 p-3 sm:p-4 rounded-xl border border-indigo-100 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/30"></div>
                <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600">{monthlyScore}</p>
                <p className="text-[10px] sm:text-xs font-bold text-indigo-900/60 uppercase tracking-widest mt-1">Monthly Score</p>
            </div>
             <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 text-center">
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-700">{lifetimeScore}</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lifetime Score</p>
            </div>
        </div>
        
        <p className="mt-5 text-sm sm:text-base text-slate-600 leading-relaxed line-clamp-3 sm:line-clamp-none">{description}</p>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-6 pt-4 border-t border-slate-100 gap-4">
            <div className="space-y-3 w-full sm:w-auto">
                <div className="flex items-center text-sm font-medium text-slate-600">
                    <MapPinIcon className="w-5 h-5 mr-2 text-slate-400" />
                    <span>{location}</span>
                    {distance !== undefined && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {distance.toFixed(1)} mi
                        </span>
                    )}
                </div>
                <div className="flex items-start text-sm text-slate-600">
                    <BriefcaseIcon className="w-5 h-5 mr-2 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-2">
                        {specialties.map((s, i) => (
                             <span 
                                key={i} 
                                className="px-2.5 py-0.5 bg-slate-50 rounded-md border border-slate-200 text-xs font-medium cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFilterByTerm && onFilterByTerm(s);
                                }}
                                title={`Search for "${s}"`}
                             >
                                 <HighlightedText text={s} highlight={searchTerm} />
                             </span>
                        ))}
                    </div>
                </div>
            </div>

             <div className="w-full sm:w-auto flex justify-end">
                {claimed && (
                    <button onClick={() => onEditClick(contractor)} className="flex items-center text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors group">
                        <PencilIcon className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                        Edit Profile
                    </button>
                )}
             </div>
        </div>
      </div>
      
      {/* Action Bar */}
      <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-4">
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
              {isExpanded ? 'Hide' : 'Read'} Reviews
              <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform duration-300 ${isExpanded ? 'transform rotate-180' : ''}`} />
            </button>
            
            <button 
                onClick={generateReviewSummary} 
                disabled={isSummaryLoading}
                className="flex items-center text-sm font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
                <SparklesIcon className="w-4 h-4 mr-1"/>
                AI Summary
            </button>
        </div>
         {currentUser && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button 
                    onClick={() => onToggleSave(id)}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSaved ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                >
                   <BookmarkIcon className={`w-4 h-4 mr-2 ${isSaved ? 'text-indigo-600' : 'text-slate-400'}`} solid={isSaved} />
                   {isSaved ? 'Saved' : 'Save'}
                </button>
                <button onClick={() => onRequestQuote(contractor)} className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200">
                   <ClipboardDocumentListIcon className="w-4 h-4 mr-2 text-slate-400"/>
                   Request Quote
                </button>
                <button onClick={handleContact} className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:bg-indigo-700 hover:-translate-y-px">
                    Contact
                </button>
            </div>
        )}
      </div>

      {/* AI Summary Section */}
      {(isSummaryLoading || summaryError || reviewSummary) && (
        <div className="p-5 sm:p-6 bg-indigo-50/30 border-t border-indigo-100">
            <div className="flex items-center mb-3">
                <div className="bg-indigo-100 p-1.5 rounded-lg mr-2">
                    <DocumentTextIcon className="w-4 h-4 text-indigo-600"/>
                </div>
                <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
                    {reviews.length > 0 ? 'AI Review Analysis' : 'Profile Overview'}
                </h4>
            </div>

            {isSummaryLoading && (
                <div className="flex items-center space-x-2 text-indigo-600 animate-pulse ml-1">
                    <SparklesIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Analyzing review patterns...</span>
                </div>
            )}
            
            {summaryError && <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">{summaryError}</p>}
            
            {reviewSummary && (
                <div className="text-sm text-slate-700 prose prose-sm max-w-none leading-relaxed bg-white p-4 rounded-xl border border-indigo-50 shadow-sm" dangerouslySetInnerHTML={{ __html: reviewSummary.replace(/\n/g, '<br />') }}></div>
            )}
        </div>
      )}

      {/* Expanded Reviews Section */}
      {isExpanded && (
        <div className="p-5 sm:p-6 border-t border-slate-200 space-y-6 bg-slate-50/50">
          {currentUser && <ReviewForm contractorId={id} currentUser={currentUser} onAddReview={onAddReview} />}
          {reviews.length > 0 ? (
            reviews.map(review => {
              const user = getUserById(review.userId);
              return (
                <div key={review.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                        <img src={user?.avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full mr-3 border border-slate-100" />
                        <div>
                            <p className="font-bold text-sm text-slate-800">{user?.username}</p>
                            <div className="flex items-center">
                                {[...Array(5)].map((_, i) => <StarIcon key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-400' : 'text-slate-200'}`} />)}
                            </div>
                        </div>
                    </div>
                     <span className="text-xs font-medium text-slate-400">{review.date}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">"{review.comment}"</p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-slate-500 font-medium">No reviews yet.</p>
                <p className="text-sm text-slate-400 mt-1">Be the first to share your experience!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractorCard;
