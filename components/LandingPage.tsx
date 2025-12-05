import React, { useState, useEffect } from 'react';
import { HomeIcon, SparklesIcon, GlobeAltIcon, UserCircleIcon } from './Icons';
import * as db from '../services/db';

interface LandingPageProps {
    onQuerySubmit: (query: string) => void;
    isLoading: boolean;
    suggestedPrompts?: string[]; // Optional prop if passed from parent
}

const LandingPage: React.FC<LandingPageProps> = ({ onQuerySubmit, isLoading }) => {
    const [query, setQuery] = useState('');
    const [prompts, setPrompts] = useState<string[]>([]);

    useEffect(() => {
        setPrompts(db.getSuggestedPrompts());
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) onQuerySubmit(query);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 relative overflow-hidden bg-slate-900">
            {/* Animated Background Accents - Dark Mode */}
            <div className="absolute top-20 left-10 md:left-20 w-48 h-48 md:w-72 md:h-72 bg-orange-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-blob"></div>
            <div className="absolute top-20 right-10 md:right-20 w-48 h-48 md:w-72 md:h-72 bg-cyan-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-48 h-48 md:w-72 md:h-72 bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-blob animation-delay-4000"></div>

            <div className="max-w-4xl w-full text-center space-y-6 md:space-y-8 relative z-10 animate-fade-in-up">
                <div className="flex justify-center mb-6 md:mb-8">
                    <div className="bg-gradient-to-br from-orange-600 to-red-600 p-5 md:p-6 rounded-3xl shadow-2xl shadow-orange-900/50 transform hover:scale-105 transition-all duration-500 cursor-default border-4 border-slate-800">
                        <HomeIcon className="w-12 h-12 md:w-20 md:h-20 text-white" />
                    </div>
                </div>
                
                <div className="space-y-3 md:space-y-5">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                        <UserCircleIcon className="w-3 h-3 mr-1.5 text-orange-500" />
                        Community Operating System
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight uppercase">
                        Empower Your <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Local Community</span>
                    </h1>
                    <p className="text-lg sm:text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed px-2">
                        Interact with neighbors, find verified local talent, and access real-time area intelligence.
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto relative group mt-6 md:mt-10">
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask a question, find a pro, check local codes, or get advice..."
                            rows={3}
                            className="w-full p-4 md:p-6 text-base md:text-xl bg-transparent border-0 rounded-2xl focus:outline-none focus:ring-0 text-white resize-none placeholder-slate-500 font-medium"
                        />
                        <div className="px-4 pb-4 md:px-6 md:pb-6 flex justify-between items-center border-t border-slate-700 pt-3">
                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center">
                                <SparklesIcon className="w-4 h-4 mr-1" />
                                Scout Active
                            </span>
                            <button 
                                type="submit"
                                disabled={!query.trim() || isLoading}
                                className="px-6 py-2.5 md:px-8 md:py-3 bg-orange-600 text-white text-sm md:text-lg font-bold rounded-xl shadow-lg shadow-orange-900/40 hover:bg-orange-700 hover:shadow-orange-900/60 hover:-translate-y-0.5 transform transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center uppercase tracking-wide"
                            >
                                {isLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    <>
                                        Start Search
                                        <span className="ml-2">→</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Suggested Prompts */}
                <div className="mt-6 flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl mx-auto">
                    <span className="w-full text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Explore Community Tools:</span>
                    {prompts.map((prompt, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(prompt)}
                            className="px-4 py-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-full text-sm font-medium text-slate-300 hover:text-orange-400 hover:border-orange-500/50 hover:bg-slate-800 transition-all shadow-sm hover:shadow"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
                
                <div className="pt-8 md:pt-10 flex justify-center">
                    <a href="#" className="flex items-center text-sm font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wide">
                        <GlobeAltIcon className="w-4 h-4 mr-2" />
                        Enterprise Access: TradeScout.com
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;