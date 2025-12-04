
import React, { useState, useEffect } from 'react';
import { HomeIcon, SparklesIcon } from './Icons';
import * as db from '../services/db';

interface LandingPageProps {
    onQuerySubmit: (query: string) => void;
    isLoading: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onQuerySubmit, isLoading }) => {
    const [query, setQuery] = useState('');
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

    useEffect(() => {
        setSuggestedPrompts(db.getSuggestedPrompts());
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) onQuerySubmit(query);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 relative overflow-hidden">
            {/* Animated Background Accents */}
            <div className="absolute top-20 left-10 md:left-20 w-48 h-48 md:w-72 md:h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-20 right-10 md:right-20 w-48 h-48 md:w-72 md:h-72 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-48 h-48 md:w-72 md:h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="max-w-4xl w-full text-center space-y-6 md:space-y-8 relative z-10 animate-fade-in-up">
                <div className="flex justify-center mb-6 md:mb-8">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 md:p-6 rounded-3xl shadow-2xl shadow-indigo-200 transform hover:scale-105 transition-all duration-500 cursor-default border-4 border-white">
                        <HomeIcon className="w-12 h-12 md:w-20 md:h-20 text-white" />
                    </div>
                </div>
                
                <div className="space-y-3 md:space-y-5">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Next Project</span>
                    </h1>
                    <p className="text-lg sm:text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed px-2">
                        Describe your vision. We'll estimate the cost, plan the steps, and find the perfect pros.
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto relative group mt-6 md:mt-10">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-white rounded-2xl shadow-xl">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask: 'What can TradeScout do for me?' or describe a project like 'Remodel my kitchen'"
                            rows={3}
                            className="w-full p-4 md:p-6 text-base md:text-xl bg-transparent border-0 rounded-2xl focus:outline-none focus:ring-0 text-slate-800 resize-none placeholder-slate-400"
                        />
                        <div className="px-4 pb-4 md:px-6 md:pb-6 flex justify-between items-center border-t border-slate-100 pt-3">
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide flex items-center">
                                <SparklesIcon className="w-4 h-4 mr-1" />
                                AI-Powered Assistant
                            </span>
                            <button 
                                type="submit"
                                disabled={!query.trim() || isLoading}
                                className="px-6 py-2.5 md:px-8 md:py-3 bg-indigo-600 text-white text-sm md:text-lg font-bold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transform transition-all disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center"
                            >
                                {isLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Analyzing...</span>
                                    </div>
                                ) : (
                                    <>
                                        Scout Pros
                                        <span className="ml-2">→</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Suggested Prompts */}
                <div className="mt-6 flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl mx-auto">
                    <span className="w-full text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Try asking:</span>
                    {suggestedPrompts.map((prompt, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(prompt)}
                            className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-full text-sm font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm hover:shadow"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
                
                <div className="pt-8 md:pt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 text-center px-4">
                    {[
                        { num: '01', title: 'Describe', desc: 'Tell us about your repair or renovation.' },
                        { num: '02', title: 'Analyze', desc: 'Get instant cost estimates & material lists.' },
                        { num: '03', title: 'Connect', desc: 'Match with verified, top-rated local pros.' }
                    ].map((item, idx) => (
                        <div key={idx} className="p-5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all">
                            <div className="text-indigo-600 font-black text-3xl mb-2 opacity-20">{item.num}</div>
                            <div className="font-bold text-slate-800 text-lg mb-1">{item.title}</div>
                            <div className="text-slate-600 text-sm leading-relaxed">{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
