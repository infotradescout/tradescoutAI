
import React, { useState, useMemo } from 'react';
import { Contractor, User, Review } from '../types';
import { StarIcon, MapPinIcon, BriefcaseIcon, CheckBadgeIcon, SparklesIcon, DocumentTextIcon, ClipboardDocumentListIcon, BookmarkIcon, PencilIcon, GlobeAltIcon, PhoneIcon, ChevronDownIcon, ShieldCheckIcon, MapIcon, AwardIcon } from './Icons';
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
                    <span key={i} className="bg-orange-500/30 text-orange-200 rounded-sm px-0.5 font-bold border-b border-orange-500">{part}</span>
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
  const { id, name, avatarUrl, category, location, monthlyScore, lifetimeScore, description, specialties, reviews, verified, claimed, phone, website, distance, sourceUrl, isPromoted } = contractor;
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewSummary, setReviewSummary] = useState('');
  const [thoughtProcess, setThoughtProcess] = useState('');
  const [showThoughtProcess, setShowThoughtProcess] = useState(false);
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
    setThoughtProcess('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      let prompt = '';
      if (reviews.length > 0) {
          const reviewText = reviews.map(r => `- Rating: ${r.rating}/5\n- Comment: ${r.comment}`).join('\n---\n');
          prompt = `Summarize the following customer reviews for a contractor named ${name}. 
          
          INSTRUCTIONS:
          1. First, analyze the sentiment, recurring themes (positive and negative), and overall reliability in a detailed internal monologue.
          2. Enclose this internal reasoning in <thought> tags.
          3. Then, provide a brief, neutral summary focusing on common praises and critiques. Use markdown bullet points for clarity under "Praised for:" and "Points to consider:" headings.

          Reviews:
          ---
          ${reviewText}
          ---`;
      } else {
          prompt = `Create a professional summary for a contractor named "${name}" based on their profile information.
          
          INSTRUCTIONS:
          1. Analyze the specialties, location, and description to determine their market positioning. Enclose this reasoning in <thought> tags.
          2. Provide a brief, engaging overview of their services and expertise for a potential client.

          Profile Data:
          Description: ${description}
          Specialties: ${specialties.join(', ')}
          Category: ${category}
          Location: ${location}`;
      }
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
      });
      
      const rawText = response.text;
      
      // Parse thought process
      const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
      const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
      const content = rawText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();

      setThoughtProcess(thought);
      setReviewSummary(content);

    } catch (error) {
      console.error("Error generating review summary:", error);
      setSummaryError('Sorry, the summary could not be generated at this time.');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const isMapsUrl = sourceUrl && (sourceUrl.includes('maps.google') || sourceUrl.includes('google.com/maps'));

  // Promoted Styling logic
  const cardBorderClass = isPromoted 
    ? 'ring-1 ring-orange-500 shadow-lg shadow-orange-900/40 bg-slate-800' 
    : isTop 
        ? 'ring-1 ring-cyan-500 shadow-lg shadow-cyan-900/40 bg-slate-800' 
        : 'border border-slate-700 bg-slate-800 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-slate-600';

  return (
    <div className={`rounded-2xl transition-all duration-300 overflow-hidden group relative ${cardBorderClass}`}>
      {isPromoted && (
          <div className="absolute top-0 right-0 bg-orange-600/90 text-white border-l border-b border-orange-700 text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-bl-xl z-10 shadow-sm flex items-center backdrop-blur-sm">
              <AwardIcon className="w-3 h-3 mr-1" />
              Partner
          </div>
      )}
      {!isPromoted && isTop && (
          <div className="absolute top-0 right-0 bg-cyan-600/90 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-bl-xl z-10 shadow-sm backdrop-blur-sm">
              Top Rated
          </div>
      )}
      
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="relative flex-shrink-0">
                <img src={avatarUrl} alt={name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-lg border border-slate-700" />
                {verified && (
                    <div className="absolute -bottom-2 -right-2 bg-slate-900 p-1 rounded-full shadow-sm border border-cyan-900" title="Verified Contractor">
                        <CheckBadgeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                    </div>
                )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 
                    className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-orange-400 transition-colors cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onFilterByTerm && onFilterByTerm(name);
                    }}
                    title="Click to search for this contractor"
                >
                    <HighlightedText text={name} highlight={searchTerm} />
                </h3>
                {claimed ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-900/30 text-cyan-400 border border-cyan-800 shadow-sm" title="Profile claimed by business owner">
                        <ShieldCheckIcon className="w-3 h-3 mr-1" />
                        Verified
                    </span>
                ) : (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onClaimClick(contractor);
                        }}
                        className="flex items-center text-[10px] font-semibold text-slate-500 hover:text-orange-400 transition-colors bg-slate-900/50 hover:bg-slate-900 px-2 py-1 rounded border border-slate-700 hover:border-orange-500/50 shadow-sm"
                        title="Business Owner? Verify ownership to manage this profile."
                    >
                        <ShieldCheckIcon className="w-3 h-3 mr-1 opacity-50" />
                        Own this?
                    </button>
                )}
              </div>
              <p 
                className="text-sm font-medium text-slate-400 mt-1 cursor-pointer hover:text-orange-400 inline-block"
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterByCategory && onFilterByCategory(category);
                }}
              >
                <HighlightedText text={category} highlight={searchTerm} />
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-slate-400 space-y-1 sm:space-y-0">
                 {phone && (
                    <div className="flex items-center hover:text-white transition-colors cursor-pointer">
                        <PhoneIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                         <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline decoration-slate-500">{phone}</a>
                    </div>
                 )}
                 {website && (
                    <div className="flex items-center hover:text-orange-400 transition-colors truncate">
                        <GlobeAltIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        <a href={`http://${website}`} target="_blank" rel="noreferrer" className="hover:underline decoration-orange-500/50 truncate">Visit Website</a>
                    </div>
                 )}
                 {sourceUrl && (
                    <div className="flex items-center hover:text-orange-400 transition-colors truncate">
                        {isMapsUrl ? (
                            <MapIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        ) : (
                            <GlobeAltIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        )}
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:underline decoration-orange-500/50 truncate">
                            {isMapsUrl ? 'View on Maps' : 'Source'}
                        </a>
                    </div>
                 )}
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0 hidden xs:block">
            <div className="flex flex-col items-end">
                <div className="flex items-center space-x-1 bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-700 shadow-sm">
                    <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                    <span className="text-lg sm:text-xl font-bold text-white">{averageRating}</span>
                </div>
                <span className="text-lg text-slate-500 mt-1 font-medium">{reviews.length} reviews</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-700 text-center relative overflow-hidden group-hover:border-slate-600 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-600/30"></div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white">{monthlyScore}</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly Score</p>
            </div>
             <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-700 text-center group-hover:border-slate-600 transition-colors">
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-300">{lifetimeScore}</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Lifetime Score</p>
            </div>
        </div>
        
        <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed line-clamp-3 sm:line-clamp-none">{description}</p>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-6 pt-4 border-t border-slate-700 gap-4">
            <div className="space-y-3 w-full sm:w-auto">
                <div className="flex items-center text-sm font-medium text-slate-400">
                    <MapPinIcon className="w-5 h-5 mr-2 text-slate-600" />
                    <span>{location}</span>
                    {distance !== undefined && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                            {distance.toFixed(1)} mi
                        </span>
                    )}
                </div>
                <div className="flex items-start text-sm text-slate-400">
                    <BriefcaseIcon className="w-5 h-5 mr-2 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-2">
                        {specialties.map((s, i) => (
                             <span 
                                key={i} 
                                className="px-2.5 py-0.5 bg-slate-900 rounded-md border border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-800 hover:text-orange-400 hover:border-orange-500/50 transition-colors"
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
        </div>
      </div>
      
      {/* Action Bar */}
      <div className="px-5 sm:px-6 py-4 bg-slate-900/30 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-4">
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
              {isExpanded ? 'Hide' : 'Read'} Reviews
              <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform duration-300 ${isExpanded ? 'transform rotate-180' : ''}`} />
            </button>
            
            <button 
                onClick={generateReviewSummary} 
                disabled={isSummaryLoading}
                className="flex items-center text-sm font-bold text-orange-400 hover:text-orange-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
            >
                <SparklesIcon className="w-4 h-4 mr-1"/>
                Scout Summary
            </button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
             {/* Edit Button for Claimed Profiles (Owners) */}
             {claimed && (
                 <button 
                    onClick={() => onEditClick(contractor)} 
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 bg-slate-800 text-cyan-400 border border-slate-600 hover:bg-slate-700 hover:border-cyan-500/50 shadow-sm"
                 >
                     <PencilIcon className="w-4 h-4 mr-2" />
                     Edit Profile
                 </button>
             )}

             {currentUser && (
                <>
                <button 
                    onClick={() => onToggleSave(id)}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${isSaved ? 'bg-orange-900/20 text-orange-500 border border-orange-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'}`}
                >
                   <BookmarkIcon className={`w-4 h-4 mr-2 ${isSaved ? 'text-orange-500' : 'text-slate-500'}`} solid={isSaved} />
                   {isSaved ? 'Saved' : 'Save'}
                </button>
                <button onClick={() => onRequestQuote(contractor)} className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600">
                   <ClipboardDocumentListIcon className="w-4 h-4 mr-2 text-slate-400"/>
                   Request Quote
                </button>
                <button onClick={handleContact} className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 bg-orange-600 text-white shadow-md shadow-orange-900/40 hover:shadow-lg hover:bg-orange-700 hover:-translate-y-px uppercase tracking-wide">
                    Contact
                </button>
                </>
            )}
        </div>
      </div>

      {/* AI Summary Section */}
      {(isSummaryLoading || summaryError || reviewSummary) && (
        <div className="p-5 sm:p-6 bg-slate-900 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    <div className="bg-orange-900/20 p-1.5 rounded-lg mr-2 border border-orange-900/50">
                        <DocumentTextIcon className="w-4 h-4 text-orange-500"/>
                    </div>
                    <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wide">
                        {reviews.length > 0 ? 'Review Highlights' : 'Profile Overview'}
                    </h4>
                </div>
                {thoughtProcess && !isSummaryLoading && (
                    <button 
                        onClick={() => setShowThoughtProcess(!showThoughtProcess)}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center bg-slate-800 px-2 py-1 rounded border border-slate-700 shadow-sm"
                    >
                        {showThoughtProcess ? 'Hide' : 'View'} Analysis Logic
                        <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${showThoughtProcess ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {isSummaryLoading && (
                <div className="flex items-center space-x-2 text-orange-400 animate-pulse ml-1">
                    <SparklesIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Analyzing patterns...</span>
                </div>
            )}
            
            {summaryError && <p className="text-sm text-red-400 font-medium bg-red-900/20 p-2 rounded border border-red-900/50">{summaryError}</p>}
            
            {reviewSummary && (
                <div className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none leading-relaxed bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-inner" dangerouslySetInnerHTML={{ __html: reviewSummary.replace(/\n/g, '<br />') }}></div>
            )}

            {showThoughtProcess && thoughtProcess && (
                 <div className="mt-4 border-t border-slate-700 pt-3 animate-fade-in-up">
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center">
                        <SparklesIcon className="w-3 h-3 mr-1" />
                        Analysis Logic
                    </p>
                    <div className="bg-black p-3 rounded-lg border border-slate-700 shadow-inner">
                        <p className="text-xs font-mono text-green-400 leading-relaxed whitespace-pre-wrap">
                            {thoughtProcess}
                        </p>
                    </div>
                 </div>
            )}
        </div>
      )}

      {/* Expanded Reviews Section */}
      {isExpanded && (
        <div className="p-5 sm:p-6 border-t border-slate-700 space-y-6 bg-slate-900/50">
          {currentUser && <ReviewForm contractorId={id} currentUser={currentUser} onAddReview={onAddReview} />}
          {reviews.length > 0 ? (
            reviews.map(review => {
              const user = getUserById(review.userId);
              return (
                <div key={review.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                        <img src={user?.avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full mr-3 border border-slate-600" />
                        <div>
                            <p className="font-bold text-sm text-slate-200">{user?.username}</p>
                            <div className="flex items-center">
                                {[...Array(5)].map((_, i) => <StarIcon key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-400' : 'text-slate-600'}`} />)}
                            </div>
                        </div>
                    </div>
                     <span className="text-xs font-medium text-slate-500">{review.date}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">"{review.comment}"</p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-400 font-medium">No reviews yet.</p>
                <p className="text-sm text-slate-500 mt-1">Be the first to share your experience!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractorCard;
