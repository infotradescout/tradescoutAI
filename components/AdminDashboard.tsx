
import React, { useState, useEffect, useRef } from 'react';
import * as db from '../services/db';
import { KnowledgeEntry, LocalTradeData, Partnership, User, Contractor, ForumPost, CountyConfig, Category } from '../types';
import { TrashIcon, PlusCircleIcon, ArrowLeftIcon, LightBulbIcon, MapPinIcon, CurrencyDollarIcon, CloudArrowUpIcon, SparklesIcon, ChartBarIcon, UserIcon, TableCellsIcon, BuildingStorefrontIcon, ChatBubbleLeftRightIcon } from './Icons';
import { US_STATES } from '../services/locationService';

async function callGemini(prompt: string): Promise<string> {
    const res = await fetch("/api/ai/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" ? data.text : "";
}

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'businesses' | 'content' | 'ai' | 'localdata' | 'countymanager'>('overview');
    
    // Data State
    const [stats, setStats] = useState({ users: 0, contractors: 0, leads: 0, posts: 0, projects: 0 });
    const [users, setUsers] = useState<User[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
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

    // Local Data Inputs (Raw JSON)
    const [localScope, setLocalScope] = useState<'national' | 'state' | 'county'>('national');
    const [localId, setLocalId] = useState(''); 
    const [localData, setLocalData] = useState<LocalTradeData | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    // County Manager State
    const [cmState, setCmState] = useState('');
    const [cmCounty, setCmCounty] = useState('');
    const [cmConfig, setCmConfig] = useState<CountyConfig | null>(null);
    const [cmStatus, setCmStatus] = useState('');

    useEffect(() => {
        refreshAllData();
    }, []);

    const refreshAllData = () => {
        setStats(db.getSystemStats());
        setUsers(db.getUsers());
        setContractors(db.getContractors());
        setForumPosts(db.getForumPosts());
        setPrompts(db.getSuggestedPrompts());
        setKnowledgeBase(db.getKnowledgeBase());
        setPartnerships(db.getPartnerships());
    };

    // Load Local Data (Raw JSON Tab)
    useEffect(() => {
        if (activeTab === 'localdata') {
            const data = db.getLocalTradeData(localScope, localId);
            setLocalData(data);
            setJsonInput(data ? JSON.stringify(data, null, 2) : '');
            setSaveStatus('');
        }
    }, [activeTab, localScope, localId]);

    // County Manager Logic
    const handleLoadCountyConfig = () => {
        if (!cmState || !cmCounty.trim()) {
            setCmStatus('Please select a state and enter a county name.');
            return;
        }
        const existing = db.getCountyConfig(cmCounty.trim(), cmState);
        if (existing) {
            setCmConfig(existing);
            setCmStatus('Loaded existing configuration.');
        } else {
            setCmConfig(null);
            setCmStatus('No configuration found for this county.');
        }
    };

    const handleCreateCountyConfig = () => {
        if (!cmState || !cmCounty.trim()) return;
                                        <Badge variant="error" className="ml-2">Error</Badge>
            countyCode: cmCounty.trim(),
            stateCode: cmState,
            displayName: `${cmCounty.trim()} County`,
            localTradeData: {
                permitsRequired: [],
                typicalCosts: {},
                climateFactors: [],
                riskFactors: [],
                materialAvailability: [],
                contractorRegulations: [],
                popularProjectTypes: []
            },
            updatedAt: Date.now()
        };
        setCmConfig(newConfig);
        setCmStatus('New configuration created. Remember to save.');
    };

    const handleSaveCountyConfig = () => {
        if (!cmConfig) return;
        db.saveCountyConfig(cmConfig);
        setCmStatus(`Saved configuration for ${cmConfig.displayName} at ${new Date().toLocaleTimeString()}.`);
    };

    const updateCmArrayField = (field: keyof LocalTradeData, value: string) => {
        if (!cmConfig) return;
        const array = value.split('\n'); // Keep empty lines? Filter? Let's keep raw split for editing ease
        setCmConfig({
            ...cmConfig,
            localTradeData: {
                ...cmConfig.localTradeData,
                [field]: array
            }
        });
    };

    const updateCmCost = (category: string, field: 'low' | 'high', value: string) => {
        if (!cmConfig) return;
        const numVal = parseFloat(value);
        const costs = { ...cmConfig.localTradeData.typicalCosts };
        if (!costs[category]) {
            costs[category] = { low: 0, high: 0, unit: 'USD' };
        }
        costs[category] = {
            ...costs[category],
            [field]: isNaN(numVal) ? 0 : numVal
        };
        setCmConfig({
            ...cmConfig,
            localTradeData: {
                ...cmConfig.localTradeData,
                typicalCosts: costs
            }
        });
    };

    // --- Action Handlers ---

    const handleDeleteUser = (id: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            db.deleteUser(id);
            refreshAllData();
        }
    };

    const handleDeleteBusiness = (id: string) => {
        if (confirm("Delete this contractor listing?")) {
            db.removeContractor(id);
            refreshAllData();
        }
    };

    const handleDeletePost = (id: string) => {
        if (confirm("Remove this post?")) {
            db.deleteForumPost(id);
            refreshAllData();
        }
    };

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

    // --- AI Processor ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setAiFile(e.target.files[0]);
    };

    const handleAIUpdate = async (mode: 'knowledge' | 'monetization') => {
        if (!aiInput.trim() && !aiFile) return;
        setIsProcessing(true);
        setAiStatus('Reading input...');

        try {
            let contextText = aiInput;
            if (aiFile) contextText += `\n\n[FILE CONTENT]:\n${await aiFile.text()}`;

            if (mode === 'knowledge') {
                const prompt = `You are a Knowledge Base Administrator. Create a structured entry from this input:\n${contextText}\nReturn JSON only: { "title": "string", "content": "string" }`;
                const result = JSON.parse(await callGemini(prompt));
                db.addKnowledgeEntry(result.title, result.content);
                setAiStatus('Knowledge Added');
            } else {
                const prompt = `You are an Ad Manager. Add/Update partnerships based on:\n${contextText}\nCurrent: ${JSON.stringify(partnerships)}\nReturn FULL JSON array of Partnership objects only.`;
                const result = JSON.parse(await callGemini(prompt));
                db.updatePartnerships(result);
                setAiStatus('Partnerships Updated');
            }
            
            refreshAllData();
            setAiInput('');
            setAiFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            setAiStatus('Error processing.');
        } finally {
            setIsProcessing(false);
            setTimeout(() => setAiStatus(''), 3000);
        }
    };

    const SidebarItem = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col md:flex-row min-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-950 p-4 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
                <div className="flex items-center space-x-3 mb-8 px-2 pt-2">
                    <button onClick={onBack} className="bg-slate-800 p-2 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-white font-bold">Admin Console</h2>
                        <p className="text-xs text-slate-500">v1.2.0</p>
                    </div>
                </div>
                
                <nav className="space-y-1 flex-grow">
                    <SidebarItem id="overview" label="System Overview" icon={ChartBarIcon} />
                    <SidebarItem id="users" label="User Management" icon={UserIcon} />
                    <SidebarItem id="businesses" label="Business Directory" icon={BuildingStorefrontIcon} />
                    <SidebarItem id="content" label="Content Moderation" icon={ChatBubbleLeftRightIcon} />
                    <div className="pt-4 pb-2">
                        <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">AI Configuration</p>
                    </div>
                    <SidebarItem id="ai" label="Intelligence & Ads" icon={SparklesIcon} />
                    <SidebarItem id="localdata" label="Location Profiles" icon={MapPinIcon} />
                    <SidebarItem id="countymanager" label="County Manager" icon={MapPinIcon} />
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-slate-900 overflow-y-auto">
                <div className="p-6 md:p-8">
                    
                    {/* Overview */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-white mb-6">System Health</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                                    <p className="text-slate-400 text-sm font-medium">Total Users</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.users}</p>
                                </div>
                                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                                    <p className="text-slate-400 text-sm font-medium">Verified Pros</p>
                                    <p className="text-3xl font-bold text-orange-500 mt-1">{stats.contractors}</p>
                                </div>
                                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                                    <p className="text-slate-400 text-sm font-medium">Active Leads</p>
                                    <p className="text-3xl font-bold text-emerald-500 mt-1">{stats.leads}</p>
                                </div>
                                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                                    <p className="text-slate-400 text-sm font-medium">Forum Posts</p>
                                    <p className="text-3xl font-bold text-cyan-500 mt-1">{stats.posts}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Users Table */}
                    {activeTab === 'users' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">User Management</h2>
                                <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-bold">{users.length} Registered</span>
                            </div>
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <table className="w-full text-sm text-left text-slate-300">
                                    <thead className="bg-slate-900 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Saved Pros</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-700/50 transition-colors">
                                                <td className="px-6 py-4 flex items-center gap-3">
                                                    <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
                                                    <span className="font-medium text-white">{user.username}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.isAdmin ? 'bg-red-900/50 text-red-400' : user.role === 'contractor' ? 'bg-cyan-900/50 text-cyan-400' : 'bg-slate-700 text-slate-300'}`}>
                                                        {user.isAdmin ? 'Admin' : user.role || 'Homeowner'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{user.savedContractorIds.length}</td>
                                                <td className="px-6 py-4 text-right">
                                                    {!user.isAdmin && (
                                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-300 font-medium">Delete</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Businesses Table */}
                    {activeTab === 'businesses' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Business Directory</h2>
                            <div className="grid gap-4">
                                {contractors.map(c => (
                                    <div key={c.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <img src={c.avatarUrl} className="w-12 h-12 rounded-lg object-cover" />
                                            <div>
                                                <h4 className="font-bold text-white">{c.name}</h4>
                                                <p className="text-xs text-slate-400">{c.category} • {c.location}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xs px-2 py-1 rounded ${c.claimed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                                {c.claimed ? 'Claimed' : 'Unclaimed'}
                                            </span>
                                            <button onClick={() => handleDeleteBusiness(c.id)} className="p-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content Moderation */}
                    {activeTab === 'content' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Content Moderation</h2>
                            <div className="space-y-4">
                                {forumPosts.length === 0 ? <p className="text-slate-500">No content to moderate.</p> : forumPosts.map(post => (
                                    <div key={post.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{post.category}</span>
                                                    <span className="text-xs text-slate-500">by {post.username}</span>
                                                </div>
                                                <h3 className="font-bold text-white">{post.title}</h3>
                                                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{post.content}</p>
                                            </div>
                                            <button onClick={() => handleDeletePost(post.id)} className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-900/50 bg-red-900/10 px-3 py-1.5 rounded-lg">
                                                Remove Post
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Configuration (Merged Knowledge & Monetization & Prompts) */}
                    {activeTab === 'ai' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Col: Prompts & AI Input */}
                            <div className="space-y-8">
                                {/* Suggestion Prompts */}
                                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                    <h3 className="font-bold text-white mb-4">Suggested Prompts</h3>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            value={newPrompt}
                                            onChange={e => setNewPrompt(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                                            placeholder="New suggestion..."
                                        />
                                        <button onClick={handleAddPrompt} className="bg-indigo-600 px-3 rounded-lg text-white">
                                            <PlusCircleIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {prompts.map((p, i) => (
                                            <span key={i} className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs flex items-center">
                                                {p}
                                                <button onClick={() => handleDeletePrompt(i)} className="ml-2 text-slate-500 hover:text-red-400">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* AI Command Center */}
                                <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 rounded-xl border border-indigo-500/30">
                                    <div className="flex items-center gap-2 mb-4 text-indigo-400">
                                        <SparklesIcon className="w-5 h-5" />
                                        <h3 className="font-bold">AI Processor</h3>
                                    </div>
                                    <textarea 
                                        value={aiInput}
                                        onChange={e => setAiInput(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white h-32 mb-3"
                                        placeholder="Describe a new rule, partnership, or knowledge entry..."
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleAIUpdate('knowledge')}
                                            disabled={isProcessing}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                                        >
                                            Update Knowledge
                                        </button>
                                        <button 
                                            onClick={() => handleAIUpdate('monetization')}
                                            disabled={isProcessing}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                                        >
                                            Update Ads
                                        </button>
                                    </div>
                                    {aiStatus && <p className="text-center text-xs text-indigo-300 mt-2">{aiStatus}</p>}
                                </div>
                            </div>

                            {/* Right Col: Lists */}
                            <div className="space-y-8">
                                <div>
                                    <h3 className="font-bold text-white mb-3">Knowledge Base ({knowledgeBase.length})</h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {knowledgeBase.map(k => (
                                            <div key={k.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between">
                                                <span className="text-sm text-slate-300">{k.title}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleToggleKnowledge(k.id)} className={`w-2 h-2 rounded-full ${k.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <button onClick={() => handleDeleteKnowledge(k.id)} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white mb-3">Partnerships ({partnerships.length})</h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {partnerships.map(p => (
                                            <div key={p.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between">
                                                <div>
                                                    <span className="text-sm font-bold text-slate-200">{p.title}</span>
                                                    <span className="ml-2 text-xs text-slate-500 bg-slate-900 px-1 rounded">{p.type}</span>
                                                </div>
                                                <button onClick={() => handleDeletePartnership(p.id)} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Local Data Editor (Raw JSON) */}
                    {activeTab === 'localdata' && (
                        <div className="max-w-4xl">
                            <h2 className="text-2xl font-bold text-white mb-6">Location Profiles (JSON)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <select 
                                    value={localScope} 
                                    onChange={(e) => { setLocalScope(e.target.value as any); setLocalId(''); }}
                                    className="bg-slate-800 text-white p-3 rounded-lg border border-slate-700"
                                >
                                    <option value="national">National</option>
                                    <option value="state">State</option>
                                    <option value="county">County</option>
                                </select>
                                {localScope !== 'national' && (
                                    <input 
                                        value={localId}
                                        onChange={e => setLocalId(e.target.value)}
                                        placeholder={localScope === 'state' ? 'TX' : 'TX_Travis'}
                                        className="bg-slate-800 text-white p-3 rounded-lg border border-slate-700"
                                    />
                                )}
                            </div>
                            <div className="relative">
                                <textarea
                                    value={jsonInput}
                                    onChange={e => setJsonInput(e.target.value)}
                                    className="w-full h-96 bg-slate-950 font-mono text-xs text-green-400 p-4 rounded-xl border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="absolute top-4 right-4 flex items-center gap-4">
                                    <span className={saveStatus.includes('Error') ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>{saveStatus}</span>
                                    <button onClick={handleSaveLocalData} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">
                                        Save JSON
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* County Config Manager */}
                    {activeTab === 'countymanager' && (
                        <div className="max-w-6xl mx-auto pb-10">
                            <h2 className="text-2xl font-bold text-white mb-6">County Config Manager</h2>
                            
                            {/* Selector */}
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
                                <h3 className="font-bold text-slate-300 mb-4 text-sm uppercase">Select Location</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">State</label>
                                        <select 
                                            value={cmState} 
                                            onChange={e => { setCmState(e.target.value); setCmConfig(null); setCmStatus(''); }}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                                        >
                                            <option value="">Select State...</option>
                                            {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">County</label>
                                        <input 
                                            value={cmCounty}
                                            onChange={e => { setCmCounty(e.target.value); setCmConfig(null); setCmStatus(''); }}
                                            placeholder="e.g. Travis"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button 
                                            onClick={handleLoadCountyConfig}
                                            disabled={!cmState || !cmCounty}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-lg transition-colors"
                                        >
                                            Load Configuration
                                        </button>
                                    </div>
                                </div>
                                {cmStatus && <p className="mt-3 text-sm text-cyan-400">{cmStatus}</p>}
                            </div>

                            {/* Create New Prompt */}
                            {!cmConfig && cmState && cmCounty && cmStatus.includes('No configuration') && (
                                <div className="text-center p-8 bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700">
                                    <p className="text-slate-400 mb-4">No data found for {cmCounty} County, {cmState}.</p>
                                    <button 
                                        onClick={handleCreateCountyConfig}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                    >
                                        Create New Config
                                    </button>
                                </div>
                            )}

                            {/* Editor Form */}
                            {cmConfig && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-white">Editing: {cmConfig.displayName}</h3>
                                        <button 
                                            onClick={handleSaveCountyConfig}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg"
                                        >
                                            Save Changes
                                        </button>
                                    </div>

                                    {/* Data Fields */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Left Col: Lists */}
                                        <div className="space-y-6">
                                            {[
                                                { key: 'permitsRequired', label: 'Permits Required' },
                                                { key: 'climateFactors', label: 'Climate Factors' },
                                                { key: 'riskFactors', label: 'Risk Factors' },
                                                { key: 'materialAvailability', label: 'Material Availability' },
                                                { key: 'contractorRegulations', label: 'Contractor Regulations' },
                                                { key: 'popularProjectTypes', label: 'Popular Projects' },
                                            ].map((field) => (
                                                <div key={field.key} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                                    <label className="block text-sm font-bold text-slate-300 mb-2">{field.label} (One per line)</label>
                                                    <textarea 
                                                        value={(cmConfig.localTradeData[field.key as keyof LocalTradeData] as string[]).join('\n')}
                                                        onChange={e => updateCmArrayField(field.key as keyof LocalTradeData, e.target.value)}
                                                        className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white resize-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Right Col: Costs */}
                                        <div>
                                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-4">
                                                <h3 className="font-bold text-white mb-4 flex items-center">
                                                    <CurrencyDollarIcon className="w-5 h-5 mr-2 text-green-500" />
                                                    Typical Costs (USD)
                                                </h3>
                                                <div className="space-y-4">
                                                    {Object.values(Category).map(cat => {
                                                        const cost = cmConfig.localTradeData.typicalCosts[cat] || { low: 0, high: 0, unit: 'USD' };
                                                        return (
                                                            <div key={cat} className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">{cat}</p>
                                                                <div className="flex gap-4">
                                                                    <div>
                                                                        <label className="text-[10px] text-slate-500 block">Low</label>
                                                                        <input 
                                                                            type="number"
                                                                            value={cost.low}
                                                                            onChange={e => updateCmCost(cat, 'low', e.target.value)}
                                                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] text-slate-500 block">High</label>
                                                                        <input 
                                                                            type="number"
                                                                            value={cost.high}
                                                                            onChange={e => updateCmCost(cat, 'high', e.target.value)}
                                                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
