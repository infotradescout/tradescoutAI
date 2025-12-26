
import React, { useState, useMemo } from 'react';
import { Contractor } from '../types';
import { XIcon, StarIcon, CheckBadgeIcon, SparklesIcon } from './Icons';
import { GoogleGenAI } from '@google/genai';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    contractors: Contractor[];
}

interface SummaryState {
    [contractorId: string]: {
        isLoading: boolean;
        summary: string;
        error: string;
    }
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, contractors }) => {
    const [summaries, setSummaries] = useState<SummaryState>({});

    const getAverageRating = (reviews: any[]): number => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((acc, review) => acc + review.rating, 0);
        return parseFloat((total / reviews.length).toFixed(1));
    };

    // Calculate "winners" for visual highlighting
    const stats = useMemo(() => {
        if (contractors.length === 0) return { maxScore: 0, maxRating: 0 };
        return {
            maxScore: Math.max(...contractors.map(c => c.lifetimeScore)),
            maxRating: Math.max(...contractors.map(c => getAverageRating(c.reviews)))
        };
    }, [contractors]);

    const generateSummary = async (contractor: Contractor) => {
        const { id, name, reviews } = contractor;
        if (reviews.length === 0) {
            setSummaries(prev => ({...prev, [id]: {isLoading: false, summary: "No reviews to summarize.", error: ''}}));
            return;
        }

        setSummaries(prev => ({...prev, [id]: {isLoading: true, summary: '', error: ''}}));
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const reviewText = reviews.map(r => `- Rating: ${r.rating}/5\n- Comment: ${r.comment}`).join('\n---\n');
            const prompt = `Summarize these customer reviews for ${name}, focusing on common praises and critiques. Use bullet points. \n\nReviews:\n---\n${reviewText}`;
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });

            setSummaries(prev => ({...prev, [id]: {isLoading: false, summary: response.text, error: ''}}));
        } catch (error) {
            console.error("Error generating review summary:", error);
            setSummaries(prev => ({...prev, [id]: {isLoading: false, summary: '', error: 'Could not generate summary.'}}));
        }
    };
    
    if (!isOpen) return null;

    // Dynamically calculate column width styles if needed, or rely on grid
    const gridColsClass = `grid-cols-${contractors.length + 1}`;

    return (
        <div className="fixed inset-0 bg-overlay/80 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden ring-1 ring-border/50" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex justify-between items-center flex-shrink-0 bg-muted/60">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Compare Pros</h2>
                        <p className="text-sm text-muted-foreground">Side-by-side breakdown</p>
                    </div>
                    <button onClick={onClose} className="bg-surface p-2 rounded-full shadow-sm text-muted-foreground hover:text-foreground transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-auto flex-grow bg-muted">
                    <div className={`grid ${gridColsClass} min-w-max bg-surface shadow-sm m-4 rounded-lg border border-border overflow-hidden`}>
                        {/* Headers Column */}
                        <div className="bg-muted border-r border-border">
                            <div className="h-40 border-b border-border"></div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border h-16 flex items-center">Category</div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border h-16 flex items-center">Avg. Rating</div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border h-16 flex items-center">Lifetime Score</div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border h-16 flex items-center">Verified</div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border min-h-[8rem] flex items-start pt-4">Specialties</div>
                            <div className="p-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide min-h-[12rem] flex items-start pt-4">AI Summary</div>
                        </div>

                        {/* Contractor Columns */}
                        {contractors.map(c => {
                            const avgRating = getAverageRating(c.reviews);
                            const isMaxRating = avgRating === stats.maxRating && avgRating > 0;
                            const isMaxScore = c.lifetimeScore === stats.maxScore && c.lifetimeScore > 0;

                            return (
                                <div key={c.id} className="border-r border-border last:border-r-0">
                                    <div className="h-40 border-b border-border p-4 bg-surface flex flex-col items-center justify-center text-center">
                                        <img src={c.avatarUrl} alt={c.name} className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-md" />
                                        <h3 className="font-bold text-foreground leading-tight px-2">{c.name}</h3>
                                    </div>
                                    <div className="p-4 border-b border-border text-foreground h-16 flex items-center justify-center font-medium">{c.category}</div>
                                    <div className={`p-4 border-b border-border h-16 flex items-center justify-center ${isMaxRating ? 'bg-success/10' : ''}`}>
                                        <div className="flex items-center">
                                            <StarIcon className={`w-5 h-5 mr-1.5 ${isMaxRating ? 'text-success' : 'text-warning'}"`} />
                                            <span className={`font-bold text-lg ${isMaxRating ? 'text-success-foreground' : 'text-muted-foreground'}`}>{avgRating}</span>
                                            <span className="text-xs text-muted-foreground ml-1">({c.reviews.length})</span>
                                        </div>
                                    </div>
                                    <div className={`p-4 border-b border-border h-16 flex items-center justify-center ${isMaxScore ? 'bg-success/10' : ''}`}>
                                        <span className={`font-bold text-lg ${isMaxScore ? 'text-success-foreground' : 'text-muted-foreground'}`}>{c.lifetimeScore}</span>
                                    </div>
                                    <div className="p-4 border-b border-border h-16 flex items-center justify-center">
                                        {c.verified ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info-foreground">
                                                <CheckBadgeIcon className="w-4 h-4 mr-1" /> Verified
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-sm">-</span>
                                        )}
                                    </div>
                                    <div className="p-4 border-b border-slate-100 min-h-[8rem] text-sm flex flex-wrap content-start gap-1 justify-center">
                                        {c.specialties.map((s, i) => (
                                            <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs text-center">{s}</span>
                                        ))}
                                    </div>
                                    <div className="p-4 min-h-[12rem] text-sm flex flex-col items-center">
                                        {summaries[c.id]?.isLoading && (
                                            <div className="flex items-center text-indigo-600 animate-pulse">
                                                <SparklesIcon className="w-4 h-4 mr-1" /> Analyzing...
                                            </div>
                                        )}
                                        {summaries[c.id]?.error && <p className="text-red-500 text-xs">{summaries[c.id]?.error}</p>}
                                        {summaries[c.id]?.summary && (
                                            <div className="prose prose-xs w-full text-left text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: summaries[c.id].summary.replace(/\n/g, '<br />') }}></div>
                                        )}
                                        {!summaries[c.id] && c.reviews.length > 0 && (
                                            <button onClick={() => generateSummary(c)} className="mt-2 w-full py-2 px-3 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center shadow-sm">
                                                <SparklesIcon className="w-4 h-4 mr-1" />
                                                AI Summary
                                            </button>
                                        )}
                                         {!summaries[c.id] && c.reviews.length === 0 && (
                                            <p className="text-slate-400 italic text-xs text-center mt-4">No reviews available</p>
                                         )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonModal;
