
import React, { useState, useEffect } from 'react';
import * as db from '../services/db';
import { KnowledgeEntry, LocalTradeData } from '../types';
import { TrashIcon, PlusCircleIcon, DocumentPlusIcon, ArrowLeftIcon, LightBulbIcon, MapPinIcon } from './Icons';

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'prompts' | 'knowledge' | 'localdata'>('prompts');
    const [prompts, setPrompts] = useState<string[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
    
    // Prompt Inputs
    const [newPrompt, setNewPrompt] = useState('');
    
    // Knowledge Inputs
    const [kbTitle, setKbTitle] = useState('');
    const [kbContent, setKbContent] = useState('');

    // Local Data Inputs
    const [localScope, setLocalScope] = useState<'national' | 'state' | 'county'>('national');
    const [localId, setLocalId] = useState(''); // e.g., 'TX' or 'TX_Travis'
    const [localData, setLocalData] = useState<LocalTradeData | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    useEffect(() => {
        setPrompts(db.getSuggestedPrompts());
        setKnowledgeBase(db.getKnowledgeBase());
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

    const handleAddKnowledge = (e: React.FormEvent) => {
        e.preventDefault();
        if (kbTitle.trim() && kbContent.trim()) {
            db.addKnowledgeEntry(kbTitle.trim(), kbContent.trim());
            setKnowledgeBase(db.getKnowledgeBase());
            setKbTitle('');
            setKbContent('');
        }
    };

    const handleDeleteKnowledge = (id: string) => {
        db.removeKnowledgeEntry(id);
        setKnowledgeBase(db.getKnowledgeBase());
    };
    
    const handleToggleKnowledge = (id: string) => {
        db.toggleKnowledgeEntry(id);
        setKnowledgeBase(db.getKnowledgeBase());
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

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 min-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 transition-colors">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Admin Console</h2>
                        <p className="text-sm text-slate-500">Manage AI Configuration</p>
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

                {activeTab === 'knowledge' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-4">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 mb-2 flex items-center">
                                        <LightBulbIcon className="w-5 h-5 mr-2" />
                                        Context Injection
                                    </h4>
                                    <p className="text-xs text-indigo-800 leading-relaxed">
                                        Data added here is injected into the AI's "System Prompt". Use this to teach the AI about local building codes, labor rates, or specific company policies.
                                    </p>
                                </div>
                                <form onSubmit={handleAddKnowledge} className="space-y-3 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Title / Topic</label>
                                        <input 
                                            type="text" 
                                            value={kbTitle}
                                            onChange={e => setKbTitle(e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-indigo-500"
                                            placeholder="e.g. 2024 Labor Rates"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Content (Text)</label>
                                        <textarea 
                                            value={kbContent}
                                            onChange={e => setKbContent(e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 h-32"
                                            placeholder="Paste relevant text, rules, or data here..."
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center justify-center">
                                        <DocumentPlusIcon className="w-4 h-4 mr-2" />
                                        Add to Knowledge Base
                                    </button>
                                </form>
                            </div>

                            <div className="md:col-span-2 space-y-4">
                                <h3 className="font-bold text-slate-800">Active Knowledge Files</h3>
                                {knowledgeBase.length === 0 ? (
                                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                                        <p className="text-slate-500">No knowledge entries found.</p>
                                    </div>
                                ) : (
                                    knowledgeBase.map((entry) => (
                                        <div key={entry.id} className={`p-4 rounded-xl border transition-all ${entry.isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{entry.title}</h4>
                                                    <p className="text-xs text-slate-400">Added: {new Date(entry.dateAdded).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button 
                                                        onClick={() => handleToggleKnowledge(entry.id)}
                                                        className={`text-xs font-bold px-2 py-1 rounded ${entry.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                                                    >
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
