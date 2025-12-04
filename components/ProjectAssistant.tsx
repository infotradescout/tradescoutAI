
import React, { useState } from 'react';
import { SparklesIcon, CalculatorIcon, ClipboardDocumentListIcon, LightBulbIcon, WrenchIcon } from './Icons';
import { ProjectAnalysis } from '../types';

interface ProjectAssistantProps {
    onQuerySubmit: (query: string) => void;
    isLoading: boolean;
    analysisResult: ProjectAnalysis | null;
    onReset: () => void;
}

const ProjectAssistant: React.FC<ProjectAssistantProps> = ({ onQuerySubmit, isLoading, analysisResult, onReset }) => {
    const [query, setQuery] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim() && !isLoading) {
            onQuerySubmit(query);
            setQuery('');
        }
    };

    if (analysisResult) {
        return (
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-[2px] rounded-2xl shadow-2xl">
                <div className="bg-white rounded-[14px] p-5 sm:p-6 h-full flex flex-col relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                        <SparklesIcon className="w-64 h-64 text-indigo-900" />
                    </div>
                    
                    <div className="flex items-center mb-6 relative z-10">
                        <div className="bg-indigo-100 p-2.5 rounded-xl mr-4 shadow-sm">
                             <SparklesIcon className="w-6 h-6 text-indigo-600"/>
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-900">Project Dossier</h3>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">AI-Generated Analysis</p>
                        </div>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 shadow-sm">
                            <div className="flex items-center mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Task Summary</p>
                            </div>
                            <p className="text-sm font-medium text-slate-800 leading-relaxed">{analysisResult.jobSummary}</p>
                        </div>

                        <div className="bg-gradient-to-r from-indigo-50 to-white p-5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-bl-full opacity-50 transition-opacity group-hover:opacity-70"></div>
                            <div className="relative">
                                <div className="flex items-center mb-3">
                                    <CalculatorIcon className="w-5 h-5 text-indigo-600 mr-2" />
                                    <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide">Estimated Cost</h4>
                                </div>
                                <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-violet-700 mb-4">
                                    {analysisResult.estimatedCost}
                                </p>
                                <div className="flex items-start bg-white p-3 rounded-lg border border-indigo-50 shadow-sm text-xs font-medium text-slate-600 leading-relaxed">
                                    <LightBulbIcon className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-amber-500" />
                                    <p>{analysisResult.costFactors}</p>
                                </div>
                            </div>
                        </div>

                        {analysisResult.processSteps && analysisResult.processSteps.length > 0 && (
                            <div>
                                <div className="flex items-center mb-4">
                                    <WrenchIcon className="w-4 h-4 text-slate-400 mr-2" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Execution Plan</p>
                                </div>
                                <div className="relative pl-2 space-y-0">
                                    {/* Timeline Line */}
                                    <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-200"></div>
                                    
                                    {analysisResult.processSteps.map((step, idx) => (
                                        <div key={idx} className="relative pl-8 pb-5 last:pb-0 group">
                                            <div className="absolute left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300 group-hover:border-indigo-500 group-hover:scale-110 transition-all z-10"></div>
                                            <p className="text-sm text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {analysisResult.estimatedMaterials.length > 0 && (
                            <div>
                                <div className="flex items-center mb-3 pt-2 border-t border-slate-100">
                                    <ClipboardDocumentListIcon className="w-4 h-4 text-slate-400 mr-2" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Likely Materials</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysisResult.estimatedMaterials.map((item, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-white text-slate-600 rounded-md text-xs font-semibold border border-slate-200 shadow-sm">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={onReset}
                            className="w-full mt-2 py-3 rounded-xl text-sm text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-100"
                        >
                            Start New Project Analysis
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full flex flex-col">
            <div className="flex items-center mb-6">
                <div className="bg-indigo-100 p-2.5 rounded-xl mr-4 shadow-sm">
                    <SparklesIcon className="w-6 h-6 text-indigo-600"/>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Project Assistant</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">AI-Powered Cost & Plan Estimation</p>
                </div>
            </div>
            
            <div className="flex-grow">
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    Don't know where to start? Describe your project (size, issue, location), and our AI will generate a <strong>custom project dossier</strong> with cost estimates, materials lists, and match you with the best local pros.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., 'I want to install recessed lighting in my 15x20 living room in Austin, TX. How much should I budget?'"
                            rows={6}
                            className="w-full p-4 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-800 shadow-inner resize-none transition-all"
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200 flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                        disabled={isLoading || !query.trim()}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Scouting...
                            </>
                        ) : 'Analyze Project & Find Pros'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProjectAssistant;
