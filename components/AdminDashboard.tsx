
import React, { useState, useEffect, useRef } from 'react';
import * as db from '../services/db';
import { KnowledgeEntry, LocalTradeData, Partnership } from '../types';
import { TrashIcon, PlusCircleIcon, DocumentPlusIcon, ArrowLeftIcon, LightBulbIcon, MapPinIcon, CurrencyDollarIcon, CloudArrowUpIcon, SparklesIcon } from './Icons';
import { GoogleGenAI } from '@google/genai';

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'prompts' | 'knowledge' | 'localdata' | 'monetization'>('prompts');
    const [prompts, setPrompts] = useState<string[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
    const [partnerships, setPartnerships] = useState<Partnership[]>([]);
    
    // Prompt Inputs
    const [newPrompt, setNewPrompt] = useState('');
    
    // AI Processor State
    const [aiInput, setAiInput] = useState('');
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiStatus, setAiStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Local Data Inputs
    const [localScope, setLocalScope] = useState<'national' | 'state' | 'county'>('national');
    const [localId, setLocalId] = useState(''); // e.g., 'TX' or 'TX_Travis'
    const [localData, setLocalData] = useState<LocalTradeData | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    useEffect(() => {
        setPrompts(db.getSuggestedPrompts());
        setKnowledgeBase(db.getKnowledgeBase());
        setPartnerships(db.getPartnerships());
    }, []);

    // Load Local Data when scope/id changes
    useEffect(() => {
        if (activeTab === 'localdata') {
            const data = db.getLocalTradeData(localScope, localId);
            setLocalData(data);
            setJsonInput(data ? JSON.stringify(data, null, 2) : '');
            setSaveStatus('');
        }
    }, [activeTab, localScope, localId]);

    const handleAddPrompt = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPrompt.trim()) {
            const updated = [...prompts, newPrompt.trim()];
            setPrompts(updated);
            db.updateSuggestedPrompts(updated);
            setNewPrompt('');
        }
    };

    const handleDeletePrompt = (index: number) => {
        const updated = prompts.filter((_, i) => i !== index);
        setPrompts(updated);
        db.updateSuggestedPrompts(updated);
    };

    const handleDeleteKnowledge = (id: string) => {
        db.removeKnowledgeEntry(id);
        setKnowledgeBase(db.getKnowledgeBase());
    };
    
    const handleToggleKnowledge = (id: string) => {
        db.toggleKnowledgeEntry(id);
        setKnowledgeBase(db.getKnowledgeBase());
    };

    const handleDeletePartnership = (id: string) => {
        const updated = partnerships.filter(p => p.id !== id);
        setPartnerships(updated);
        db.updatePartnerships(updated);
    };

    const handleSaveLocalData = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            db.saveLocalTradeData(localScope, localId, parsed);
            setSaveStatus('Saved successfully!');
            setTimeout(() => setSaveStatus(''), 3000);
        } catch (e) {
            setSaveStatus('Error: Invalid JSON');
        }
    };

    // --- AI Command Center Logic ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAiFile(e.target.files[0]);
        }
    };

    const handleAIUpdate = async () => {
        if (!aiInput.trim() && !aiFile) return;
        setIsProcessing(true);
        setAiStatus('Reading input...');

        try {
            let contextText = aiInput;

            // 1. Read File if present
            if (aiFile) {
                const text = await aiFile.text();
                contextText += `\n\n[FILE CONTENT]:\n${text}`;
            }

            setAiStatus('Consulting AI...');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            if (activeTab === 'knowledge') {
                // Knowledge Base Processing
                const prompt = `You are a Knowledge Base Administrator.
                Analyze the following input (User Text + Optional File).
                Create a structured Knowledge Entry based on this information.
                
                Input:
                ${contextText}

                Return JSON schema:
                {
                    "title": "Short descriptive title",
                    "content": "The full detailed content formatted as plain text",
                }`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' }
                });

                const result = JSON.parse(response.text);
                db.addKnowledgeEntry(result.title, result.content);
                setKnowledgeBase(db.getKnowledgeBase());
                setAiStatus('Knowledge Base Updated!');

            } else if (activeTab === 'monetization') {
                // Monetization Processing
                const currentAds = JSON.stringify(partnerships);
                const prompt = `You are an Ad Monetization Manager.
                Analyze the input to Add, Update, or Remove partnerships.
                
                Current Partnerships JSON:
                ${currentAds}

                User Instructions / New Data:
                ${contextText}

                Return the FULL updated list of partnerships as a JSON array.
                Schema per item:
                {
                    "id": "string (preserve existing, generate new for new items)",
                    "title": "string",
                    "description": "string",
                    "link": "string (URL)",
                    "type": "Marketplace" | "Affiliate" | "Sponsored",
                    "triggerKeywords": ["string"],
                    "priority": number (1-10),
                    "isActive": boolean
                }`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' }
                });

                const newPartnerships = JSON.parse(response.text);
                if (Array.isArray(newPartnerships)) {
                    setPartnerships(newPartnerships);
                    db.updatePartnerships(newPartnerships);
                    setAiStatus('Partnerships Updated!');
                } else {
                    throw new Error('Invalid AI response format');
                }
            }

            // Cleanup
            setAiInput('');
            setAiFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setTimeout(() => setAiStatus(''), 3000);

        } catch (error) {
            console.error(error);
            setAiStatus('Error processing request.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 min-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 transition-colors">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Admin Console</h2>
                        <p className="text-sm text-slate-500">Manage AI Configuration & Partnerships</p>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('prompts')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'prompts' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Suggested Prompts
                </button>
                <button 
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'knowledge' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Knowledge Base
                </button>
                <button 
                    onClick={() => setActiveTab('monetization')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'monetization' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Monetization
                </button>
                <button 
                    onClick={() => setActiveTab('localdata')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'localdata' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Location Profiles
                </button>
            </div>

            <div className="p-6 flex-grow overflow-y-auto">
                {activeTab === 'prompts' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Edit Suggested Prompts</h3>
                            <p className="text-sm text-slate-500 mb-4">These prompts appear on the main landing page. Add new ideas to guide users.</p>
                            
                            <form onSubmit={handleAddPrompt} className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newPrompt}
                                    onChange={(e) => setNewPrompt(e.target.value)}
                                    placeholder="Enter a new suggested prompt..."
                                    className="flex-grow p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center">
                                    <PlusCircleIcon className="w-5 h-5 mr-1" /> Add
                                </button>
                            </form>
                        </div>

                        <div className="space-y-3">
                            {prompts.map((prompt, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm group hover:border-indigo-200 transition-all">
                                    <span className="text-slate-700 font-medium">{prompt}</span>
                                    <button 
                                        onClick={() => handleDeletePrompt(idx)}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-2"
                                        title="Remove Prompt"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                            {prompts.length === 0 && <p className="text-slate-400 italic text-center">No prompts configured.</p>}
                        </div>
                    </div>
                )}

                {(activeTab === 'knowledge' || activeTab === 'monetization') && (
                    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: AI Command Center */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                                <div className="flex items-center mb-3">
                                    <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600 mr-2">
                                        <SparklesIcon className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-indigo-900">AI Command Center</h4>
                                </div>
                                <p className="text-xs text-indigo-800 leading-relaxed mb-4">
                                    {activeTab === 'knowledge' 
                                        ? "Describe new knowledge or upload a file. The AI will format and add it to the system."
                                        : "Describe a new partnership or upload a CSV. The AI will categorize and add it to the ad engine."}
                                </p>
                                
                                <textarea
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder={activeTab === 'knowledge' ? "e.g. 'Add a rule about 2025 permits...'" : "e.g. 'Add Home Depot affiliate link for lumber...'"}
                                    className="w-full p-3 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white min-h-[100px] mb-3"
                                />

                                <div className="flex items-center space-x-2 mb-3">
                                    <label className="flex-1 cursor-pointer bg-white border border-indigo-200 rounded-lg p-2 flex items-center justify-center hover:bg-indigo-50 transition-colors">
                                        <CloudArrowUpIcon className="w-4 h-4 text-indigo-500 mr-2" />
                                        <span className="text-xs font-semibold text-indigo-700 truncate max-w-[100px]">
                                            {aiFile ? aiFile.name : 'Upload File'}
                                        </span>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden" 
                                            accept=".txt,.csv,.json,.md"
                                        />
                                    </label>
                                </div>

                                <button 
                                    onClick={handleAIUpdate}
                                    disabled={isProcessing || (!aiInput && !aiFile)}
                                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-300 transition-colors shadow-md"
                                >
                                    {isProcessing ? (
                                        <span className="animate-pulse">Processing...</span>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-4 h-4 mr-2" />
                                            Process with AI
                                        </>
                                    )}
                                </button>
                                {aiStatus && <p className="text-xs text-center mt-2 text-indigo-700 font-medium animate-fade-in-up">{aiStatus}</p>}
                            </div>
                        </div>

                        {/* Right: List View */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-bold text-slate-800 flex items-center">
                                {activeTab === 'knowledge' ? (
                                    <><LightBulbIcon className="w-5 h-5 mr-2 text-amber-500" /> Active Knowledge</>
                                ) : (
                                    <><CurrencyDollarIcon className="w-5 h-5 mr-2 text-emerald-500" /> Active Partnerships</>
                                )}
                            </h3>

                            <div className="space-y-3">
                                {activeTab === 'knowledge' && (
                                    knowledgeBase.length === 0 ? <div className="text-slate-400 italic p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">No entries. Use the AI Command Center to add data.</div> :
                                    knowledgeBase.map((entry) => (
                                        <div key={entry.id} className={`p-4 rounded-xl border transition-all ${entry.isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{entry.title}</h4>
                                                    <p className="text-xs text-slate-400">Added: {new Date(entry.dateAdded).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => handleToggleKnowledge(entry.id)} className={`text-xs font-bold px-2 py-1 rounded ${entry.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                                        {entry.isActive ? 'Active' : 'Inactive'}
                                                    </button>
                                                    <button onClick={() => handleDeleteKnowledge(entry.id)} className="text-slate-400 hover:text-red-500 p-1">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono text-slate-600 border border-slate-100 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                                {entry.content}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {activeTab === 'monetization' && (
                                    partnerships.length === 0 ? <div className="text-slate-400 italic p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">No partnerships. Use AI to add them.</div> :
                                    partnerships.map((p) => (
                                        <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.type === 'Affiliate' ? 'bg-blue-100 text-blue-700' : p.type === 'Sponsored' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {p.type}
                                                        </span>
                                                        <h4 className="font-bold text-slate-800">{p.title}</h4>
                                                    </div>
                                                    <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline mb-2 block">{p.link}</a>
                                                    <p className="text-sm text-slate-600 mb-2">{p.description}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {p.triggerKeywords.map((k, i) => (
                                                            <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">#{k}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end space-y-2">
                                                    <span className="text-xs font-bold text-slate-400">Pri: {p.priority}</span>
                                                    <button onClick={() => handleDeletePartnership(p.id)} className="text-slate-400 hover:text-red-500">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {activeTab === 'localdata' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <MapPinIcon className="w-5 h-5 mr-2 text-indigo-600" />
                                Select Data Profile
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
                                    <select 
                                        value={localScope} 
                                        onChange={(e) => {
                                            setLocalScope(e.target.value as any);
                                            setLocalId(e.target.value === 'national' ? '' : localId);
                                        }}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                                    >
                                        <option value="national">National (Default)</option>
                                        <option value="state">State</option>
                                        <option value="county">County</option>
                                    </select>
                                </div>
                                {localScope !== 'national' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            {localScope === 'state' ? 'State Code (e.g. TX)' : 'State_County (e.g. TX_Travis)'}
                                        </label>
                                        <input 
                                            type="text" 
                                            value={localId}
                                            onChange={(e) => setLocalId(e.target.value)}
                                            placeholder={localScope === 'state' ? 'TX' : 'TX_Travis'}
                                            className="w-full border border-slate-300 rounded-lg p-2.5"
                                        />
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mb-2">
                                Current Status: 
                                <span className={`ml-2 font-bold ${localData ? 'text-green-600' : 'text-amber-600'}`}>
                                    {localData ? 'Profile Loaded' : 'No Profile Found (Will Create New)'}
                                </span>
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Edit JSON Data</h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Edit the schema strictly. Ensure valid JSON format for keys like <code>permitsRequired</code>, <code>typicalCosts</code>, etc.
                            </p>
                            
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full h-96 font-mono text-xs p-4 bg-slate-900 text-green-400 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            
                            <div className="flex justify-between items-center mt-4">
                                <span className={`text-sm font-bold ${saveStatus.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                                    {saveStatus}
                                </span>
                                <button 
                                    onClick={handleSaveLocalData}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all"
                                >
                                    Save Profile
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
