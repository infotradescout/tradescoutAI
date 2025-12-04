
import React, { useState } from 'react';
import { SparklesIcon, CalculatorIcon, ClipboardDocumentListIcon, LightBulbIcon, WrenchIcon, PlusCircleIcon, GlobeAltIcon, ChevronDownIcon, TruckIcon, InformationCircleIcon, ScaleIcon } from './Icons';
import { ProjectAnalysis } from '../types';

interface ProjectAssistantProps {
    onQuerySubmit: (query: string) => void;
    isLoading: boolean;
    analysisResult: ProjectAnalysis | null;
    onReset: () => void;
}

const ProjectAssistant: React.FC<ProjectAssistantProps> = ({ onQuerySubmit, isLoading, analysisResult, onReset }) => {
    const [query, setQuery] = useState('');
    const [showReasoning, setShowReasoning] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim() && !isLoading) {
            onQuerySubmit(query);
            setQuery('');
        }
    };

    const getIntentConfig = (intent?: string) => {
        switch (intent) {
            case 'VEHICLE':
                return {
                    title: 'Fleet & Gear Advisor',
                    icon: <TruckIcon className="w-6 h-6 text-orange-400"/>,
                    costLabel: 'Market Price',
                    processLabel: 'Selection Criteria'
                };
            case 'CODES':
                return {
                    title: 'Regulatory Briefing',
                    icon: <ScaleIcon className="w-6 h-6 text-orange-400"/>,
                    costLabel: 'Permit Fees',
                    processLabel: 'Approval Process'
                };
            case 'GENERAL':
                return {
                    title: 'System Overview',
                    icon: <InformationCircleIcon className="w-6 h-6 text-orange-400"/>,
                    costLabel: 'Service Model',
                    processLabel: 'How it Works'
                };
            default:
                return {
                    title: 'Scout Report',
                    icon: <SparklesIcon className="w-6 h-6 text-orange-400"/>,
                    costLabel: 'Estimated Cost',
                    processLabel: 'Execution Plan'
                };
        }
    };

    if (analysisResult) {
        const config = getIntentConfig(analysisResult.intent);

        return (
            <div className="bg-gradient-to-br from-orange-600 to-red-600 p-[2px] rounded-2xl shadow-2xl">
                <div className="bg-slate-900 rounded-[14px] p-5 sm:p-6 h-full flex flex-col relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                        <SparklesIcon className="w-64 h-64 text-orange-500" />
                    </div>
                    
                    <div className="flex items-center mb-6 relative z-10">
                        <div className="bg-slate-800 p-2.5 rounded-xl mr-4 shadow-sm border border-slate-700">
                             {config.icon}
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-white">{config.title}</h3>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Smart Project Analysis</p>
                        </div>
                    </div>

                    <div className="space-y-6 relative z-10">
                        {/* Thinking/Reasoning Log */}
                        {analysisResult.thoughtProcess && (
                            <div className="border border-slate-700 rounded-xl overflow-hidden">
                                <button 
                                    onClick={() => setShowReasoning(!showReasoning)}
                                    className="w-full bg-black p-3 flex justify-between items-center text-left transition-colors hover:bg-slate-950"
                                >
                                    <span className="text-xs font-mono font-bold text-green-400 flex items-center">
                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                                        ANALYSIS LOGIC
                                    </span>
                                    <span className="text-slate-500 text-xs flex items-center">
                                        {showReasoning ? 'Hide' : 'View Trace'}
                                        <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
                                    </span>
                                </button>
                                {showReasoning && (
                                    <div className="bg-black p-4 text-xs font-mono text-green-400/80 leading-relaxed overflow-x-auto whitespace-pre-wrap border-t border-slate-800 shadow-inner max-h-48 overflow-y-auto">
                                        {analysisResult.thoughtProcess}
                                    </div>
                                )}
                            </div>
                        )}


                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-sm">
                            <div className="flex items-center mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2"></div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Summary</p>
                            </div>
                            <p className="text-sm font-medium text-slate-200 leading-relaxed">{analysisResult.jobSummary}</p>
                        </div>

                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-16 h-16 bg-orange-900/20 rounded-bl-full opacity-50 transition-opacity group-hover:opacity-70"></div>
                            <div className="relative">
                                <div className="flex items-center mb-3">
                                    <CalculatorIcon className="w-5 h-5 text-orange-500 mr-2" />
                                    <h4 className="font-bold text-slate-300 text-sm uppercase tracking-wide">{config.costLabel}</h4>
                                </div>
                                <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 mb-4">
                                    {analysisResult.estimatedCost}
                                </p>
                                <div className="flex items-start bg-slate-900 p-3 rounded-lg border border-slate-700 shadow-sm text-xs font-medium text-slate-400 leading-relaxed">
                                    <LightBulbIcon className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-amber-500" />
                                    <p>{analysisResult.costFactors}</p>
                                </div>
                            </div>
                        </div>

                        {analysisResult.processSteps && analysisResult.processSteps.length > 0 && (
                            <div>
                                <div className="flex items-center mb-4">
                                    <WrenchIcon className="w-4 h-4 text-slate-500 mr-2" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{config.processLabel}</p>
                                </div>
                                <div className="relative pl-2 space-y-0">
                                    {/* Timeline Line */}
                                    <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-700"></div>
                                    
                                    {analysisResult.processSteps.map((step, idx) => (
                                        <div key={idx} className="relative pl-8 pb-5 last:pb-0 group">
                                            <div className="absolute left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-slate-600 group-hover:border-orange-500 group-hover:scale-110 transition-all z-10"></div>
                                            <p className="text-sm text-slate-300 leading-snug group-hover:text-white transition-colors">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {analysisResult.estimatedMaterials.length > 0 && (
                            <div>
                                <div className="flex items-center mb-3 pt-2 border-t border-slate-800">
                                    <ClipboardDocumentListIcon className="w-4 h-4 text-slate-500 mr-2" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {analysisResult.intent === 'VEHICLE' ? 'Recommended Models' : analysisResult.intent === 'GENERAL' ? 'Key Features' : 'Likely Materials'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysisResult.estimatedMaterials.map((item, idx) => (
                                        <a 
                                            key={idx}
                                            href={analysisResult.intent === 'GENERAL' ? '#' : `https://www.amazon.com/s?k=${encodeURIComponent(item)}&tag=tradescout-20`}
                                            target={analysisResult.intent === 'GENERAL' ? '_self' : "_blank"}
                                            rel="noopener noreferrer"
                                            onClick={e => analysisResult.intent === 'GENERAL' && e.preventDefault()}
                                            className="px-3 py-1 bg-slate-800 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 shadow-sm hover:shadow hover:border-orange-500/50 hover:text-orange-400 transition-all cursor-pointer flex items-center group"
                                            title={analysisResult.intent === 'GENERAL' ? item : `Shop for ${item}`}
                                        >
                                            {item}
                                            {analysisResult.intent !== 'GENERAL' && <GlobeAltIcon className="w-3 h-3 ml-1.5 opacity-40 group-hover:opacity-100" />}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Marketplace / Affiliate Offers */}
                        {analysisResult.affiliateOffers && analysisResult.affiliateOffers.length > 0 && (
                            <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30">
                                <div className="flex items-center mb-3">
                                    <SparklesIcon className="w-4 h-4 text-emerald-500 mr-2" />
                                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Marketplace & Offers</p>
                                </div>
                                <div className="space-y-2">
                                    {analysisResult.affiliateOffers.map((offer, idx) => (
                                        <a 
                                            key={idx}
                                            href="#" // Placeholder for actual affiliate link logic
                                            className="block p-3 bg-slate-800 rounded-lg border border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group"
                                            onClick={(e) => { e.preventDefault(); alert(`Redirecting to partner: ${offer.title}`); }}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-slate-300 group-hover:text-emerald-400">{offer.title}</span>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full uppercase">{offer.type}</span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Internal Related Services */}
                        {analysisResult.relatedServices && analysisResult.relatedServices.length > 0 && (
                            <div className="bg-amber-900/10 p-4 rounded-xl border border-amber-900/30">
                                <div className="flex items-center mb-3">
                                    <PlusCircleIcon className="w-4 h-4 text-amber-500 mr-2" />
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">You Might Also Need</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysisResult.relatedServices.map((service, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onQuerySubmit(service)}
                                            className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full text-xs font-semibold border border-amber-900/50 shadow-sm hover:border-amber-500/50 hover:text-amber-400 transition-all cursor-pointer flex items-center group"
                                        >
                                            {service}
                                            <span className="ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">→</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={onReset}
                            className="w-full mt-2 py-3 rounded-xl text-sm text-orange-400 font-bold bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                        >
                            New Analysis
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 h-full flex flex-col">
            <div className="flex items-center mb-6">
                <div className="bg-slate-700 p-2.5 rounded-xl mr-4 shadow-sm border border-slate-600">
                    <SparklesIcon className="w-6 h-6 text-orange-500"/>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Project Planner</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Tactical Cost & Plan Estimation</p>
                </div>
            </div>
            
            <div className="flex-grow">
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                    Identify your objective (scope, issue, location), and we'll generate a <strong>tactical scout report</strong> with cost estimates, materials lists, and verified local assets.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., 'Install recessed lighting in 15x20 living room, Austin TX. Request budget estimation.'"
                            rows={6}
                            className="w-full p-4 text-sm border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-slate-900 text-white shadow-inner resize-none transition-all placeholder-slate-500"
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-orange-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-orange-700 hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200 flex items-center justify-center disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 uppercase tracking-wide"
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
